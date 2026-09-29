import { Application, Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Combatant, Elite, FightEventView, FightReplay } from '@dark/shared';
import type { Frame, Status } from './replay';
import type { Cue } from './choreography';
import { ParticlePool, type Spray } from './particles';

const SIZE = 600, HERO_Y = 446;
const ELITE: Record<Elite, number> = { gilded: 0xc9a24a, frenzied: 0xbd3c35, armored: 0x8aa6b2, vampiric: 0x9563b8, swift: 0x57b7ae };
const STATUS: Record<Status, number> = { burning: 0xef8638, poisoned: 0x9bc954, paralyzed: 0x9cd6e7, frightened: 0xa480c7 };
interface TokenView {
  root: Container; art: Container; hp: Graphics; marks: Graphics; halo: Graphics; flash: Graphics; aura: Graphics;
  x: number; y: number; radius: number; who: Combatant; health: Text; shownHp: number;
}
export interface FightStage {
  show(frame: Frame, event: FightEventView | null, reduced: boolean, cue: Cue): void;
  draw(time: number): void;
  destroy(): void;
}
interface Options {
  host: HTMLElement; replay: FightReplay; names: Record<string, string>;
  map: { src: string; style: { transform?: string } | undefined };
  signal: AbortSignal; miss: string;
}
interface Clip { start: number; length: number; draw: (p: number) => void; node?: Container }
interface Impact { token: TokenView; from: TokenView; at: number; damage: number; crit: boolean; fired: boolean }

