import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { ClientToServer, ServerToClient, FishSnapshot, ItemSnapshot, PlayerSnapshot, Vec2, LeaderboardEntry } from '../../shared/protocol.js';
import { LEVELS, WORLD, MAX_PLAYERS } from '../../shared/constants.js';

const PORT = 5175;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;

type Player = {
  id: string;
  name: string;
  wsId: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  score: number;
  hue: number;
  alive: boolean;
  target: Vec2;
  shield: number;
  boost: number;
  magnet: number;
  deadAt?: number;
};

type Fish = FishSnapshot & { id: string };

type Item = ItemSnapshot & { id: string };

type Room = {
  code: string;
  players: Map<string, Player>;
  fishes: Fish[];
  items: Item[];
  tick: number;
  spawnTimer: number;
  spawnInterval: number;
  level: number;
};

type DBData = { leaderboard: LeaderboardEntry[] };

const app = express();
app.use(cors());
app.use(express.json());

const dbFile = join(process.cwd(), 'data.json');
const db = new Low<DBData>(new JSONFile<DBData>(dbFile), { leaderboard: [] });

const rooms = new Map<string, Room>();
const sockets = new Map<string, { ws: WebSocket; playerId?: string; name?: string }>();

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const makeRoomCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const createRoom = () => {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room: Room = {
    code,
    players: new Map(),
    fishes: [],
    items: [],
    tick: 0,
    spawnTimer: 0,
    spawnInterval: 0.9,
    level: 1
  };
  rooms.set(code, room);
  return room;
};

const addPlayerToRoom = (room: Room, player: Player) => {
  if (room.players.size >= MAX_PLAYERS) return false;
  room.players.set(player.id, player);
  return true;
};

const removePlayer = (room: Room, playerId: string) => {
  room.players.delete(playerId);
  if (room.players.size === 0) rooms.delete(room.code);
};

const spawnFish = (room: Room) => {
  const side = Math.random() > 0.5 ? 'left' : 'right';
  const avgRadius = room.players.size > 0 ? Array.from(room.players.values()).reduce((a, p) => a + p.radius, 0) / room.players.size : 26;
  const scale = rand(0.55, 2.2);
  const radius = clamp(avgRadius * scale, 10, 140);
  const speed = clamp(220 - radius * 0.6, 80, 220) * (1 + room.level * 0.03);
  const y = rand(radius, WORLD.baseHeight - radius);
  const x = side === 'left' ? -radius * 1.2 : WORLD.baseWidth + radius * 1.2;
  const vx = side === 'left' ? speed : -speed;
  const tier: FishSnapshot['tier'] = scale <= 1 ? 'small' : scale < 1.4 ? 'medium' : 'large';
  room.fishes.push({
    id: randomUUID(),
    pos: { x, y },
    vel: { x: vx, y: rand(-20, 20) },
    radius,
    tier
  });
};

