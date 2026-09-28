import { Application, Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Combatant, Elite, FightEventView, FightReplay } from '@dark/shared';
import type { Frame, Status } from './replay';

const SIZE = 600;
const ELITE: Record<Elite, number> = { gilded: 0xc9a24a, frenzied: 0xbd3c35, armored: 0x8aa6b2, vampiric: 0x9563b8, swift: 0x57b7ae };
const STATUS: Record<Status, number> = { burning: 0xe77735, poisoned: 0x92ad4d, paralyzed: 0x82bbd7, frightened: 0xa080be };
interface TokenView {
  root: Container; art: Container; hp: Graphics; marks: Graphics; halo: Graphics;
  portrait?: Sprite; x: number; y: number; radius: number; who: Combatant; label: Text; health: Text;
}
export interface FightStage {
  show(frame: Frame, event: FightEventView | null, reduced: boolean): void;
  destroy(): void;
}
interface Options {
  host: HTMLElement; replay: FightReplay; names: Record<string, string>;
  map: { src: string; style: { transform?: string } | undefined };
  signal: AbortSignal; miss: string;
}

/** One private ticker and scene graph per mounted fight. Cached art textures belong to Assets. */
export async function createFightStage({ host, replay, names, map, signal, miss }: Options): Promise<FightStage> {
  if (signal.aborted) throw new DOMException('Fight closed', 'AbortError');
  const app = new Application();
  let destroyed = false;
  let initialized = false;
  let observer: ResizeObserver | undefined;
  let mono: ColorMatrixFilter | undefined;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    if (initialized) app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    mono?.destroy();
  };
  try {
    await app.init({
      width: SIZE, height: SIZE, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      preference: ['webgl'], autoStart: false, sharedTicker: false,
    });
    initialized = true;
    if (signal.aborted) { destroy(); throw new DOMException('Fight closed', 'AbortError'); }
    const fighters = [replay.hero, ...replay.monsters];
    const urls = [...new Set([map.src, ...fighters.flatMap(f => f.art ? [f.art] : [])])];
    const textures = new Map<string, Texture>();
    await Promise.all(urls.map(async url => {
      try { textures.set(url, await Assets.load<Texture>(url)); } catch { /* Missing art keeps the initial token. */ }
    }));
    if (signal.aborted) { destroy(); throw new DOMException('Fight closed', 'AbortError'); }
    host.appendChild(app.canvas);
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.setAttribute('aria-hidden', 'true');
    const world = new Container();
    app.stage.addChild(world);
    const mapTexture = textures.get(map.src);
    if (mapTexture) {
      const floor = new Sprite(mapTexture);
      floor.anchor.set(.5); floor.position.set(300, 300); floor.width = SIZE; floor.height = SIZE;
      floor.tint = 0x9e9e9e;
      const transform = map.style?.transform ?? '';
      floor.rotation = Number(/rotate\((\d+)deg\)/.exec(transform)?.[1] ?? 0) * Math.PI / 180;
      if (transform.includes('scaleX(-1)')) floor.scale.x *= -1;
      world.addChild(floor);
    } else world.addChild(new Graphics().rect(0, 0, SIZE, SIZE).fill(0x211e1a));
    // The vignette leaves the battle floor visible while giving labels a stable dark ground.
    world.addChild(new Graphics().rect(0, 0, SIZE, 38).fill({ color: 0x080706, alpha: .6 })
      .rect(0, SIZE - 24, SIZE, 24).fill({ color: 0x080706, alpha: .6 }));
    const tokens = new Map<string, TokenView>();
    mono = new ColorMatrixFilter(); mono.greyscale(1, false);
    const text = (value: string, size: number, color = 0xe6dac4) => new Text({
      text: value, style: { fontFamily: 'Georgia, serif', fontSize: size, fontWeight: 'bold', fill: color,
        stroke: { color: 0x100d0a, width: 4 }, align: 'center' },
    });
    const makeToken = (who: Combatant, x: number, y: number, diameter: number) => {
      const root = new Container(); root.position.set(x, y);
      const radius = diameter / 2, art = new Container(), halo = new Graphics(), marks = new Graphics();
      root.addChild(halo, art);
      const ring = who.banner ?? (who.boss ? 0xc9a24a : 0x4a4038);
      art.addChild(new Graphics().circle(0, 3, radius + 5).fill({ color: 0x000000, alpha: .65 })
        .circle(0, 0, radius).fill(0x14110f).stroke({ color: ring, width: who.boss ? 5 : 3 }));
      const texture = who.art ? textures.get(who.art) : undefined;
      let portrait: Sprite | undefined;
      if (texture) {
        portrait = new Sprite(texture); portrait.anchor.set(.5);
        const cover = diameter * 1.08 / Math.min(texture.width, texture.height);
        portrait.scale.set(cover);
        const mask = new Graphics().circle(0, 0, radius - 3).fill(0xffffff);
        art.addChild(portrait, mask); portrait.mask = mask;
      } else {
        const initial = text((names[who.key] ?? '?').slice(0, 1).toUpperCase(), diameter * .42);
        initial.anchor.set(.5); art.addChild(initial);
      }
      const hp = new Graphics(), health = text('', 17), label = text(names[who.key] ?? who.key, 20);
      health.anchor.set(.5); health.position.set(0, radius + 17);
      label.anchor.set(.5, 0); label.position.set(0, radius + 29);
      label.style.wordWrap = true;
      label.style.wordWrapWidth = who.key === 'hero' ? 220 : SIZE / (Math.min(4, replay.monsters.length) + .6) - 12;
      label.style.breakWords = true;
      label.style.lineHeight = 22;
      root.addChild(marks, hp, health, label);
      world.addChild(root);
      tokens.set(who.key, { root, art, hp, marks, halo, portrait, x, y, radius, who, label, health });
    };
    const count = replay.monsters.length;
    replay.monsters.forEach((who, i) => {
      const columns = count > 4 ? 3 : Math.max(1, count);
      const row = Math.floor(i / columns);
      const inRow = Math.min(columns, count - row * columns);
      const diameter = who.boss && count === 1 ? 188 : count <= 2 ? 108 : count <= 4 ? 84 : 68;
      makeToken(who, SIZE / 2 + ((i % columns) - (inRow - 1) / 2) * (SIZE / (columns + .6)),
        count === 1 && who.boss ? 166 : 133 + row * 128, diameter);
    });
    makeToken(replay.hero, 300, 466, 104);
    const fx = new Container(); world.addChild(fx);
    let animations: { elapsed: number; length: number; draw: (p: number) => void; done?: () => void }[] = [];
    let reduced = false;
    const animate = (length: number, draw: (p: number) => void, done?: () => void) => {
      draw(0); animations.push({ elapsed: 0, length, draw, done });
    };
    const addFx = (node: Container, length: number, draw: (p: number) => void) => {
      fx.addChild(node); animate(length, draw, () => node.destroy({ children: true }));
    };
    const burst = (x: number, y: number, color: number, radius = 100, length = 850) => {
      const g = new Graphics();
      addFx(g, length, p => {
        g.clear();
        const r = reduced ? radius * .55 : 12 + radius * p;
        g.circle(x, y, r).stroke({ color, width: reduced ? 3 : 7 * (1 - p) + 1, alpha: 1 - p });
        if (!reduced) {
          g.circle(x, y, r * .7).fill({ color, alpha: (1 - p) * .16 });
          for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6;
            g.circle(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 2 + 3 * (1 - p)).fill({ color, alpha: 1 - p });
          }
        }
      });
    };
    const float = (key: string, value: string, color: number, big = false) => {
      const token = tokens.get(key); if (!token) return;
      const number = text(value, big ? 42 : 30, color); number.anchor.set(.5);
      addFx(number, 800, p => {
        number.position.set(token.x, token.y - 10 - (reduced ? 0 : p * 50));
        number.alpha = p < .65 ? 1 : (1 - p) / .35;
      });
    };
    const flash = (key: string, color: number, big = false) => {
      const token = tokens.get(key); if (!token) return;
      burst(token.x, token.y, color, token.radius + (big ? 65 : 25), 550);
      if (!reduced) animate(420, p => { token.art.x = Math.sin(p * Math.PI * 10) * (1 - p) * (big ? 8 : 4); },
        () => { token.art.x = 0; });
    };
    const beam = (from: string, to: string, color: number, cone = false) => {
      const a = tokens.get(from), b = tokens.get(to); if (!a || !b) return;
      if (reduced) { burst(b.x, b.y, color, 70); return; }
      const g = new Graphics();
      addFx(g, cone ? 1000 : 600, p => {
        const end = Math.min(1, p * 2), x = a.x + (b.x - a.x) * end, y = a.y + (b.y - a.y) * end;
        g.clear(); g.alpha = Math.min(1, (1 - p) * 3);
        if (cone) {
          const width = a.who.boss ? 88 : 48;
          g.poly([a.x, a.y, x - width * end, y, x + width * end, y]).fill({ color, alpha: .45 });
        }
        g.moveTo(a.x, a.y).lineTo(x, y).stroke({ color, width: cone ? 15 : 7, alpha: .8 });
        g.circle(x, y, cone ? 30 : 12).fill({ color: 0xf9dfad, alpha: .8 });
      });
    };
    const lunge = (from: string, to: string) => {
      const a = tokens.get(from), b = tokens.get(to); if (!a || !b || reduced) return;
      animate(450, p => {
        const travel = Math.sin(Math.PI * p) * .25;
        a.root.position.set(a.x + (b.x - a.x) * travel, a.y + (b.y - a.y) * travel);
      }, () => a.root.position.set(a.x, a.y));
    };
    const show = (frame: Frame, event: FightEventView | null, calm: boolean) => {
      if (destroyed) return;
      reduced = calm;
      animations.forEach(a => a.done?.()); animations = [];
      for (const child of fx.removeChildren()) child.destroy({ children: true });
      for (const [key, token] of tokens) {
        const state = frame.fighters[key]; if (!state) continue;
        token.root.position.set(token.x, token.y); token.art.x = 0; token.art.scale.set(1);
        token.root.alpha = state.fled ? 0 : state.fallen ? .38 : 1;
        token.art.filters = state.fallen ? [mono!] : [];
        token.health.text = state.hp + ' / ' + token.who.maxHp;
        const width = token.radius * 1.6;
        token.hp.clear().roundRect(-width / 2, token.radius + 8, width, 17, 4).fill(0x080605)
          .roundRect(-width / 2, token.radius + 8, Math.max(0, Math.min(1, state.hp / Math.max(1, token.who.maxHp))) * width, 17, 4).fill(0x852c24);
        token.halo.clear();
        const glow = state.enraged ? 0xbc322b : token.who.elite ? ELITE[token.who.elite] : null;
        if (glow) token.halo.circle(0, 0, token.radius + 9).stroke({ color: glow, width: 8, alpha: .25 })
          .circle(0, 0, token.radius + 6).stroke({ color: glow, width: 2 });
        if (key === 'hero' && frame.ward > 0) token.halo.circle(0, 0, token.radius + 13).stroke({ color: 0x80c4dc, width: 4, alpha: .65 });
        token.marks.clear();
        Object.entries(state.statuses).forEach(([status], i) => {
          const x = -token.radius + 16 + i * 23;
          token.marks.circle(x, -token.radius + 4, 10).fill(0x100d0b).stroke({ color: STATUS[status as Status], width: 3 });
          // Distinct shapes remain readable when hue alone is insufficient.
          if (status === 'poisoned') token.marks.circle(x, -token.radius + 4, 4).fill(STATUS.poisoned);
          else if (status === 'burning') token.marks.poly([x, -token.radius - 3, x - 5, -token.radius + 9, x + 5, -token.radius + 9]).fill(STATUS.burning);
          else token.marks.moveTo(x - 4, -token.radius).lineTo(x + 4, -token.radius + 8).moveTo(x + 4, -token.radius).lineTo(x - 4, -token.radius + 8).stroke({ color: STATUS[status as Status], width: 2 });
        });
        if (token.who.powers.includes('swarm') && !state.fallen && !reduced)
          animate(600, p => token.art.scale.set(1 + Math.sin(p * Math.PI * 6) * .035 * (1 - p)));
      }
      if (event) switch (event.type) {
        case 'initiative':
          event.order.forEach((key, i) => float(key, String(i + 1), 0xc9b68e));
          break;
        case 'attack':
          if (event.kind === 'spell') beam(event.actor, event.target, 0x91c5d2);
          else lunge(event.actor, event.target);
          if (event.hit) { flash(event.target, event.crit ? 0xffd06b : 0xcf5340, event.crit); float(event.target, '−' + event.damage, event.crit ? 0xffd06b : 0xffa08a, event.crit); }
          else float(event.target, miss, 0xc0b8a7);
          break;
        case 'blocked': burst(300, 466, event.by === 'shield' ? 0x8ecde4 : 0xd2b979, 80); break;
        case 'burst':
          beam(event.actor, event.targets[0]?.key ?? event.actor, event.source === 'bomb' ? 0xefae57 : 0x96cbe4);
          burst(300, 190, event.source === 'bomb' ? 0xe88b3e : 0x91c2e6, 240, 1100);
          event.targets.forEach(hit => { flash(hit.key, 0xefaa60); float(hit.key, '−' + hit.damage, 0xffbf7d, true); });
          break;
        case 'heal': {
          const colors = { 'second-wind': 0xd2c092, 'cure-wounds': 0xa4d59a, potion: 0xdf789a, 'life-steal': 0xbe75b9 };
          flash(event.actor, colors[event.ability]); float(event.actor, '+' + event.amount, colors[event.ability]);
          break;
        }
        case 'feature':
          burst(300, 466, event.feature === 'ward' ? 0x8ecde4 : event.feature === 'survivor' ? 0xa4d59a : 0xffd06b, 85);
          if (event.amount !== undefined) float('hero', (event.feature === 'ward' ? '◈' : '+') + event.amount, 0xa4d7d9);
          break;
        case 'power': {
          const target = event.target ?? event.actor;
          if (event.power === 'breath') { beam(event.actor, target, 0xf29742, true); flash(target, 0xe77735, true); }
          if (event.power === 'explode') { const a = tokens.get(event.actor); if (a) burst(a.x, a.y, 0xf29742, 240, 1200); beam(event.actor, target, 0xf29742); flash(target, 0xe77735, true); }
          if (event.power === 'wail' || event.power === 'frighten') { const a = tokens.get(event.actor); if (a) burst(a.x, a.y, event.power === 'wail' ? 0xc8d5e2 : 0xa080be, 350, 1300); }
          if (['breath', 'explode', 'wail'].includes(event.power)) float(target, '−' + (event.amount ?? 0), 0xffb185, true);
          if (event.power === 'thief') {
            beam(target, event.actor, 0xd5af50); float(target, '−' + (event.amount ?? 0), 0xffd06b);
            const a = tokens.get(event.actor), b = tokens.get(target);
            if (a && b && !reduced) for (let i = 0; i < 7; i++) {
              const coin = new Graphics().circle(0, 0, 5).fill(0xe5be58);
              addFx(coin, 650 + i * 35, p => coin.position.set(b.x + (a.x - b.x) * p + Math.sin(p * Math.PI) * (i - 3) * 12, b.y + (a.y - b.y) * p));
            }
          }
          if (event.power === 'mend' || event.power === 'drain') {
            const key = event.power === 'drain' ? event.actor : target;
            if (event.power === 'drain') beam(target, event.actor, 0xa77abb);
            flash(key, 0x99c67c); float(key, '+' + (event.amount ?? 0), 0xb7dd93);
          }
          if (event.power === 'undying' || event.power === 'enrage') flash(event.actor, event.power === 'undying' ? 0xbecbaf : 0xd35143, true);
          break;
        }
        case 'status': flash(event.target, STATUS[event.status]); break;
        case 'tick': flash(event.target, event.status ? STATUS.poisoned : STATUS.burning); float(event.target, '−' + event.damage, event.status ? 0xbada70 : 0xffae6b); break;
        case 'held': flash(event.target, STATUS.paralyzed); break;
        case 'fled': {
          const a = tokens.get(event.key);
          if (a && !reduced) animate(700, p => { a.root.alpha = 1 - p; a.root.x = a.x + (a.x < 300 ? -360 : 360) * p; });
          break;
        }
        case 'defeated': case 'down': {
          const a = tokens.get(event.type === 'down' ? 'hero' : event.key);
          if (a && !reduced) animate(450, p => { a.root.alpha = 1 - .62 * p; });
          break;
        }
        case 'rise': burst(300, 466, 0xffd06b, 130, 1100); break;
        case 'surprise': burst(300, 300, 0xc74534, 290, 850); break;
        case 'escape': if (event.success) { const a = tokens.get('hero'); if (a && !reduced) animate(850, p => { a.root.y = a.y + 180 * p; a.root.alpha = 1 - p; }); } break;
        default: break;
      }
      app.render();
      if (animations.length) app.start();
    };
    app.ticker.maxFPS = 60;
    app.ticker.add(ticker => {
      for (const a of animations) { a.elapsed += ticker.deltaMS; a.draw(Math.min(1, a.elapsed / a.length)); }
      animations = animations.filter(a => { if (a.elapsed >= a.length) { a.done?.(); return false; } return true; });
      if (!animations.length) { app.render(); app.stop(); }
    });
    const resize = () => {
      if (destroyed) return;
      const width = Math.max(1, host.clientWidth);
      app.renderer.resize(width, width);
      world.scale.set(width / SIZE);
      app.render();
    };
    observer = new ResizeObserver(resize); observer.observe(host); resize();
    return { show, destroy };
  } catch (error) { destroy(); throw error; }
}
