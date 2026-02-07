import type { Vec2 } from '../../shared/protocol';
import { LEVELS } from '../../shared/constants';
import { clamp, lerp, rand } from './utils';
import { Renderer, type Bubble, type Particle, type RenderFish, type RenderItem, type RenderPlayer, type Ripple } from './renderer';
import type { Skin } from './skins';
import type { Achievement } from './achievements';
import type { Quest } from './quests';
import { AudioManager } from './audio';

export type LocalGameEvents = {
  onScore: (score: number, size: number, level: number) => void;
  onQuest: (quest: Quest) => void;
  onAchievement: (achievement: Achievement) => void;
  onGameOver: (reason: string) => void;
};

export type LocalGameOptions = {
  renderer: Renderer;
  skin: Skin;
  audio: AudioManager;
  achievements: Achievement[];
  quests: Quest[];
  onEvents: LocalGameEvents;
};

type PlayerState = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  shield: number;
  boost: number;
  magnet: number;
};

let idSeed = 0;
const nextId = () => `${Date.now()}-${idSeed++}`;

export class LocalGame {
  private running = false;
  private lastTime = 0;
  private player: PlayerState;
  private fishes: RenderFish[] = [];
  private items: RenderItem[] = [];
  private bubbles: Bubble[] = [];
  private ripples: Ripple[] = [];
  private particles: Particle[] = [];
  private score = 0;
  private level = 1;
  private spawnTimer = 0;
  private spawnInterval = 0.9;
  private maxRadius = 120;
  private target: Vec2 = { x: 0, y: 0 };
  private width = 0;
  private height = 0;
  private dpr = 1;
  private survival = 0;
  private smallEaten = 0;

  constructor(private canvas: HTMLCanvasElement, private options: LocalGameOptions) {
    this.player = {
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 26,
      shield: 0,
      boost: 0,
      magnet: 0
    };
    this.resize();
    this.reset();
    window.addEventListener('resize', () => this.resize());
  }

  setSkin(skin: Skin) {
    this.options.skin = skin;
  }

  setQuests(quests: Quest[]) {
    this.options.quests = quests;
  }

  setTarget(target: Vec2) {
    this.target = target;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.options.audio.init();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.score = 0;
    this.level = 1;
    this.spawnTimer = 0;
    this.spawnInterval = 0.9;
    this.fishes = [];
    this.items = [];
    this.ripples = [];
    this.particles = [];
    this.bubbles = [];
    this.survival = 0;
    this.smallEaten = 0;
    this.player = {
      pos: { x: this.width * 0.5, y: this.height * 0.6 },
      vel: { x: 0, y: 0 },
      radius: 26,
      shield: 0,
      boost: 0,
      magnet: 0
    };
    this.target = { ...this.player.pos };
    for (let i = 0; i < 40; i++) this.bubbles.push(this.makeBubble(true));
    this.emitScore();
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
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    this.survival += dt;
    this.updatePlayer(dt);
    this.updateBubbles(dt);
    this.updateFishes(dt);
    this.updateItems(dt);
    this.updateRipples(dt);
    this.updateParticles(dt);
    this.updateLevel();

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnFish();
      const itemChance = 0.18 + this.level * 0.02;
      if (Math.random() < itemChance) this.spawnItem();
    }