const spawnItem = (room: Room) => {
  const kinds: ItemSnapshot['kind'][] = ['boost', 'shield', 'slow', 'magnet'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  room.items.push({
    id: randomUUID(),
    pos: { x: rand(80, WORLD.baseWidth - 80), y: rand(80, WORLD.baseHeight - 80) },
    kind,
    ttl: 8
  });
};

const updateRoom = (room: Room) => {
  room.tick += 1;
  room.spawnTimer += DT;
  if (room.spawnTimer >= room.spawnInterval) {
    room.spawnTimer = 0;
    spawnFish(room);
    const itemChance = 0.18 + room.level * 0.02;
    if (Math.random() < itemChance) spawnItem(room);
  }

  for (const fish of room.fishes) {
    fish.pos.x += fish.vel.x * DT;
    fish.pos.y += fish.vel.y * DT;
  }
  room.fishes = room.fishes.filter(
    (fish) =>
      fish.pos.x > -fish.radius * 2 &&
      fish.pos.x < WORLD.baseWidth + fish.radius * 2 &&
      fish.pos.y > -fish.radius * 2 &&
      fish.pos.y < WORLD.baseHeight + fish.radius * 2
  );

  for (const item of room.items) item.ttl -= DT;
  room.items = room.items.filter((item) => item.ttl > 0);

  for (const player of room.players.values()) {
    if (!player.alive) continue;
    const dx = player.target.x - player.pos.x;
    const dy = player.target.y - player.pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const maxSpeed = 320 + player.radius * 1.5 + (player.boost > 0 ? 120 : 0);
    const speed = clamp(dist * 2.4, 120, maxSpeed);
    player.vel.x = (dx / dist) * speed;
    player.vel.y = (dy / dist) * speed;
    player.pos.x = clamp(player.pos.x + player.vel.x * DT, player.radius, WORLD.baseWidth - player.radius);
    player.pos.y = clamp(player.pos.y + player.vel.y * DT, player.radius, WORLD.baseHeight - player.radius);

    if (player.boost > 0) player.boost = Math.max(0, player.boost - DT);
    if (player.shield > 0) player.shield = Math.max(0, player.shield - DT);
    if (player.magnet > 0) player.magnet = Math.max(0, player.magnet - DT);
  }

  // player vs fish
  for (const player of room.players.values()) {
    if (!player.alive) continue;
    for (let i = room.fishes.length - 1; i >= 0; i--) {
      const fish = room.fishes[i];
      const dx = fish.pos.x - player.pos.x;
      const dy = fish.pos.y - player.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < (fish.radius + player.radius) * 0.85) {
        if (fish.radius <= player.radius * 0.95) {
          room.fishes.splice(i, 1);
          player.score += Math.round(fish.radius * 2);
          const growth = fish.radius * fish.radius * 0.45;
          player.radius = Math.sqrt(player.radius * player.radius + growth);
        } else if (player.shield > 0) {
          player.shield = 0;
          room.fishes.splice(i, 1);
        } else {
          player.alive = false;
          player.deadAt = Date.now();
          recordScore(player.name, player.score);
          sendGameOver(player);
        }
      }
    }
  }

  // player vs player
  const players = Array.from(room.players.values()).filter((p) => p.alive);
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      if (d < (a.radius + b.radius) * 0.85) {
        const bigger = a.radius > b.radius * 1.05 ? a : b.radius > a.radius * 1.05 ? b : null;
        const smaller = bigger === a ? b : bigger === b ? a : null;
        if (bigger && smaller) {
          bigger.score += Math.round(smaller.radius * 2);
          bigger.radius = Math.sqrt(bigger.radius * bigger.radius + smaller.radius * smaller.radius * 0.5);
          smaller.alive = false;
          smaller.deadAt = Date.now();
          recordScore(smaller.name, smaller.score);
          sendGameOver(smaller);
        }
      }
    }
  }

  // player vs item
  for (const player of room.players.values()) {
    if (!player.alive) continue;
    for (let i = room.items.length - 1; i >= 0; i--) {
      const item = room.items[i];
      const dist = Math.hypot(item.pos.x - player.pos.x, item.pos.y - player.pos.y);
      if (dist < player.radius + 10) {
        room.items.splice(i, 1);
        if (item.kind === 'boost') player.boost = 4;
        if (item.kind === 'shield') player.shield = 6;
        if (item.kind === 'slow') {
          room.fishes.forEach((f) => (f.vel.x *= 0.6));
        }
        if (item.kind === 'magnet') player.magnet = 5;
      }
    }
  }

  // magnet effect
  for (const fish of room.fishes) {
    for (const player of room.players.values()) {
      if (!player.alive) continue;
      if (player.magnet > 0 && fish.radius < player.radius * 0.7) {
        const dx = player.pos.x - fish.pos.x;
        const dy = player.pos.y - fish.pos.y;
        fish.pos.x += dx * DT * 0.6;
        fish.pos.y += dy * DT * 0.6;
      }
    }
  }

  const maxScore = Math.max(0, ...Array.from(room.players.values()).map((p) => p.score));
  const lvl = LEVELS.reduce((acc, cur, idx) => (maxScore >= cur.score ? idx + 1 : acc), 1);
  room.level = lvl;
  room.spawnInterval = LEVELS[lvl - 1]?.spawnInterval ?? 0.5;

  // cleanup dead players
  for (const player of room.players.values()) {
    if (player.alive) continue;
    if (player.deadAt && Date.now() - player.deadAt > 5000) {
      room.players.delete(player.id);
    }
  }
};

const snapshotPlayer = (player: Player): PlayerSnapshot => ({
  id: player.id,
  name: player.name,
  pos: player.pos,
  radius: player.radius,
  hue: player.hue,
  alive: player.alive,
  score: player.score
});

const broadcastState = (room: Room) => {
  for (const player of room.players.values()) {
    const socketEntry = sockets.get(player.wsId);
    if (!socketEntry) continue;
    const msg: ServerToClient = {
      type: 'state',
      tick: room.tick,
      you: snapshotPlayer(player),
      players: Array.from(room.players.values()).map(snapshotPlayer),
      fishes: room.fishes,
      items: room.items,
      score: player.score,
      level: room.level
    };
    socketEntry.ws.send(JSON.stringify(msg));
  }
};

