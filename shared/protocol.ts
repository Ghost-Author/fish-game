export type Vec2 = { x: number; y: number };

export type ClientToServer =
  | { type: 'hello'; name: string }
  | { type: 'createRoom' }
  | { type: 'joinRoom'; roomCode: string }
  | { type: 'leaveRoom' }
  | { type: 'input'; target: Vec2 }
  | { type: 'ready' }
  | { type: 'ping'; t: number };

export type ServerToClient =
  | { type: 'welcome'; id: string }
  | { type: 'roomCreated'; roomCode: string }
  | { type: 'roomJoined'; roomCode: string; players: PlayerSnapshot[] }
  | { type: 'roomLeft' }
  | { type: 'state'; tick: number; you: PlayerSnapshot; players: PlayerSnapshot[]; fishes: FishSnapshot[]; items: ItemSnapshot[]; score: number; level: number }
  | { type: 'gameOver'; reason: 'eaten' | 'disconnect' }
  | { type: 'leaderboard'; entries: LeaderboardEntry[] }
  | { type: 'pong'; t: number };

export type PlayerSnapshot = {
  id: string;
  name: string;
  pos: Vec2;
  radius: number;
  hue: number;
  alive: boolean;
  score: number;
};

export type FishSnapshot = {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  tier: 'small' | 'medium' | 'large';
};

export type ItemSnapshot = {
  id: string;
  pos: Vec2;
  kind: 'boost' | 'shield' | 'slow' | 'magnet';
  ttl: number;
};

export type LeaderboardEntry = { name: string; score: number; date: string };

export type RoomState = {
  roomCode: string;
  players: PlayerSnapshot[];
  fishes: FishSnapshot[];
  items: ItemSnapshot[];
  tick: number;
  level: number;
};
