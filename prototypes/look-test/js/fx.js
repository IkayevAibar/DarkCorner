// PROTOTYPE full-screen effects layer (PixiJS): light beams, particle bursts, rings.
// Every reveal in the game calls reveal(tier, x, y) so effects grow with the Tier.
import { Application, Container, Graphics, Sprite, Texture } from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import { TIER_COLOR, tierRank } from './data.js';
import { rand, shake, vibrate } from './util.js';
import { sfx } from './audio.js';

let app = null;
let layer = null;
let dotTex = null;
let beamTex = null;
const live = [];

const hex = (css) => Number.parseInt(css.slice(1), 16);

function radialCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function beamCanvas() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 512);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.7, 'rgba(0,0,0,.7)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 512);
  return c;
}

export async function initFx() {
  app = new Application();
  await app.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  Object.assign(app.canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '60' });
  document.body.appendChild(app.canvas);
  layer = new Container();
  app.stage.addChild(layer);
  dotTex = Texture.from(radialCanvas(64));
  beamTex = Texture.from(beamCanvas());
  app.ticker.add((tk) => {
    const dt = tk.deltaMS / 1000;
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i](dt)) live.splice(i, 1);
    }
  });
}

function sprite(tex, color, blend = 'add') {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.tint = color;
  s.blendMode = blend;
  layer.addChild(s);
  return s;
}

export function burst(x, y, color, count = 30, speed = 260, { gravity = 380, size = 0.35, life = 1, up = 0 } = {}) {
  if (!app) return;
  for (let i = 0; i < count; i++) {
    const s = sprite(dotTex, typeof color === 'function' ? color() : color);
    const a = rand(0, Math.PI * 2);
    const v = rand(0.3, 1) * speed;
    let vx = Math.cos(a) * v;
    let vy = Math.sin(a) * v - up;
    const max = rand(0.5, 1) * life;
    let age = 0;
    const sc = rand(0.5, 1) * size;
    s.position.set(x, y);
    s.scale.set(sc);
    live.push((dt) => {
      age += dt;
      vx *= 0.985;
      vy = vy * 0.985 + gravity * dt;
      s.x += vx * dt;
      s.y += vy * dt;
      const k = 1 - age / max;
      s.alpha = Math.max(0, k);
      s.scale.set(sc * (0.4 + 0.6 * k));
      if (age >= max) { s.destroy(); return false; }
      return true;
    });
  }
}

export function glow(x, y, color, radius = 120, duration = 0.9, peak = 0.9) {
  if (!app) return;
  const s = sprite(dotTex, color);
  s.position.set(x, y);
  let age = 0;
  live.push((dt) => {
    age += dt;
    const k = age / duration;
    s.scale.set((radius / 32) * (0.6 + 0.6 * Math.min(1, k * 3)));
    s.alpha = peak * (k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85));
    if (age >= duration) { s.destroy(); return false; }
    return true;
  });
}

export function beam(x, y, color, height = 400, width = 90, duration = 1.6, rotation = 0) {
  if (!app) return;
  const s = sprite(beamTex, color);
  s.anchor.set(0.5, 1);
  s.position.set(x, y);
  s.rotation = rotation;
  let age = 0;
  live.push((dt) => {
    age += dt;
    const k = age / duration;
    const grow = Math.min(1, k * 5);
    s.scale.set((width / 64) * (1 - 0.4 * k), (height / 512) * grow);
    s.alpha = k < 0.2 ? 1 : Math.max(0, 1 - (k - 0.2) / 0.8);
    if (age >= duration) { s.destroy(); return false; }
    return true;
  });
}

export function ring(x, y, color, radius = 160, duration = 0.8, width = 10) {
  if (!app) return;
  const g = new Graphics();
  g.blendMode = 'add';
  layer.addChild(g);
  let age = 0;
  live.push((dt) => {
    age += dt;
    const k = Math.min(1, age / duration);
    const r = radius * (1 - (1 - k) ** 3);
    g.clear().circle(x, y, Math.max(1, r)).stroke({ width: width * (1 - k) + 1, color, alpha: 1 - k });
    if (age >= duration) { g.destroy(); return false; }
    return true;
  });
}

function rays(x, y, color, count = 10, length = 360) {
  const base = rand(0, Math.PI);
  for (let i = 0; i < count; i++) {
    beam(x, y, color, length * rand(0.7, 1.1), 40, 2.2, base + (i / count) * Math.PI * 2);
  }
}

const rainbow = () => [0xff5d73, 0xffd25d, 0x7dff8a, 0x5dd8ff, 0xb18cff, 0xffffff][Math.floor(Math.random() * 6)];

// The one call every reveal uses. Bigger Tier, bigger show.
export function reveal(tier, x, y, { radiant = false, sound = true } = {}) {
  const r = tierRank(tier);
  const color = hex(TIER_COLOR[tier]);
  if (sound) sfx.reveal(tier);
  glow(x, y, color, 70 + r * 45, 1 + r * 0.15);
  burst(x, y, color, 12 + r * 16, 160 + r * 60, { up: 60 + r * 30 });
  if (r >= 2) beam(x, y + 30, color, 160 + r * 90, 60 + r * 12, 1.4 + r * 0.15);
  if (r >= 3) ring(x, y, color, 90 + r * 35);
  if (r >= 4) {
    burst(x, y, 0xffffff, 20, 90, { gravity: -40, size: 0.18, life: 2 });
    ring(x, y, color, 220, 1.2, 6);
  }
  if (r >= 5) {
    shake(document.getElementById('app'), 7 + (r - 5) * 5, 650);
    vibrate([60, 40, 140]);
    ring(x, y, 0xffffff, 320, 1, 14);
  }
  if (r >= 6) rays(x, y, color);
  if (radiant) radiantBurst(x, y);
}

export function radiantBurst(x, y) {
  burst(x, y, rainbow, 70, 320, { up: 120, size: 0.28, life: 1.6 });
  glow(x, y, 0xffffff, 200, 1.4, 0.7);
  ring(x, y, 0xffffff, 260, 1.1, 8);
}

export function sparks(x, y, color = 0xffd9a0, count = 14) {
  burst(x, y, color, count, 380, { gravity: 600, size: 0.16, life: 0.45 });
}

export const centerOf = (node) => {
  const b = node.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
