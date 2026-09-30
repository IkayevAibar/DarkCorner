import { Container, Graphics } from 'pixi.js';
import type { FightEventView } from '@dark/shared';
import type { Frame } from './replay';
import type { Cue } from './choreography';
import type { Spray } from './particles';

interface EffectToken {
  root: Container; art: Container; halo: Graphics; flash: Graphics;
  x: number; y: number; radius: number;
}
const EMBER = 0xe6552b, FIRE = 0xffbd65, MARK = 0xc4e594;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** One persistent drawing, owned by the stage. Uses its playback clock and existing particle pool. */
export class ClassEffects {
  private readonly ink = new Graphics();
  private emitted = false;
  private emberAt = 0;
  private frame: Frame | null = null;
  private before: Frame | null = null;
  private event: FightEventView | null = null;
  private cue: Cue | null = null;
  private calm = false;

  constructor(world: Container, private tokens: Map<string, EffectToken>, private spray: (x: number, y: number, spray: Spray) => void) {
    world.addChild(this.ink);
  }

  show(frame: Frame, before: Frame, event: FightEventView | null, cue: Cue, calm: boolean) {
    this.frame = frame; this.before = before; this.event = event; this.cue = cue; this.calm = calm;
    this.emitted = false; this.ink.clear();
  }

  /** Called after lunges and impacts, so the aura and reticle follow the painted tokens. Returns camera weight. */
  draw(time: number, worldTime: number): number {
    this.ink.clear();
    const frame = this.frame, event = this.event, cue = this.cue, hero = this.tokens.get('hero');
    if (!frame || !cue || !hero || event?.type === 'end') return 0;
    const active = frame.raging && !frame.fighters.hero?.fallen && !frame.fighters.hero?.fled;
    const age = time - cue.contact;
    if (active) {
      const strike = event?.type === 'attack' && event.actor === 'hero';
      const pulse = !this.calm && strike ? Math.max(0, 1 - Math.abs(age) / 320) : 0;
      const r = hero.radius + 8 + pulse * 11;
      hero.halo.circle(0, 0, r + 5).stroke({ color: EMBER, width: 18 + pulse * 8, alpha: .14 + pulse * .16 })
        .circle(0, 0, r).stroke({ color: EMBER, width: 4, alpha: .8 })
        .circle(0, 0, r - 3).stroke({ color: FIRE, width: 1.5, alpha: .6 });
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const flicker = this.calm ? .5 : .5 + .5 * Math.sin(worldTime / 190 + i * 2.3);
        hero.halo.arc(0, 0, r + 4 + flicker * 4, angle, angle + .16 + flicker * .2)
          .stroke({ color: FIRE, width: 2, alpha: .3 + flicker * .4 });
      }
      if (!this.calm && worldTime >= this.emberAt) {
        this.emberAt = worldTime + 110;
        this.spray(hero.root.x, hero.root.y + hero.radius * .6,
          { color: EMBER, count: 2, speed: 45, up: 90, gravity: -25, size: 7, life: 700, shape: 'chip', tag: 'rage' });
      }
    }
    this.mark(time, worldTime);
    if (this.calm) return 0;

