import type { Vec2 } from '../../shared/protocol';

export type RenderFish = { id: string; pos: Vec2; radius: number; color: string; outline: string; vel: Vec2 };
export type RenderPlayer = { pos: Vec2; radius: number; color: string; outline: string; accent: string; name?: string; facingRight?: boolean };
export type RenderItem = { pos: Vec2; kind: 'boost' | 'shield' | 'slow' | 'magnet'; ttl: number };
export type Bubble = { pos: Vec2; speed: number; radius: number; alpha: number };
export type Ripple = { pos: Vec2; radius: number; alpha: number };
export type Particle = { pos: Vec2; vel: Vec2; life: number; color: string; size: number };

export type RenderState = {
  width: number;
  height: number;
  dpr: number;
  player: RenderPlayer;
  players: RenderPlayer[];
  fishes: RenderFish[];
  items: RenderItem[];
  bubbles: Bubble[];
  ripples: Ripple[];
  particles: Particle[];
};

type Species = {
  id:
    | 'clown'
    | 'angel'
    | 'puffer'
    | 'blue-tang'
    | 'goldfish'
    | 'turtle'
    | 'seahorse'
    | 'octopus'
    | 'jellyfish'
    | 'crab'
    | 'whale';
  body: 'round' | 'torpedo' | 'disk';
  tail: 'fork' | 'fan' | 'moon' | 'none';
  pattern: 'clown' | 'angel' | 'puffer' | 'tang' | 'gold' | 'turtle' | 'seahorse' | 'octopus' | 'jelly' | 'crab' | 'whale';
  palette: {
    base: string;
    base2: string;
    stripe: string;
    outline: string;
    cheek: string;
  };
};