const sendGameOver = (player: Player) => {
  const socketEntry = sockets.get(player.wsId);
  if (!socketEntry) return;
  const msg: ServerToClient = { type: 'gameOver', reason: 'eaten' };
  socketEntry.ws.send(JSON.stringify(msg));
};

const tickLoop = () => {
  for (const room of rooms.values()) {
    updateRoom(room);
    broadcastState(room);
  }
};

setInterval(tickLoop, 1000 / TICK_RATE);

const recordScore = async (name: string, score: number) => {
  await db.read();
  db.data ||= { leaderboard: [] };
  db.data.leaderboard.push({ name, score, date: new Date().toISOString() });
  db.data.leaderboard.sort((a, b) => b.score - a.score);
  db.data.leaderboard = db.data.leaderboard.slice(0, 20);
  await db.write();
};

app.get('/leaderboard', async (_req, res) => {
  await db.read();
  db.data ||= { leaderboard: [] };
  res.json(db.data.leaderboard ?? []);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

wss.on('connection', (ws) => {
  const wsId = randomUUID();
  sockets.set(wsId, { ws });
  ws.send(JSON.stringify({ type: 'welcome', id: wsId } satisfies ServerToClient));

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ClientToServer;
    const socketEntry = sockets.get(wsId);
    if (!socketEntry) return;

    if (msg.type === 'hello') {
      socketEntry.playerId = undefined;
      socketEntry.name = msg.name;
      socketEntry.ws.send(JSON.stringify({ type: 'welcome', id: wsId } satisfies ServerToClient));
    }

    if (msg.type === 'createRoom') {
      const room = createRoom();
      const player = createPlayer(socketEntry.name ?? '玩家', wsId);
      if (!addPlayerToRoom(room, player)) return;
      socketEntry.playerId = player.id;
      ws.send(JSON.stringify({ type: 'roomCreated', roomCode: room.code } satisfies ServerToClient));
      ws.send(JSON.stringify({ type: 'roomJoined', roomCode: room.code, players: Array.from(room.players.values()).map(snapshotPlayer) } satisfies ServerToClient));
    }

    if (msg.type === 'joinRoom') {
      let room = rooms.get(msg.roomCode);
      if (!room) room = createRoom();
      const player = createPlayer(socketEntry.name ?? '玩家', wsId);
      if (!addPlayerToRoom(room, player)) return;
      socketEntry.playerId = player.id;
      ws.send(JSON.stringify({ type: 'roomJoined', roomCode: room.code, players: Array.from(room.players.values()).map(snapshotPlayer) } satisfies ServerToClient));
    }

    if (msg.type === 'leaveRoom') {
      leaveRoom(wsId);
      ws.send(JSON.stringify({ type: 'roomLeft' } satisfies ServerToClient));
    }

    if (msg.type === 'input') {
      const player = findPlayer(wsId);
      if (player) player.target = msg.target;
    }

    if (msg.type === 'ready') {
      sendLeaderboard(ws);
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: msg.t } satisfies ServerToClient));
    }
  });

  ws.on('close', () => {
    leaveRoom(wsId);
    sockets.delete(wsId);
  });
});

const createPlayer = (name: string, wsId: string): Player => {
  return {
    id: randomUUID(),
    name,
    wsId,
    pos: { x: rand(200, WORLD.baseWidth - 200), y: rand(160, WORLD.baseHeight - 160) },
    vel: { x: 0, y: 0 },
    radius: 26,
    score: 0,
    hue: Math.floor(rand(0, 360)),
    alive: true,
    target: { x: WORLD.baseWidth * 0.5, y: WORLD.baseHeight * 0.6 },
    shield: 0,
    boost: 0,
    magnet: 0
  };
};

const findPlayer = (wsId: string) => {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.wsId === wsId) return player;
    }
  }
  return undefined;
};

const leaveRoom = (wsId: string) => {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.wsId === wsId) {
        removePlayer(room, player.id);
        return;
      }
    }
  }
};

const sendLeaderboard = async (ws: WebSocket) => {
  await db.read();
  db.data ||= { leaderboard: [] };
  const msg: ServerToClient = { type: 'leaderboard', entries: db.data.leaderboard ?? [] };
  ws.send(JSON.stringify(msg));
};

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