    this.checkAchievements();
  }

  private updatePlayer(dt: number) {
    const player = this.player;
    const dx = this.target.x - player.pos.x;
    const dy = this.target.y - player.pos.y;
    const dist = Math.hypot(dx, dy);
    const maxSpeed = 320 + player.radius * 1.5 + (player.boost > 0 ? 120 : 0);
    if (dist > 1) {
      const speed = clamp(dist * 2.4, 120, maxSpeed);
      player.vel.x = (dx / dist) * speed;
      player.vel.y = (dy / dist) * speed;
    } else {
      player.vel.x = lerp(player.vel.x, 0, 0.2);
      player.vel.y = lerp(player.vel.y, 0, 0.2);
    }

    player.pos.x = clamp(player.pos.x + player.vel.x * dt, player.radius, this.width - player.radius);
    player.pos.y = clamp(player.pos.y + player.vel.y * dt, player.radius, this.height - player.radius);

    player.boost = Math.max(0, player.boost - dt);
    player.shield = Math.max(0, player.shield - dt);
    player.magnet = Math.max(0, player.magnet - dt);
  }

  private updateFishes(dt: number) {
    for (const fish of this.fishes) {
      fish.pos.x += fish.vel.x * dt;
      fish.pos.y += fish.vel.y * dt;

      if (this.player.magnet > 0 && fish.radius < this.player.radius * 0.7) {
        const dx = this.player.pos.x - fish.pos.x;
        const dy = this.player.pos.y - fish.pos.y;
        fish.pos.x += dx * dt * 0.6;
        fish.pos.y += dy * dt * 0.6;
      }
    }

    this.fishes = this.fishes.filter(
      (fish) =>
        fish.pos.x > -fish.radius * 2 &&
        fish.pos.x < this.width + fish.radius * 2 &&
        fish.pos.y > -fish.radius * 2 &&
        fish.pos.y < this.height + fish.radius * 2
    );

    for (let i = this.fishes.length - 1; i >= 0; i--) {
      const fish = this.fishes[i];
      const speed = Math.hypot(this.player.vel.x, this.player.vel.y);
      const dirX = speed > 10 ? this.player.vel.x / speed : 0;
      const dirY = speed > 10 ? this.player.vel.y / speed : 0;
      const headX = this.player.pos.x + dirX * this.player.radius * 0.35;
      const headY = this.player.pos.y + dirY * this.player.radius * 0.35;
      const dx = fish.pos.x - headX;
      const dy = fish.pos.y - headY;
      const dist = Math.hypot(dx, dy);
      if (dist < (fish.radius + this.player.radius) * 0.85) {
        if (fish.radius <= this.player.radius * 0.95) {
          this.consumeFish(i, fish);
        } else if (this.player.shield > 0) {
          this.player.shield = 0;
          this.fishes.splice(i, 1);
          this.ripples.push({ pos: { ...fish.pos }, radius: fish.radius * 0.8, alpha: 0.7 });
          this.spawnParticles(fish.pos, fish.color, 10);
          this.options.renderer.shake(6);
          this.options.audio.playSfx('hit');
        } else {
          this.options.audio.playSfx('hit');
          this.options.renderer.shake(10);
          this.options.onEvents.onGameOver('eaten');
          this.stop();
          return;
        }
      }
    }
  }

  private consumeFish(index: number, fish: RenderFish) {
    this.fishes.splice(index, 1);
    const baseRadius = Number.isFinite(fish.radius) ? fish.radius : 10;
    const gained = Math.max(1, Math.round(baseRadius * 2));
    this.score += gained;
    const growth = fish.radius * fish.radius * 0.45;
    const softness = clamp(1 - (this.player.radius - 60) / 120, 0.25, 1);
    const next = Math.sqrt(this.player.radius * this.player.radius + growth * softness);
    this.player.radius = Math.min(this.maxRadius, next);
    this.ripples.push({ pos: { ...fish.pos }, radius: fish.radius * 0.6, alpha: 0.7 });
    this.spawnParticles(fish.pos, fish.color, 14);
    this.options.renderer.shake(4);
    this.options.audio.playSfx('eat');
    this.smallEaten += fish.radius < 18 ? 1 : 0;
    this.updateQuests(fish);
    this.emitScore();
  }

  private updateItems(dt: number) {
    for (const item of this.items) {
      item.ttl -= dt;
    }
    this.items = this.items.filter((item) => item.ttl > 0);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const dx = item.pos.x - this.player.pos.x;
      const dy = item.pos.y - this.player.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.player.radius + 10) {
        this.items.splice(i, 1);
        this.applyItem(item.kind);
      }
    }
  }

  private applyItem(kind: RenderItem['kind']) {
    if (kind === 'boost') this.player.boost = 4;
    if (kind === 'shield') this.player.shield = 6;
    if (kind === 'slow') this.fishes.forEach((f) => (f.vel.x *= 0.6));
    if (kind === 'magnet') this.player.magnet = 5;
    this.spawnParticles(this.player.pos, '#ffffff', 8);
    this.options.renderer.shake(3);
    this.options.audio.playSfx('power');
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

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.vel.x *= 0.98;
      p.vel.y *= 0.98;
      p.life -= dt * 1.6;
    }
    this.particles = this.particles.filter((p) => p.life > 0.02);
  }

  private updateLevel() {
    const lvl = LEVELS.reduce((acc, cur, idx) => (this.score >= cur.score ? idx + 1 : acc), 1);
    if (lvl !== this.level) {
      this.level = lvl;
      this.options.audio.playSfx('level');
      this.emitScore();
    }
    const config = LEVELS[this.level - 1] ?? LEVELS[LEVELS.length - 1];
    this.spawnInterval = config.spawnInterval;
  }

  private updateQuests(fish: RenderFish) {
    for (const quest of this.options.quests) {
      if (quest.done) continue;
      if (quest.id === 'eat-5') quest.progress += 1;
      if (quest.id === 'score-300') quest.progress = this.score;
      if (quest.id === 'size-2') quest.progress = this.player.radius / 26;
      if (quest.progress >= quest.target) {
        quest.done = true;
        this.options.onEvents.onQuest(quest);
      }
    }
  }

  private checkAchievements() {
    const list = this.options.achievements;
    for (const ach of list) {
      if (ach.unlocked) continue;
      if (ach.id === 'first-eat' && this.score > 0) ach.unlocked = true;
      if (ach.id === 'size-2' && this.player.radius / 26 >= 2) ach.unlocked = true;
      if (ach.id === 'size-3' && this.player.radius / 26 >= 3) ach.unlocked = true;
      if (ach.id === 'score-500' && this.score >= 500) ach.unlocked = true;
      if (ach.id === 'survive-180' && this.survival >= 180) ach.unlocked = true;
      if (ach.unlocked) this.options.onEvents.onAchievement(ach);
    }
  }

  private spawnFish() {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const base = this.player.radius;
    const scale = rand(0.55, 2.2);
    const radius = clamp(base * scale, 10, 130);
    const speed = clamp(220 - radius * 0.6, 80, 220) * (1 + this.level * 0.03);
    const y = rand(radius, this.height - radius);
    const x = side === 'left' ? -radius * 1.2 : this.width + radius * 1.2;
    const vx = side === 'left' ? speed : -speed;
    const color = scale <= 1 ? '#7cff7c' : scale < 1.4 ? '#ffbf47' : '#ff6b6b';
    const outline = 'rgba(255,255,255,0.6)';
    this.fishes.push({ id: nextId(), pos: { x, y }, vel: { x: vx, y: rand(-20, 20) }, radius, color, outline });
  }

  private spawnItem() {
    const kinds: RenderItem['kind'][] = ['boost', 'shield', 'slow', 'magnet'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    this.items.push({
      pos: { x: rand(60, this.width - 60), y: rand(60, this.height - 60) },
      kind,
      ttl: 8
    });
  }

  private spawnParticles(pos: Vec2, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        pos: { x: pos.x, y: pos.y },
        vel: { x: rand(-120, 120), y: rand(-120, 120) },
        life: rand(0.4, 0.9),
        color,
        size: rand(2, 4)
      });
    }
  }

  private makeBubble(init = false): Bubble {
    return {
      pos: { x: rand(0, this.width), y: init ? rand(0, this.height) : this.height + rand(0, 200) },
      speed: rand(10, 40),
      radius: rand(1.5, 4),
      alpha: rand(0.2, 0.6)
    };
  }

  private emitScore() {
    if (!Number.isFinite(this.score)) this.score = 0;
    const size = this.player.radius / 26;
    this.options.onEvents.onScore(this.score, Number.isFinite(size) ? size : 1, this.level);
  }

  private render() {
    const skin = this.options.skin;
    const player: RenderPlayer = {
      pos: this.player.pos,
      radius: this.player.radius,
      color: skin.body,
      outline: skin.outline,
      accent: skin.accent,
      facingRight: this.player.vel.x >= 0
    };

    this.options.renderer.render({
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      player,
      players: [],
      fishes: this.fishes,
      items: this.items,
      bubbles: this.bubbles,
      ripples: this.ripples,
      particles: this.particles,
      camera: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        scale: clamp(1 - (this.player.radius - 50) / 300, 0.8, 1)
      }
    });
  }
}
