import { Container, Sprite, Texture } from 'pixi.js';

export const PARTICLE_LIMIT = 160;
type Shape = 'soft' | 'chip' | 'bubble';
export interface Spray {
  color: number; count: number; speed?: number; gravity?: number; up?: number;
  life?: number; size?: number; shape?: Shape; tag?: string;
  angle?: number; spread?: number;
}
interface Particle {
  sprite: Sprite; born: number; life: number; x: number; y: number; vx: number; vy: number;
  gravity: number; size: number; spin: number; tag?: string; soft: boolean;
}

/** All sprites are allocated once, shared textures are tiny, and a full pool drops cosmetic particles. */
export class ParticlePool {
  readonly layer = new Container();
  private readonly slots: Particle[];
  private readonly soft: Texture;
  private readonly bubble: Texture;
  private seed = 829;
  constructor() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d')!;
    const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, '#fff'); glow.addColorStop(.25, '#fffffff0'); glow.addColorStop(1, '#ffffff00');
    context.fillStyle = glow; context.fillRect(0, 0, 32, 32); this.soft = Texture.from(canvas);
    const ring = document.createElement('canvas'); ring.width = ring.height = 32;
    const r = ring.getContext('2d')!; r.strokeStyle = '#fff'; r.lineWidth = 3;
    r.beginPath(); r.arc(16, 16, 12, 0, Math.PI * 2); r.stroke(); this.bubble = Texture.from(ring);
    this.slots = Array.from({ length: PARTICLE_LIMIT }, () => {
      const sprite = new Sprite(this.soft); sprite.anchor.set(.5); sprite.visible = false; this.layer.addChild(sprite);
      return { sprite, born: -Infinity, life: 0, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, size: 0, spin: 0, soft: true };
    });
  }
  random(): number {
    this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }
  emit(x: number, y: number, now: number, spray: Spray): void {
    let left = spray.count;
    for (const p of this.slots) {
      if (left <= 0) break;
      if (p.sprite.visible) continue;
      left--;
      const angle = spray.angle === undefined ? this.random() * Math.PI * 2 : spray.angle + (this.random() - .5) * (spray.spread ?? 1);
      const speed = (spray.speed ?? 90) * (.35 + this.random() * .65);
      p.born = now; p.life = (spray.life ?? 650) * (.7 + this.random() * .3);
      p.x = x; p.y = y; p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed - (spray.up ?? 0);
      p.gravity = spray.gravity ?? 120; p.size = (spray.size ?? 7) * (.6 + this.random() * .6);
      p.spin = (this.random() - .5) * 8; p.tag = spray.tag; p.soft = spray.shape !== 'chip';
      p.sprite.texture = spray.shape === 'chip' ? Texture.WHITE : spray.shape === 'bubble' ? this.bubble : this.soft;
      p.sprite.tint = spray.color; p.sprite.visible = true;
    }
  }
  update(now: number): void {
    for (const p of this.slots) {
      if (!p.sprite.visible) continue;
      const age = now - p.born, k = age / p.life, seconds = age / 1000;
      if (k >= 1) { p.sprite.visible = false; continue; }
      p.sprite.position.set(p.x + p.vx * seconds, p.y + p.vy * seconds + p.gravity * seconds * seconds / 2);
      p.sprite.rotation = p.spin * seconds;
      p.sprite.width = p.size * (1 - k * .5); p.sprite.height = p.sprite.width * (p.soft ? 1 : .45);
      p.sprite.alpha = Math.min(1, (1 - k) * 2) * (p.soft ? .85 : 1);
    }
  }
  clear(tag?: string): void {
    for (const p of this.slots) if (!tag || p.tag === tag) p.sprite.visible = false;
  }
  get active(): number { let count = 0; for (const p of this.slots) if (p.sprite.visible) count++; return count; }
  destroy(): void { this.soft.destroy(true); this.bubble.destroy(true); }
}