    if (event?.type === 'attack' && event.hit && event.target === frame.marked && age >= 0) {
      const target = this.tokens.get(event.target);
      if (target) {
        if (!this.emitted) { this.emitted = true; this.spray(target.root.x, target.root.y, { color: MARK, count: 9, shape: 'chip', speed: 160, gravity: 0, size: 7, life: 400 }); }
        const p = clamp(age / 330), r = 10 + p * 32;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4;
          this.ink.moveTo(target.root.x + Math.cos(a) * 8, target.root.y + Math.sin(a) * 8)
            .lineTo(target.root.x + Math.cos(a) * r, target.root.y + Math.sin(a) * r).stroke({ color: MARK, width: 3, alpha: 1 - p }); }
      }
    }
    if (event?.type !== 'feature') return 0;
    if (event.feature === 'relentless' && time < cue.contact) {
      const p = clamp(time / cue.contact);
      hero.art.rotation = -.32 * Math.sin(p * Math.PI);
      hero.art.y += Math.sin(p * Math.PI) * 17;
      hero.art.scale.y *= 1 - Math.sin(p * Math.PI) * .12;
    }
    if ((event.feature === 'rage' || event.feature === 'relentless') && age >= 0) {
      const relentless = event.feature === 'relentless';
      const p = clamp(age / (relentless ? 650 : 830));
      if (!this.emitted) {
        this.emitted = true;
        this.spray(hero.x, hero.y + (relentless ? 28 : 0), { color: FIRE, count: relentless ? 34 : 48,
          speed: relentless ? 160 : 240, up: 80, gravity: -25, size: 11, shape: 'chip', life: 750, tag: 'rage' });
      }
      const r = hero.radius + (1 - (1 - p) ** 3) * (relentless ? 110 : 170);
      this.ink.ellipse(hero.x, hero.y + (relentless ? 25 : 0), r, r * (relentless ? .38 : .8))
        .stroke({ color: EMBER, width: 10 * (1 - p) + 1, alpha: (1 - p) * .85 });
      this.ink.circle(hero.x, hero.y, hero.radius + p * 90)
        .stroke({ color: FIRE, width: 3, alpha: (1 - p) * .7 });
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5, inner = hero.radius + p * 80, outer = inner + (1 - p) * 48;
        this.ink.moveTo(hero.x + Math.cos(a) * inner, hero.y + Math.sin(a) * inner)
          .lineTo(hero.x + Math.cos(a) * outer, hero.y + Math.sin(a) * outer).stroke({ color: EMBER, width: 3, alpha: (1 - p) * .8 });
      }
      hero.flash.tint = EMBER; hero.flash.alpha = Math.max(0, 1 - age / 240) * .48;
      hero.art.scale.set(1 + Math.sin(p * Math.PI) * (relentless ? .07 : .12));
      return (relentless ? 10 : 17) * Math.max(0, 1 - age / 360) ** 2;
    }
    return 0;
  }

  private mark(time: number, worldTime: number) {
    const frame = this.frame!, cue = this.cue!;
    const target = frame.marked ? this.tokens.get(frame.marked) : undefined;
    if (!target) return;
    const moving = this.event?.type === 'feature' && this.event.feature === 'mark';
    const old = moving && this.before?.marked ? this.tokens.get(this.before.marked) : undefined;
    const p = this.calm || !moving ? 1 : clamp(time / Math.max(1, cue.contact));
    const smooth = p * p * (3 - 2 * p);
    const x = old ? old.root.x + (target.root.x - old.root.x) * smooth : target.root.x;
    const y = old ? old.root.y + (target.root.y - old.root.y) * smooth - Math.sin(p * Math.PI) * 55 : target.root.y;
    const r = (old ? old.radius + (target.radius - old.radius) * smooth : target.radius) + 5 + (!old ? (1 - p) * 30 : 0);
    const angle = this.calm ? 0 : worldTime / 1700;
    // A dark keyline keeps the thin reticle readable over light token art and Room maps.
    for (const [color, width] of [[0x172011, 6], [MARK, 2]] as const) {
      this.ink.circle(x, y, r).stroke({ color, width, alpha: .85 });
      for (let i = 0; i < 4; i++) { const a = angle + i * Math.PI / 2;
        this.ink.moveTo(x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8))
          .lineTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3)).stroke({ color, width: width + 1, alpha: .95 }); }
    }
    if (old && p < 1 && !this.calm) {
      this.ink.moveTo(old.root.x, old.root.y).quadraticCurveTo((old.root.x + x) / 2, Math.min(old.root.y, y) - 25, x, y)
        .stroke({ color: MARK, width: 2, alpha: (1 - p) * .35 });
    }
  }
}