const SPECIES: Species[] = [
  {
    id: 'clown',
    body: 'torpedo',
    tail: 'fan',
    pattern: 'clown',
    palette: { base: '#ff8b2e', base2: '#ffb563', stripe: '#fff6de', outline: '#2b2b2b', cheek: '#ff8fb0' }
  },
  {
    id: 'angel',
    body: 'disk',
    tail: 'moon',
    pattern: 'angel',
    palette: { base: '#ffd76a', base2: '#ffe8a8', stripe: '#2b2b2b', outline: '#2b2b2b', cheek: '#ff9cc2' }
  },
  {
    id: 'puffer',
    body: 'round',
    tail: 'moon',
    pattern: 'puffer',
    palette: { base: '#f7f0a6', base2: '#fff6cf', stripe: '#6b6b6b', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'blue-tang',
    body: 'disk',
    tail: 'fork',
    pattern: 'tang',
    palette: { base: '#2f84ff', base2: '#6bb4ff', stripe: '#142a6a', outline: '#1f1f1f', cheek: '#ffa0be' }
  },
  {
    id: 'goldfish',
    body: 'round',
    tail: 'fan',
    pattern: 'gold',
    palette: { base: '#ffb55a', base2: '#ffd9a2', stripe: '#ff7b4a', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'turtle',
    body: 'disk',
    tail: 'none',
    pattern: 'turtle',
    palette: { base: '#6ac46a', base2: '#a8e4a8', stripe: '#2f7c2f', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'seahorse',
    body: 'torpedo',
    tail: 'none',
    pattern: 'seahorse',
    palette: { base: '#ffb3c6', base2: '#ffd9e4', stripe: '#ff7b9f', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'octopus',
    body: 'round',
    tail: 'none',
    pattern: 'octopus',
    palette: { base: '#a894ff', base2: '#cbbdff', stripe: '#7a5ad6', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'jellyfish',
    body: 'round',
    tail: 'none',
    pattern: 'jelly',
    palette: { base: '#9ee8ff', base2: '#d7f6ff', stripe: '#6ac7e6', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'crab',
    body: 'round',
    tail: 'none',
    pattern: 'crab',
    palette: { base: '#ff8f8f', base2: '#ffc1c1', stripe: '#ff5f5f', outline: '#2b2b2b', cheek: '#ff9bb7' }
  },
  {
    id: 'whale',
    body: 'torpedo',
    tail: 'moon',
    pattern: 'whale',
    palette: { base: '#5aa6ff', base2: '#99caff', stripe: '#2e5d9b', outline: '#2b2b2b', cheek: '#ff9bb7' }
  }
];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private lastTime = performance.now();
  private time = 0;
  private shakeTime = 0;
  private shakeIntensity = 0;
  private ambient: { x: number; y: number; speed: number; alpha: number; size: number }[] = [];
  private ambientSize = { w: 0, h: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  shake(intensity = 6) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = 0.25;
  }

  render(state: RenderState) {
    const ctx = this.ctx;
    const now = performance.now();
    const dt = Math.min(0.033, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;

    ctx.clearRect(0, 0, state.width, state.height);

    const shakeOffset = this.getShakeOffset(dt);
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    this.renderBackground(state);
    this.renderRipples(state);
    this.updateAmbient(state, dt);
    this.renderAmbient(state);
    this.renderParticles(state);

    for (const fish of state.fishes) {
      this.renderFish(fish, fish.vel.x >= 0);
    }

    for (const item of state.items) {
      this.renderItem(item);
    }

    for (const player of state.players) {
      this.renderPlayer(player, player.facingRight ?? true);
    }

    this.renderPlayer(state.player, state.player.facingRight ?? true, true);
    ctx.restore();
  }

  private getShakeOffset(dt: number) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const t = this.time * 30;
      const k = this.shakeIntensity * (this.shakeTime / 0.25);
      return { x: Math.sin(t * 1.3) * k, y: Math.cos(t * 1.7) * k };
    }
    this.shakeIntensity = 0;
    return { x: 0, y: 0 };
  }

  private renderBackground(state: RenderState) {
    const ctx = this.ctx;
    const { width, height } = state;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#bde9ff');
    gradient.addColorStop(0.35, '#7ad2ff');
    gradient.addColorStop(0.7, '#2f7fb4');
    gradient.addColorStop(1, '#1f5073');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // cartoon light rays
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 6; i++) {
      const x = (width * (i + 0.5)) / 6 + Math.sin(this.time * 0.6 + i) * 20;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x - 140, 0);
      ctx.lineTo(x + 140, 0);
      ctx.lineTo(x + 260, height);
      ctx.lineTo(x - 20, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // waves
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let y = height * 0.15; y < height * 0.55; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(this.time * 1.2 + y * 0.02) * 4);
      for (let x = 0; x <= width; x += 80) {
        ctx.quadraticCurveTo(x + 20, y - 10, x + 40, y + Math.sin(this.time * 1.2 + x * 0.02) * 4);
      }
      ctx.stroke();
    }
    ctx.restore();

    // sand + coral
    const sand = ctx.createLinearGradient(0, height * 0.75, 0, height);
    sand.addColorStop(0, 'rgba(255, 230, 170, 0.3)');
    sand.addColorStop(1, 'rgba(255, 210, 140, 0.9)');
    ctx.fillStyle = sand;
    ctx.fillRect(0, height * 0.75, width, height * 0.25);

    // cartoon coral
    ctx.save();
    ctx.fillStyle = '#ff9dbb';
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = (width * (i + 0.3)) / 6;
      const base = height * 0.88;
      ctx.beginPath();
      ctx.moveTo(x, base + 30);
      ctx.quadraticCurveTo(x - 20, base - 30, x - 5, base - 70);
      ctx.quadraticCurveTo(x + 15, base - 30, x + 10, base + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    for (const bubble of state.bubbles) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255, ${bubble.alpha})`;
      ctx.arc(bubble.pos.x, bubble.pos.y, bubble.radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${bubble.alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.arc(bubble.pos.x - bubble.radius * 0.3, bubble.pos.y - bubble.radius * 0.3, bubble.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // vignette
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.4, width * 0.2, width * 0.5, height * 0.6, width * 0.9);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(0,60,90,0.25)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private renderFish(fish: RenderFish, facingRight: boolean) {
    const key = this.hashString(fish.id);
    const species = this.pickSpeciesByKey(key);
    const variant = this.variantPaletteByKey(species, key);
    this.renderFishBody(
      fish.pos,
      fish.radius,
      variant,
      species.body,
      species.tail,
      species.pattern,
      facingRight,
      false
    );
  }

  private renderPlayer(player: RenderPlayer, facingRight: boolean, glow = false) {
    this.renderFishBody(
      player.pos,
      player.radius,
      {
        base: player.color,
        base2: player.accent,
        stripe: '#ffffff',
        outline: '#2b2b2b',
        cheek: '#ff9bb7'
      },
      'torpedo',
      'fan',
      'gold',
      facingRight,
      glow,
      player.name
    );
  }

  private hash(n: number) {
    let x = Math.sin(n) * 10000;
    return x - Math.floor(x);
  }

  private pickSpeciesByKey(seed: number): Species {
    const idx = Math.floor(this.hash(seed) * SPECIES.length) % SPECIES.length;
    return SPECIES[idx] ?? SPECIES[0];
  }

  private variantPaletteByKey(species: Species, seed: number): Species['palette'] {
    const t = this.hash(seed + 101.7);
    const shift = (t - 0.5) * 18; // -9 ~ +9
    const brighten = (t - 0.5) * 0.08;
    const tweak = (hex: string) => this.tuneColor(hex, shift, brighten);
    return {
      base: tweak(species.palette.base),
      base2: tweak(species.palette.base2),
      stripe: tweak(species.palette.stripe),
      outline: species.palette.outline,
      cheek: species.palette.cheek
    };
  }

  private hashString(input: string) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private tuneColor(hex: string, hueShift: number, bright: number) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    let [h, s, l] = this.rgbToHsl(r, g, b);
    h = (h + hueShift + 360) % 360;
    l = Math.min(1, Math.max(0, l + bright));
    const [nr, ng, nb] = this.hslToRgb(h, s, l);
    return `rgb(${nr}, ${ng}, ${nb})`;
  }

  private rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }
    return [h, s, l] as const;
  }

  private hslToRgb(h: number, s: number, l: number) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ] as const;
  }

  private renderFishBody(
    pos: Vec2,
    radius: number,
    palette: Species['palette'],
    body: Species['body'],
    tail: Species['tail'],
    pattern: Species['pattern'],
    facingRight: boolean,
    glow: boolean,
    name?: string
  ) {
    const ctx = this.ctx;
    const { x, y } = pos;
    const r = radius;
    const length = body === 'round' ? r * 1.1 : body === 'disk' ? r * 1.0 : r * 1.5;
    const height = body === 'disk' ? r * 1.35 : r;
    const outline = palette.outline;

    const wag = Math.sin(this.time * 6 + x * 0.01 + y * 0.01) * r * 0.06;
    const bob = Math.sin(this.time * 2 + x * 0.02) * r * 0.04;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(facingRight ? 1 : -1, 1);

    if (glow) {
      ctx.beginPath();
      ctx.fillStyle = palette.base2;
      ctx.globalAlpha = 0.2;
      ctx.ellipse(0, 0, r * 1.8, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // body (flat + outline)
    ctx.beginPath();
    ctx.fillStyle = palette.base;
    ctx.ellipse(0, 0, length, height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = outline;
    ctx.stroke();

    // belly tint
    ctx.beginPath();
    ctx.fillStyle = palette.base2;
    ctx.ellipse(r * 0.1, r * 0.2, length * 0.7, height * 0.6, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // pattern by species
    if (pattern === 'clown') {
      ctx.fillStyle = palette.stripe;
      for (const k of [-0.45, 0.0, 0.45]) {
        ctx.beginPath();
        ctx.ellipse(k * length * 0.9, 0, r * 0.2, height * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (pattern === 'angel') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.1);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-length + i * r * 0.3, -height);
        ctx.lineTo(-length * 0.1 + i * r * 0.3, height);
        ctx.stroke();
      }
    } else if (pattern === 'puffer') {
      ctx.fillStyle = palette.stripe;
      for (let i = 0; i < 8; i++) {
        const sx = -length * 0.5 + (i % 4) * r * 0.5;
        const sy = -height * 0.3 + Math.floor(i / 4) * r * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'tang') {
      ctx.fillStyle = palette.stripe;
      ctx.beginPath();
      ctx.moveTo(-length * 0.2, -height * 0.8);
      ctx.lineTo(length * 0.9, -height * 0.1);
      ctx.lineTo(length * 0.3, height * 0.7);
      ctx.lineTo(-length * 0.3, height * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'gold') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.arc(-length * 0.1, 0, r * 0.8, -0.3, Math.PI * 0.5);
      ctx.stroke();
    } else if (pattern === 'turtle') {
      ctx.fillStyle = palette.stripe;
      ctx.beginPath();
      ctx.ellipse(-length * 0.1, 0, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'seahorse') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-length * 0.2, -height * 0.4);
      ctx.quadraticCurveTo(r * 0.2, 0, -length * 0.1, height * 0.4);
      ctx.stroke();
    } else if (pattern === 'octopus') {
      ctx.fillStyle = palette.stripe;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * r * 0.25, r * 0.4, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'jelly') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.07);
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.6, 0, Math.PI);
      ctx.stroke();
    } else if (pattern === 'crab') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.1);
      ctx.lineTo(-r * 0.9, -r * 0.4);
      ctx.moveTo(r * 0.6, -r * 0.1);
      ctx.lineTo(r * 0.9, -r * 0.4);
      ctx.stroke();
    } else if (pattern === 'whale') {
      ctx.fillStyle = palette.stripe;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, length * 0.8, height * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'seahorse') {
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.arc(-length * 0.55, r * 0.35, r * 0.35, 0, Math.PI * 1.4);
      ctx.stroke();
    }

    // tail
    if (tail !== 'none') {
      ctx.beginPath();
      ctx.fillStyle = palette.base;
      ctx.moveTo(-length, 0);
      if (tail === 'fork') {
        ctx.lineTo(-length - r * 0.7, -r * 0.5 + wag);
        ctx.lineTo(-length - r * 0.4, 0 + wag * 0.4);
        ctx.lineTo(-length - r * 0.7, r * 0.5 + wag);
      } else if (tail === 'moon') {
        ctx.quadraticCurveTo(-length - r * 0.9, -r * 0.6 + wag, -length - r * 0.2, 0 + wag * 0.4);
        ctx.quadraticCurveTo(-length - r * 0.9, r * 0.6 + wag, -length, 0);
      } else {
        ctx.lineTo(-length - r * 0.8, -r * 0.7 + wag);
        ctx.lineTo(-length - r * 0.6, 0 + wag * 0.4);
        ctx.lineTo(-length - r * 0.8, r * 0.7 + wag);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // fin
    ctx.beginPath();
    ctx.fillStyle = palette.base2;
    ctx.moveTo(-r * 0.1, -height * 0.9 + wag);
    ctx.quadraticCurveTo(r * 0.2, -height * 1.25 + wag, r * 0.5, -height * 0.6 + wag);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (pattern === 'turtle') {
      // flippers
      ctx.beginPath();
      ctx.fillStyle = palette.base2;
      ctx.ellipse(-length * 0.2, r * 0.6, r * 0.35, r * 0.18, 0.3, 0, Math.PI * 2);
      ctx.ellipse(length * 0.1, r * 0.5, r * 0.35, r * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'jelly') {
      // tentacles
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.06);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.18, r * 0.7);
        ctx.quadraticCurveTo(i * r * 0.25, r * 1.05, i * r * 0.12, r * 1.35);
        ctx.stroke();
      }
    } else if (pattern === 'octopus') {
      // tentacles
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.2, r * 0.6);
        ctx.quadraticCurveTo(i * r * 0.25, r * 1.0, i * r * 0.12, r * 1.3);
        ctx.stroke();
      }
    } else if (pattern === 'crab') {
      // legs
      ctx.strokeStyle = palette.stripe;
      ctx.lineWidth = Math.max(2, r * 0.08);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.25, r * 0.5);
        ctx.lineTo(i * r * 0.4, r * 0.8);
        ctx.stroke();
      }
    }

    // eye (big + cute)
    const blink = 1;
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.ellipse(r * 0.6, -r * 0.15, r * 0.28, r * 0.28 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = '#2b2b2b';
    ctx.ellipse(r * 0.64, -r * 0.15, r * 0.12, r * 0.12 * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(r * 0.68, -r * 0.2, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // smile
    ctx.beginPath();
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.arc(r * 0.35, r * 0.1, r * 0.2, 0.1, Math.PI * 0.9);
    ctx.stroke();

    // cheek
    ctx.beginPath();
    ctx.fillStyle = palette.cheek;
    ctx.ellipse(r * 0.35, r * 0.2, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (name) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "ZCOOL KuaiLe", "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y - r - 10);
    }
  }

  private renderItem(item: RenderItem) {
    const ctx = this.ctx;
    const color = item.kind === 'boost' ? '#7cff7c' : item.kind === 'shield' ? '#76fff4' : item.kind === 'slow' ? '#ffbf47' : '#b784ff';
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, item.ttl / 6);
    ctx.arc(item.pos.x, item.pos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // icon
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (item.kind === 'boost') {
      ctx.moveTo(item.pos.x - 3, item.pos.y + 2);
      ctx.lineTo(item.pos.x + 4, item.pos.y);
      ctx.lineTo(item.pos.x - 3, item.pos.y - 2);
    } else if (item.kind === 'shield') {
      ctx.moveTo(item.pos.x - 3, item.pos.y - 3);
      ctx.lineTo(item.pos.x + 3, item.pos.y - 3);
      ctx.lineTo(item.pos.x + 3, item.pos.y + 1);
      ctx.lineTo(item.pos.x, item.pos.y + 4);
      ctx.lineTo(item.pos.x - 3, item.pos.y + 1);
      ctx.closePath();
    } else if (item.kind === 'slow') {
      ctx.arc(item.pos.x, item.pos.y, 3, 0, Math.PI * 1.5);
    } else {
      ctx.moveTo(item.pos.x - 3, item.pos.y - 2);
      ctx.lineTo(item.pos.x - 3, item.pos.y + 2);
      ctx.moveTo(item.pos.x + 3, item.pos.y - 2);
      ctx.lineTo(item.pos.x + 3, item.pos.y + 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderRipples(state: RenderState) {
    const ctx = this.ctx;
    for (const ripple of state.ripples) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255, ${ripple.alpha})`;
      ctx.lineWidth = 3 * state.dpr;
      ctx.arc(ripple.pos.x, ripple.pos.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private updateAmbient(state: RenderState, dt: number) {
    if (this.ambientSize.w !== state.width || this.ambientSize.h !== state.height) {
      this.ambient = [];
      this.ambientSize = { w: state.width, h: state.height };
      const count = Math.floor((state.width * state.height) / 50000);
      for (let i = 0; i < count; i++) {
        this.ambient.push({
          x: Math.random() * state.width,
          y: Math.random() * state.height,
          speed: 6 + Math.random() * 14,
          alpha: 0.08 + Math.random() * 0.12,
          size: 1 + Math.random() * 2.5
        });
      }
    }

    for (const p of this.ambient) {
      p.y -= p.speed * dt;
      p.x += Math.sin(this.time * 0.5 + p.y * 0.01) * 0.2;
      if (p.y < -10) {
        p.y = state.height + 10;
        p.x = Math.random() * state.width;
      }
    }
  }

  private renderAmbient(state: RenderState) {
    const ctx = this.ctx;
    for (const p of this.ambient) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderParticles(state: RenderState) {
    const ctx = this.ctx;
    for (const p of state.particles) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