/** A single playback clock calls draw. Pixi's own ticker stays stopped, including on pause and at the result. */
export async function createFightStage({ host, replay, names, map, signal, miss }: Options): Promise<FightStage> {
  if (signal.aborted) throw new DOMException('Fight closed', 'AbortError');
  const app = new Application();
  let initialized = false, destroyed = false;
  let observer: ResizeObserver | undefined, pool: ParticlePool | undefined;
  const ownedTextures: Texture[] = [], filters: ColorMatrixFilter[] = [];
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; observer?.disconnect();
    if (initialized) app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    pool?.destroy(); ownedTextures.forEach(t => t.destroy(true)); filters.forEach(f => f.destroy());
  };
  try {
    await app.init({ width: SIZE, height: SIZE, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      preference: ['webgl'], autoStart: false, sharedTicker: false });
    initialized = true;
    if (signal.aborted) throw new DOMException('Fight closed', 'AbortError');
    const fighters = [replay.hero, ...replay.monsters];
    const textures = new Map<string, Texture>();
    await Promise.all([...new Set([map.src, ...fighters.flatMap(f => f.art ? [f.art] : [])])].map(async url => {
      try { textures.set(url, await Assets.load<Texture>(url)); } catch { /* Preserve the painted initial fallback. */ }
    }));
    if (signal.aborted) throw new DOMException('Fight closed', 'AbortError');
    host.appendChild(app.canvas); app.canvas.style.width = app.canvas.style.height = '100%';
    app.canvas.setAttribute('aria-hidden', 'true');
    const viewport = new Container(), camera = new Container(), world = new Container();
    app.stage.addChild(viewport); viewport.addChild(camera); camera.addChild(world);
    camera.pivot.set(300, 300); camera.position.set(300, 300);
    const mapTexture = textures.get(map.src);
    if (mapTexture) {
      const floor = new Sprite(mapTexture); floor.anchor.set(.5); floor.position.set(300, 300); floor.width = floor.height = SIZE;
      floor.tint = 0xb1ada4;
      const transform = map.style?.transform ?? '';
      floor.rotation = Number(/rotate\((\d+)deg\)/.exec(transform)?.[1] ?? 0) * Math.PI / 180;
      if (transform.includes('scaleX(-1)')) floor.scale.x *= -1;
      world.addChild(floor);
    } else world.addChild(new Graphics().rect(0, 0, SIZE, SIZE).fill(0x211e1a));
    const mono = new ColorMatrixFilter(), drain = new ColorMatrixFilter();
    mono.greyscale(1, false); filters.push(mono, drain);
    const tokens = new Map<string, TokenView>();
    const text = (value: string, size: number, color = 0xe6dac4) => new Text({ text: value,
      style: { fontFamily: 'Georgia, serif', fontSize: size, fontWeight: 'bold', fill: color,
        stroke: { color: 0x100d0a, width: 4 }, align: 'center' } });
    const count = replay.monsters.length;
    const makeToken = (who: Combatant, x: number, y: number, diameter: number) => {
      const root = new Container(), art = new Container(), halo = new Graphics(), aura = new Graphics();
      const radius = diameter / 2; root.position.set(x, y); root.addChild(halo, art, aura);
      const ring = who.banner ?? (who.boss ? 0xc9a24a : 0x66574a);
      art.addChild(new Graphics().ellipse(0, 7, radius + 6, radius * .88).fill({ color: 0, alpha: .6 })
        .circle(0, 0, radius).fill(0x14110f).stroke({ color: ring, width: who.boss ? 5 : 3 }));
      const texture = who.art ? textures.get(who.art) : undefined;
      if (texture) {
        const portrait = new Sprite(texture); portrait.anchor.set(.5); portrait.scale.set(diameter * 1.08 / Math.min(texture.width, texture.height));
        const mask = new Graphics().circle(0, 0, radius - 3).fill(0xffffff); art.addChild(portrait, mask); portrait.mask = mask;
      } else { const initial = text((names[who.key] ?? '?').slice(0, 1).toUpperCase(), diameter * .42); initial.anchor.set(.5); art.addChild(initial); }
      const flash = new Graphics().circle(0, 0, radius - 2).fill(0xffffff); flash.alpha = 0; art.addChild(flash);
      const marks = new Graphics(), hp = new Graphics(), health = text('', 23), label = text(names[who.key] ?? who.key, 23);
      health.anchor.set(.5); health.position.set(0, radius + 21); label.anchor.set(.5, 0); label.position.set(0, radius + 38);
      label.style.wordWrap = true; label.style.wordWrapWidth = who.key === 'hero' ? 280 : SIZE / (Math.min(4, count) + .6) - 16;
      label.style.breakWords = true; label.style.lineHeight = 26;
      const plate = new Graphics().roundRect(-label.width / 2 - 6, radius + 35, label.width + 12, label.height + 6, 4).fill({ color: 0x080605, alpha: .86 });
      root.addChild(marks, hp, plate, health, label); world.addChild(root);
      tokens.set(who.key, { root, art, hp, marks, halo, aura, flash, x, y, radius, who, health, shownHp: NaN });
    };
    replay.monsters.forEach((who, i) => {
      const columns = count > 4 ? 3 : Math.max(1, count), row = Math.floor(i / columns), inRow = Math.min(columns, count - row * columns);
      makeToken(who, 300 + ((i % columns) - (inRow - 1) / 2) * (SIZE / (columns + .6)),
        count === 1 && who.boss ? 166 : 133 + row * 128, who.boss && count === 1 ? 188 : count <= 2 ? 108 : count <= 4 ? 84 : 68);
    });
    makeToken(replay.hero, 300, HERO_Y, 104);
    const fx = new Container(); pool = new ParticlePool(); world.addChild(fx, pool.layer);
    const vignetteTexture = (red: boolean) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d')!;
      const gradient = context.createRadialGradient(128, 125, 58, 128, 125, 177);
      gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, red ? '#bd221eee' : '#050303d9');
      context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
      const texture = Texture.from(canvas); ownedTextures.push(texture); return texture;
    };
    const vignette = new Sprite(vignetteTexture(false)), danger = new Sprite(vignetteTexture(true));
    vignette.width = vignette.height = danger.width = danger.height = SIZE; danger.alpha = 0; viewport.addChild(vignette, danger);
    let current: Frame | null = null, previous: Frame | null = null, event: FightEventView | null = null;
    let cue: Cue, reduced = false, lastTime = 0, time = 0, worldTime = 0, airAt = 0, statusAt = 0;
    let clips: Clip[] = [], impacts: Impact[] = [], fired = new Set<string>(), renderedFrames = 0;
    const get = (key: string) => tokens.get(key);
    const once = (key: string, at: number, action: () => void) => {
      if (time >= at && !fired.has(key)) { fired.add(key); action(); }
    };
    const clip = (node: Container | undefined, start: number, length: number, draw: (p: number) => void) => {
      if (node) fx.addChild(node); clips.push({ node, start, length, draw });
    };
    const spray = (x: number, y: number, options: Spray) => { if (!reduced) pool!.emit(x, y, worldTime, options); };
    const ring = (x: number, y: number, color: number, radius: number, at = cue.contact, length = 650) => {
      const g = new Graphics();
      clip(g, at, reduced ? 220 : length, p => {
        g.clear().circle(x, y, reduced ? radius * .5 : 8 + radius * (1 - (1 - p) ** 3))
          .stroke({ color, width: reduced ? 2 : 7 * (1 - p) + 1, alpha: (1 - p) * .8 });
      });
    };
    const number = (token: TokenView, value: string, color: number, at = cue.contact, big = false) => {
      const label = text(value, big ? 42 : 31, color); label.anchor.set(.5);
      clip(label, at, reduced ? 220 : 650, p => { label.position.set(token.x, token.y - 14 - (reduced ? 0 : p * 42)); label.alpha = Math.min(1, (1 - p) * 3); });
    };
    const impact = (from: TokenView, token: TokenView, damage: number, crit = false, at = cue.contact) => {
      impacts.push({ from, token, damage, crit, at, fired: false });
      number(token, '−' + damage, crit ? 0xffd876 : 0xffb5a1, at, crit);
      if (crit) ring(token.x, token.y, 0xffd876, 125, at, 800);
    };
    const fragments = (token: TokenView): Spray => {
      if (token.who.kin === 'undead') return { color: 0xd8cfac, count: 18, shape: 'chip', size: 9, speed: 120, gravity: 190 };
      if (token.who.kin === 'demon' || token.who.kin === 'dragonkin') return { color: 0xffab47, count: 22, size: 11, speed: 145, up: 35, gravity: -25 };
      if (token.who.elite === 'armored' || (token.who.ac >= 16 && (token.who.kin === null || token.who.kin === 'humanoid' || token.who.kin === 'goblinoid')))
        return { color: 0xf6df9b, count: 20, size: 6, shape: 'chip', speed: 200, life: 440 };
      return { color: 0x962f30, count: 14, size: 14, speed: 115, gravity: 170 };
    };
    const heal = (token: TokenView, amount: number | undefined, color: number) => {
      if (amount !== undefined) number(token, '+' + amount, color);
      ring(token.x, token.y, color, token.radius + 35);
      clip(undefined, cue.contact, 650, p => {
        once('heal-' + token.who.key, cue.contact, () => spray(token.x, token.y + token.radius / 2, { color, count: 24, up: 95, speed: 35, gravity: -25, life: 1100, size: 11 }));
        token.flash.tint = color; token.flash.alpha = (1 - p) * .18;
      });
    };
    const projectile = (a: TokenView, x: number, y: number, kind: 'arrow' | 'bolt' | 'fireball' | 'bomb', at = cue.contact) => {
      const g = new Graphics(); let trailAt = -Infinity;
      clip(g, 0, at + 1, p => {
        const arc = kind === 'bomb' ? -170 * Math.sin(p * Math.PI) : 0;
        const px = a.x + (x - a.x) * p, py = a.y + (y - a.y) * p + arc;
        const angle = Math.atan2(y - a.y + (kind === 'bomb' ? -170 * Math.PI * Math.cos(p * Math.PI) : 0), x - a.x);
        g.position.set(px, py); g.rotation = angle; g.clear();
        const color = kind === 'arrow' ? 0xd5c1a0 : kind === 'bolt' ? 0x9bd8ff : 0xff963d;
        if (kind === 'arrow') {
          g.moveTo(-28, 0).lineTo(13, 0).stroke({ color: 0xd7b284, width: 3 });
          g.poly([21, 0, 9, -5, 11, 0, 9, 5]).fill(0xf6ead1);
          g.moveTo(-25, 0).lineTo(-34, -6).moveTo(-21, 0).lineTo(-30, 6).stroke({ color: 0xe6ded1, width: 3 });
        } else if (kind === 'bomb') {
          g.circle(0, 0, 12).fill(0x262026).stroke({ color: 0xaa9270, width: 2 });
          g.moveTo(0, -10).quadraticCurveTo(10, -24, 17, -14).stroke({ color: 0xd9bc7d, width: 3 });
          g.circle(17, -14, 4).fill(0xffce70);
        } else {
          g.ellipse(-5, 0, kind === 'fireball' ? 30 : 24, kind === 'fireball' ? 22 : 10).fill({ color, alpha: .24 });
          g.poly([-30, 0, -2, -9, 15, 0, -2, 9]).fill(color); g.circle(0, 0, kind === 'fireball' ? 14 : 6).fill(0xfff0c9);
        }
        if (time - trailAt >= 25) { trailAt = time; spray(px, py, { color, count: kind === 'arrow' ? 1 : 3, size: kind === 'fireball' ? 20 : 7, speed: 8, gravity: 0, life: 260 }); }
      });
    };
    const radiant = (target: { x: number; y: number }, at = cue.contact, descending = false) => {
      const g = new Graphics();
      clip(g, Math.max(0, at - 150), 600, p => {
        g.clear(); const width = Math.sin(p * Math.PI) * 32;
        const y = target.y * (descending ? Math.min(1, Math.max(0, (time - at + 150) / 150)) ** 2 : 1);
        g.poly([target.x - width, 0, target.x + width, 0, target.x + 6, y, target.x - 6, y]).fill({ color: 0xffe8a0, alpha: (1 - p) * .55 });
        g.moveTo(target.x, 0).lineTo(target.x, y).stroke({ color: 0xfff6d4, width: 5, alpha: 1 - p });
        if (descending) g.circle(target.x, y, 9).fill({ color: 0xfff9dc, alpha: 1 - p });
      });
      ring(target.x, target.y, 0xffe8a0, 90, at);
    };
    const swing = (a: TokenView, b: TokenView, hit: boolean) => {
      const strike = a.who.strike, dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const x = b.x + (hit ? 0 : -dy / d * (b.radius + 42)), y = b.y + (hit ? 0 : dx / d * (b.radius + 42));
      if (strike === 'shoot') { projectile(a, x, y, 'arrow'); return; }
      clip(undefined, 0, 590, p => {
        const reach = Math.min(.58, Math.max(.15, 1 - (a.radius + b.radius + 15) / d));
        const travel = p < .44 ? (p / .44) ** 2 : Math.max(0, 1 - (p - .44) / .56) ** 2;
        a.root.position.set(a.x + dx * reach * travel, a.y + dy * reach * travel);
      });
      const g = new Graphics();
      clip(g, Math.max(0, cue.contact - 110), 380, p => {
        g.position.set(x, y); g.rotation = Math.atan2(dy, dx) + Math.PI / 2; g.clear(); g.alpha = Math.min(1, (1 - p) * 2.5);
        const r = b.radius + 27;
        if (strike === 'slash') {
          const sweep = Math.min(1, p * 2.8);
          g.rotation += -.9 + sweep * 1.6;
          g.moveTo(-r, -r * .45).bezierCurveTo(-r * .3, -r * 1.2, r * .9, -r * .8, r, r * .55)
            .bezierCurveTo(r * .5, -r * .65, -r * .5, -r * .52, -r, -r * .45).fill(0xffefd5);
          g.moveTo(-r + 10, -r * .2).quadraticCurveTo(r * .75, -r, r - 8, r * .45).stroke({ color: 0xb67a52, width: 3, alpha: .65 });
        } else if (strike === 'pierce') {
          g.poly([0, -r - 20, -6, r * .7, 0, r * .35, 6, r * .7]).fill(0xffe5b8);
          g.moveTo(-11, r).lineTo(-4, -r * .6).stroke({ color: 0xc98b62, width: 2 });
        } else if (strike === 'blunt') {
          g.circle(0, 0, 15 + p * r).stroke({ color: 0xccb99b, width: 9 * (1 - p) });
          for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; g.moveTo(Math.cos(angle) * 15, Math.sin(angle) * 15).lineTo(Math.cos(angle) * r * .8, Math.sin(angle) * r * .8).stroke({ color: 0xe1cead, width: 3, alpha: 1 - p }); }
        } else if (strike === 'bite') {
          const gap = Math.abs(p - .3) * 55;
          for (const side of [-1, 1]) {
            g.moveTo(-r * .5, side * gap).quadraticCurveTo(0, side * (gap + 32), r * .5, side * gap).stroke({ color: 0xd6bd95, width: 7 });
            for (let i = -1; i <= 1; i++) g.poly([i * 22 - 7, side * gap, i * 22 + 7, side * gap, i * 22, side * (gap - 17)]).fill(0xffebc7);
          }
        } else if (strike === 'claw') {
          for (let i = -1; i <= 1; i++) {
            g.moveTo(i * 20 - 20, -r * .7).quadraticCurveTo(i * 20 + 18, 0, i * 20 - 9, r * .65).stroke({ color: 0xf4d4b6, width: 5 });
            g.moveTo(i * 20 - 17, -r * .65).quadraticCurveTo(i * 20 + 24, 0, i * 20 - 5, r * .65).stroke({ color: 0x9e4439, width: 2 });
          }
        } else {
          for (let i = 0; i < 3; i++) g.moveTo(-r, (i - 1) * 14).bezierCurveTo(-r * .2, -r, r * .2, r, r, (i - 1) * 14)
            .stroke({ color: i === 1 ? 0xe2f7ee : 0x91c3c6, width: 3 + i, alpha: .65 });
        }
      });
      if (hit && strike === 'blunt') clip(undefined, cue.contact, 1, () => once('dust', cue.contact, () => spray(x, y, { color: 0xb9a48a, count: 20, size: 22, speed: 90, gravity: -10 })));
    };
    const death = (token: TokenView) => {
      const kin = token.who.kin;
      clip(undefined, 0, reduced ? 220 : 740, p => {
        token.root.alpha = 1 - p * .65;
        if (!reduced) {
          token.art.rotation = p * (kin === 'beast' ? .24 : kin === 'undead' ? -.18 : .65);
          token.art.y = p * 24; token.art.scale.y *= 1 - p * (kin === 'undead' ? .4 : .15);
          once('death', 80, () => {
            if (kin === 'undead' || kin === 'demon' || token.who.boss) spray(token.x, token.y, { ...fragments(token), count: token.who.boss ? 55 : 38,
              up: kin === 'demon' ? 100 : 10, speed: kin === 'demon' ? 170 : 100, life: 850, size: kin === 'undead' ? 11 : 15 });
            else spray(token.x, token.y + token.radius / 2, { color: 0x9c8a71, count: 8, speed: 35, size: 18, gravity: -10 });
          });
        }
      });
    };
    const prepare = () => {
      if (!event) return;
      const a = cue.actor ? get(cue.actor) : undefined, b = cue.targets[0] ? get(cue.targets[0]) : undefined;
      if (reduced) {
        const color = event.type === 'attack' && event.kind === 'spell' ? a?.who.class === 'cleric' ? 0xffe8a0 : 0x9bd8ff : 0xddbc87;
        cue.targets.forEach(key => { const token = get(key); if (token) ring(token.x, token.y, color, token.radius + 10, 0, 220); });
        if (event.type === 'attack' && b) number(b, event.hit ? '−' + event.damage : miss, event.crit ? 0xffd876 : 0xe5d3be, 0);
        if (event.type === 'heal' && a) number(a, '+' + event.amount, 0xa4d59a, 0);
        if (event.type === 'down') death(get('hero')!);
        if (event.type === 'defeated' && get(event.key)) death(get(event.key)!);
        return;
      }
      switch (event.type) {
        case 'initiative': event.order.forEach((key, i) => { const token = get(key); if (token) number(token, String(i + 1), 0xd8c597, 0); }); break;
        case 'attack':
          if (a && b) {
            if (event.kind === 'spell') {
              const x = b.x + (event.hit ? 0 : b.radius + 45), holy = a.who.class === 'cleric';
              if (holy) radiant({ x, y: b.y }, cue.contact, true);
              else projectile(a, x, b.y, 'bolt');
              if (event.hit) {
                if (!holy) ring(b.x, b.y, 0x9bd8ff, 85);
                clip(undefined, cue.contact, 2, () => once('spell-impact', cue.contact, () => spray(b.x, b.y,
                  { color: holy ? 0xffe8a0 : 0xbbe7ff, count: 24, speed: holy ? 85 : 135, up: holy ? 80 : 0,
                    gravity: 0, size: holy ? 8 : 12, shape: holy ? 'chip' : 'soft' })));
              }
            }
            else swing(a, b, event.hit);
            if (event.hit) impact(a, b, event.damage, event.crit);
            else number(b, miss, 0xc7c1b4);
          }
          break;
        case 'burst':
          if (a && b) {
            projectile(a, 300, b.y, event.source === 'bomb' ? 'bomb' : 'fireball');
            ring(300, b.y, 0xffae50, 265, cue.contact, 850);
            ring(300, b.y, 0xffe3a4, 180, cue.contact + 90, 650);
            clip(undefined, cue.contact, 2, () => once('fireball', cue.contact, () => spray(300, b.y, { color: 0xffa248, count: 65, speed: 240, size: 20, gravity: -50, life: 950 })));
            for (const hit of event.targets) { const target = get(hit.key); if (target) impact(a, target, hit.damage); }
          }
          break;
        case 'heal': {
          if (!a) break;
          const colors = { 'second-wind': 0xd2c092, 'cure-wounds': 0xa4d59a, potion: 0xdf789a, 'life-steal': 0xbe75b9 };
          heal(a, event.amount, colors[event.ability]); if (event.ability === 'cure-wounds') radiant(a); break;
        }
        case 'blocked': ring(300, HERO_Y, event.by === 'shield' ? 0x94dcf4 : 0xe4c986, 100, 0); break;
        case 'feature': {
          const token = get('hero')!;
          heal(token, event.amount, event.feature === 'ward' ? 0x8ad2e8 : 0xb8d894); break;
        }
        case 'power': {
          if (!a) break;
          const target = b ?? a;
          if (event.power === 'breath') {
            const g = new Graphics(), width = a.who.boss ? 190 : 75; let next = 0;
            clip(g, 0, 1350, p => {
              const reach = Math.min(1, p * 4), ex = a.x + (target.x - a.x) * reach, ey = a.y + (target.y - a.y) * reach;
              g.clear(); g.alpha = Math.min(1, (1 - p) * 3);
              for (let tongue = -1; tongue <= 1; tongue++) {
                const sway = Math.sin(time / 85 + tongue * 2) * 22, endX = ex + tongue * width * reach * .65;
                g.moveTo(a.x - 8, a.y).bezierCurveTo(a.x + sway, a.y + 100, endX - width * .45, ey - 60, endX, ey)
                  .bezierCurveTo(endX + width * .35, ey - 45, a.x + 20 - sway, a.y + 90, a.x + 8, a.y)
                  .fill({ color: tongue === 0 ? 0xffd270 : 0xf27224, alpha: tongue === 0 ? .48 : .25 });
              }
              if (time > next) { next = time + 35;
                spray(a.x, a.y + 30, { color: 0xffa64c, count: a.who.boss ? 7 : 4,
                  angle: Math.atan2(target.y - a.y, target.x - a.x), spread: a.who.boss ? 1.1 : .6,
                  speed: 490, gravity: 0, life: 800, size: a.who.boss ? 46 : 28 }); }
            });
            ring(target.x, target.y, 0xffac50, a.who.boss ? 210 : 90, cue.contact, 1000);
            impact(a, target, event.amount ?? 0, a.who.boss);
          } else if (event.power === 'explode') {
            ring(a.x, a.y, 0xffa64c, 240);
            clip(undefined, cue.contact, 2, () => once('explode', cue.contact, () => spray(a.x, a.y, { color: 0xffa64c, count: 70, speed: 260, size: 20, life: 850 })));
            if (b) impact(a, b, event.amount ?? 0);
          } else if (event.power === 'wail' || event.power === 'frighten') {
            for (let i = 0; i < 3; i++) ring(a.x, a.y, event.power === 'wail' ? 0xc1dde2 : 0xaa83c9, 340, i * 130, 950);
            if (event.power === 'wail' && b) impact(a, b, event.amount ?? 0);
          } else if (event.power === 'mend') heal(target, event.amount, 0x9dca81);
          else if (event.power === 'drain') { projectile(target, a.x, a.y, 'bolt'); heal(a, event.amount, 0xb987cd); }
          else if (event.power === 'undying') heal(a, undefined, 0xc7cfb4);
          else if (event.power === 'enrage') ring(a.x, a.y, 0xe6533b, a.radius + 65);
          else if (event.power === 'thief') {
            number(target, '−' + (event.amount ?? 0), 0xffd06b);
            clip(undefined, cue.contact, 2, () => once('coins', cue.contact, () => spray(target.x, target.y, { color: 0xe9bf5c, count: 18, shape: 'chip', speed: 90, up: 70, size: 12 })));
          }
          break;
        }
        case 'status': if (b) ring(b.x, b.y, STATUS[event.status], b.radius + 20, 0); break;
        case 'tick': if (b) { number(b, '−' + event.damage, event.status ? STATUS.poisoned : STATUS.burning, 0); ring(b.x, b.y, event.status ? STATUS.poisoned : STATUS.burning, b.radius, 0); } break;
        case 'held': if (b) ring(b.x, b.y, STATUS.paralyzed, b.radius + 8, 0); break;
        case 'defeated': if (get(event.key)) death(get(event.key)!); break;
        case 'down': death(get('hero')!); break;
        case 'rise': heal(get('hero')!, event.hp, 0xffdc82); radiant(get('hero')!, 0); ring(300, HERO_Y, 0xffdf89, 180, 0, 1100); break;
        case 'fled': {
          const token = get(event.key); if (token) clip(undefined, 0, 650, p => { token.root.alpha = 1 - p; token.root.x = token.x + (token.x < 300 ? -400 : 400) * p * p; }); break;
        }
        case 'escape': if (event.success) { const token = get('hero')!; clip(undefined, 0, 850, p => { token.root.y = token.y + 200 * p; token.root.alpha = 1 - p; }); } break;
        case 'surprise': ring(300, 300, 0xc9533f, 280, 0); break;
        default: break;
      }
    };
    const show = (frame: Frame, next: FightEventView | null, calm: boolean, timing: Cue) => {
      if (destroyed) return;
      previous = current ?? frame; current = frame; event = next; reduced = calm; cue = timing;
      clips = []; impacts = []; fired.clear(); lastTime = -1; time = 0;
      for (const child of fx.removeChildren()) child.destroy({ children: true });
      if (calm || next?.type === 'end') pool!.clear();
      for (const [key, token] of tokens) {
        token.shownHp = NaN;
        for (const status of Object.keys(STATUS) as Status[]) if (!frame.fighters[key]?.statuses[status]) pool!.clear(key + ':' + status);
      }
      prepare(); draw(0);
    };
    const draw = (at: number) => {
      if (destroyed || !current) return;
      if (reduced) at = Math.min(at, 260);
      if (at === lastTime) return;
      worldTime += Math.max(0, at - Math.max(0, lastTime)); lastTime = at; time = at;
      const ended = event?.type === 'end';
      let cameraStrength = 0, cameraZoom = 0;
      for (const [key, token] of tokens) {
        const state = current.fighters[key]; if (!state) continue;
        const active = cue.actor === key && !state.fallen && !state.fled && !ended;
        token.root.position.set(token.x, token.y); token.root.alpha = state.fled ? 0 : state.fallen ? .35 : 1;
        token.art.position.set(0, state.fallen ? 20 : active && !reduced ? -6 : 0);
        token.art.rotation = state.fallen ? .25 : 0;
        const breath = !reduced && !ended && !state.fallen ? Math.sin(worldTime / 600 + token.x) * .012 : 0;
        token.art.scale.set((active && !reduced ? 1.035 : 1) + breath, (state.fallen ? .88 : 1) - breath * .35);
        token.art.filters = state.fallen ? [mono] : []; token.flash.alpha = 0;
        const hp = time < cue.contact ? (previous?.fighters[key]?.hp ?? state.hp) : state.hp;
        if (hp !== token.shownHp) {
          token.shownHp = hp; token.health.text = hp + ' / ' + token.who.maxHp;
          const width = Math.max(token.radius * 1.6, token.health.width + 12);
          token.hp.clear().roundRect(-width / 2, token.radius + 8, width, 26, 4).fill(0x080605)
            .roundRect(-width / 2, token.radius + 8, Math.max(0, Math.min(1, hp / Math.max(1, token.who.maxHp))) * width, 26, 4).fill(0x852c24);
        }
        token.halo.clear();
        const elite = state.enraged ? 0xdc4b32 : token.who.elite ? ELITE[token.who.elite] : null;
        if (elite) token.halo.circle(0, 0, token.radius + 8).stroke({ color: elite, width: 7, alpha: .3 });
        if (active) token.halo.circle(0, -3, token.radius + 8).stroke({ color: 0xf8d28b, width: 9, alpha: .15 })
          .circle(0, -3, token.radius + 7).stroke({ color: 0xf8d28b, width: 2, alpha: .9 });
        if (key === 'hero' && current.ward > 0) token.halo.circle(0, 0, token.radius + 13).stroke({ color: 0x8ad2e8, width: 3, alpha: .65 });
        token.aura.clear();
        if (cue.targets.includes(key) && !ended && !state.fallen) {
          const r = token.radius + 15;
          for (const side of [-1, 1]) token.aura.moveTo(side * r, -r * .45).lineTo(side * r, -r * .7).lineTo(side * r * .7, -r)
            .moveTo(side * r, r * .45).lineTo(side * r, r * .7).lineTo(side * r * .7, r).stroke({ color: 0xdf997b, width: 3, alpha: .8 });
        }
        token.marks.clear();
        Object.keys(state.statuses).forEach((status, i) => {
          const color = STATUS[status as Status], x = -token.radius + 14 + i * 23, y = -token.radius + 4;
          token.marks.circle(x, y, 9).fill(0x100d0b).stroke({ color, width: 2 });
          if (status === 'burning') token.marks.poly([x, y - 6, x - 5, y + 5, x + 5, y + 5]).fill(color);
          else if (status === 'poisoned') token.marks.circle(x, y, 4).fill(color);
          else token.marks.moveTo(x - 4, y - 4).lineTo(x + 4, y + 4).moveTo(x + 4, y - 4).lineTo(x - 4, y + 4).stroke({ color, width: 2 });
          if (status === 'paralyzed') {
            for (let n = -2; n <= 2; n++) token.aura.ellipse(n * 13, n * 12, 9, 5).stroke({ color, width: 2, alpha: .7 });
          }
          if (status === 'burning' && !reduced) {
            for (let n = -1; n <= 1; n++) {
              const x = n * token.radius * .6, bottom = token.radius * .7, tip = bottom - 25 - 12 * Math.sin(worldTime / 130 + n * 2);
              token.aura.moveTo(x - 7, bottom).quadraticCurveTo(x - 12, tip + 13, x + 2, tip)
                .quadraticCurveTo(x - 2, tip + 18, x + 8, bottom).fill({ color: 0xffb84e, alpha: .7 });
            }
          }
          if (status === 'frightened' && !reduced) {
            for (let n = 0; n < 3; n++) { const angle = worldTime / 800 + n * Math.PI * 2 / 3;
              token.aura.arc(0, 0, token.radius + 5, angle, angle + .7).stroke({ color, width: 6, alpha: .25 }); }
          }
        });
      }
      for (const c of clips) {
        const age = time - c.start;
        if (c.node) c.node.visible = age >= 0 && age <= c.length;
        if (age >= 0 && (age <= c.length || !c.node)) c.draw(Math.min(1, age / c.length));
      }
      for (const hit of impacts) {
        const age = time - hit.at; if (age < 0) continue;
        if (!hit.fired) { hit.fired = true; spray(hit.token.x, hit.token.y, { ...fragments(hit.token), count: hit.crit ? 32 : fragments(hit.token).count });
          if (hit.crit) spray(hit.token.x, hit.token.y, { color: 0xffd570, count: 24, speed: 220, gravity: 0, shape: 'chip', size: 8 }); }
        if (age < 400) {
          const p = age / 400, share = Math.min(1, hit.damage / Math.max(1, hit.token.who.maxHp));
          const dx = hit.token.x - hit.from.x, dy = hit.token.y - hit.from.y, length = Math.max(1, Math.hypot(dx, dy));
          const push = Math.sin(Math.PI * Math.min(1, p * 2)) * (5 + share * 17);
          hit.token.root.x += dx / length * push; hit.token.root.y += dy / length * push;
          hit.token.flash.tint = age < 80 ? 0xffffff : 0xe85842;
          hit.token.flash.alpha = age < 80 ? .65 : Math.max(0, 1 - (age - 80) / 220) * .35;
          cameraStrength = Math.max(cameraStrength, (2 + share * 10 + (hit.crit ? 2 : 0)) * (1 - p) ** 2);
          if (hit.crit) cameraZoom = Math.max(cameraZoom, .045 * Math.sin(p * Math.PI));
        }
      }
      if (!reduced && !ended) {
        if (worldTime >= airAt) { airAt = worldTime + 170;
          const color = replay.map.startsWith('demons') ? 0xde743a : replay.map.startsWith('lair') ? 0xbbb2a6 : replay.map.startsWith('crypt') ? 0xbca784 : 0x8d8776;
          spray(pool!.random() * SIZE, pool!.random() * SIZE, { color, count: 1, speed: 5, up: 5, gravity: 0, life: 3600, size: replay.map.startsWith('goblins') ? 26 : 7, tag: 'air' }); }
        if (worldTime >= statusAt) { statusAt = worldTime + 90;
          for (const [key, token] of tokens) for (const status of Object.keys(current.fighters[key]?.statuses ?? {}) as Status[]) {
            if (status === 'paralyzed') continue;
            const angle = pool!.random() * Math.PI * 2;
            spray(token.root.x + Math.cos(angle) * token.radius * .8, token.root.y + Math.sin(angle) * token.radius * .65,
              { color: STATUS[status], count: 1, up: status === 'burning' ? 60 : 25, speed: 12, gravity: -10,
                life: 680, size: status === 'frightened' ? 23 : status === 'burning' ? 17 : 10,
                shape: status === 'poisoned' ? 'bubble' : 'soft', tag: key + ':' + status });
          }
        }
      }
      pool!.update(worldTime);
      camera.position.set(300 + Math.sin(worldTime * .085) * cameraStrength, 300 + Math.sin(worldTime * .12 + 1) * cameraStrength * .65);
      camera.scale.set(1 + cameraZoom);
      const hero = current.fighters.hero!, low = hero.hp > 0 && hero.hp < replay.hero.maxHp / 4;
      danger.alpha = low ? .3 + (!reduced && !ended ? Math.max(0, Math.sin(worldTime / 220)) ** 10 * .35 : 0) : 0;
      if (hero.fallen && !ended) {
        drain.greyscale(event?.type === 'down' && !reduced ? Math.min(1, time / 550) : 1, false); world.filters = [drain];
      } else world.filters = [];
      app.render();
      if (import.meta.env.DEV) {
        host.dataset.particles = String(pool!.active); host.dataset.sceneTime = String(Math.round(time));
        host.dataset.renderedFrames = String(++renderedFrames);
      }
    };
    const resize = () => {
      if (destroyed) return;
      const width = Math.max(1, host.clientWidth); app.renderer.resize(width, width); viewport.scale.set(width / SIZE); app.render();
    };
    observer = new ResizeObserver(resize); observer.observe(host); resize();
    return { show, draw, destroy };
  } catch (error) { destroy(); throw error; }
}
