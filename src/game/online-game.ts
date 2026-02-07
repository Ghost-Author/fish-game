import type { FishSnapshot, ItemSnapshot, PlayerSnapshot, Vec2 } from '../../shared/protocol';
import { Renderer, type Bubble, type Particle, type RenderFish, type RenderItem, type RenderPlayer, type Ripple } from './renderer';
import { rand } from './utils';
import { WORLD } from '../../shared/constants';
import type { Skin } from './skins';

export type OnlineState = {
  you?: PlayerSnapshot;
  players: PlayerSnapshot[];
  fishes: FishSnapshot[];
  items: ItemSnapshot[];
  tick: number;
  level: number;
  score: number;
};

export class OnlineGame {
  private width = 0;
  private height = 0;
  private dpr = 1;
  private bubbles: Bubble[] = [];
  private ripples: Ripple[] = [];
  private particles: Particle[] = [];
  private lastPos = new Map<string, Vec2>();
  private state: OnlineState = { players: [], fishes: [], items: [], tick: 0, level: 1, score: 0 };
  private running = false;
  private lastTime = 0;

  constructor(private canvas: HTMLCanvasElement, private renderer: Renderer, private skin: Skin) {
    this.resize();
    for (let i = 0; i < 40; i++) this.bubbles.push(this.makeBubble(true));
    window.addEventListener('resize', () => this.resize());
  }

  setSkin(skin: Skin) {
    this.skin = skin;
  }

  updateState(next: OnlineState) {
    this.state = next;
    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  stop() {
    this.running = false;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.floor(rect.width * this.dpr);
    this.height = Math.floor(rect.height * this.dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  private loop(time: number) {
    if (!this.running) return;
    const dt = Math.min(0.033, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.updateBubbles(dt);
    this.updateRipples(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private updateBubbles(dt: number) {
    for (const bubble of this.bubbles) {
      bubble.pos.y -= bubble.speed * dt;
      bubble.pos.x += Math.sin((bubble.pos.y + bubble.radius) * 0.01) * 0.2;
      if (bubble.pos.y < -bubble.radius) {
        bubble.pos.y = this.height + bubble.radius;
        bubble.pos.x = rand(0, this.width);
      }
    }
  }

  private updateRipples(dt: number) {
    for (const ripple of this.ripples) {
      ripple.radius += 120 * dt;
      ripple.alpha -= 0.8 * dt;
    }
    this.ripples = this.ripples.filter((r) => r.alpha > 0.02);
  }

  private render() {
    const you = this.state.you;
    if (!you) return;

    const playerDir = this.estimateDirection(you.id, you.pos);
    const player: RenderPlayer = {
      pos: this.scalePos(you.pos),
      radius: this.scaleRadius(you.radius),
      color: this.skin.body,
      outline: this.skin.outline,
      accent: this.skin.accent,
      name: you.name,
      facingRight: playerDir
    };

    const others: RenderPlayer[] = this.state.players
      .filter((p) => p.id !== you.id && p.alive)
      .map((p) => ({
        pos: this.scalePos(p.pos),
        radius: this.scaleRadius(p.radius),
        color: `hsl(${p.hue}, 80%, 62%)`,
        outline: 'rgba(255,255,255,0.7)',
        accent: `hsla(${p.hue}, 80%, 70%, 0.3)`,
        name: p.name,
        facingRight: this.estimateDirection(p.id, p.pos)
      }));

    const fishes: RenderFish[] = this.state.fishes.map((f) => ({
      id: f.id,
      pos: this.scalePos(f.pos),
      vel: this.scaleVel(f.vel),
      radius: this.scaleRadius(f.radius),
      color: f.tier === 'small' ? '#7cff7c' : f.tier === 'medium' ? '#ffbf47' : '#ff6b6b',
      outline: 'rgba(255,255,255,0.6)'
    }));

    const items: RenderItem[] = this.state.items.map((i) => ({
      pos: this.scalePos(i.pos),
      kind: i.kind,
      ttl: i.ttl
    }));

    const scale = Math.min(1, Math.max(0.8, 1 - (you.radius / 26 - 2) / 8));
    this.renderer.render({
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      player,
      players: others,
      fishes,
      items,
      bubbles: this.bubbles,
      ripples: this.ripples,
      particles: this.particles,
      camera: {
        x: player.pos.x,
        y: player.pos.y,
        scale
      }
    });
  }

  private scalePos(pos: Vec2): Vec2 {
    return { x: (pos.x / WORLD.baseWidth) * this.width, y: (pos.y / WORLD.baseHeight) * this.height };
  }

  private scaleVel(vel: Vec2): Vec2 {
    return { x: (vel.x / WORLD.baseWidth) * this.width, y: (vel.y / WORLD.baseHeight) * this.height };
  }

  private scaleRadius(radius: number) {
    return (radius / WORLD.baseWidth) * this.width;
  }

  private estimateDirection(id: string, pos: Vec2) {
    const last = this.lastPos.get(id);
    this.lastPos.set(id, { ...pos });
    if (!last) return true;
    return pos.x >= last.x;
  }

  private makeBubble(init = false): Bubble {
    return {
      pos: { x: rand(0, this.width), y: init ? rand(0, this.height) : this.height + rand(0, 200) },
      speed: rand(10, 40),
      radius: rand(1.5, 4),
      alpha: rand(0.2, 0.6)
    };
  }
}
