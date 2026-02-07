import type { ClientToServer, ServerToClient } from '../../shared/protocol';

export type ClientEvents = {
  onState: (msg: Extract<ServerToClient, { type: 'state' }>) => void;
  onRoom: (msg: Extract<ServerToClient, { type: 'roomCreated' | 'roomJoined' | 'roomLeft' }>) => void;
  onGameOver: (msg: Extract<ServerToClient, { type: 'gameOver' }>) => void;
  onWelcome: (msg: Extract<ServerToClient, { type: 'welcome' }>) => void;
  onLeaderboard: (msg: Extract<ServerToClient, { type: 'leaderboard' }>) => void;
};

export class NetClient {
  private ws?: WebSocket;
  private url: string;
  private queue: ClientToServer[] = [];

  constructor(url: string, private events: ClientEvents) {
    this.url = url;
  }

  connect(name: string) {
    if (this.ws && this.ws.readyState <= 1) return;
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('open', () => {
      this.send({ type: 'hello', name });
      this.queue.forEach((msg) => this.send(msg));
      this.queue = [];
    });
    this.ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data) as ServerToClient;
      this.handle(msg);
    });
  }

  disconnect() {
    this.ws?.close();
  }

  send(msg: ClientToServer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handle(msg: ServerToClient) {
    if (msg.type === 'state') this.events.onState(msg);
    if (msg.type === 'roomCreated' || msg.type === 'roomJoined' || msg.type === 'roomLeft') this.events.onRoom(msg);
    if (msg.type === 'gameOver') this.events.onGameOver(msg);
    if (msg.type === 'welcome') this.events.onWelcome(msg);
    if (msg.type === 'leaderboard') this.events.onLeaderboard(msg);
  }
}
