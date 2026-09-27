// PROTOTYPE Labyrinth screen: a Room seen from above, tokens, an automatic fight played
// back, d20 moments, Death saves, loot drop, and Doors with Clues.
import {
  Application, Assets, Container, Graphics, Sprite, Text, Texture, ColorMatrixFilter,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import { HEROES, MONSTERS, ROOMS, DEMO_DROP, TIER_COLOR } from './data.js';
import { t, tr, onLang } from './i18n.js';
import { el, animate, ease, wait, rand, randInt, roll, weighted, vibrate } from './util.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import { makeItem, openItemSheet } from './items.js';
import { state } from './state.js';

const SIZE = 1024;
const HERO_POS = { x: 512, y: 770 };
const MON_POS = {
  1: [{ x: 512, y: 330, r: 185 }],
  2: [{ x: 360, y: 320, r: 98 }, { x: 664, y: 320, r: 98 }],
  3: [{ x: 290, y: 360, r: 90 }, { x: 512, y: 270, r: 90 }, { x: 734, y: 360, r: 90 }],
};
const BONE = 0xe8dcc6;
const GOLD = 0xf1c75b;
const RED = 0xd23a2a;

let app = null;
let world;
let bg;
let tokens;
let texts;
let dice = null;
let ui = {};
let busy = false;
let room = null;
let hero = null;
let mons = [];
let lastKill = { x: 512, y: 330 };
let fought = false;

const hexOf = (css) => Number.parseInt(css.slice(1), 16);
const headFont = () => getComputedStyle(document.documentElement).getPropertyValue('--font-head').trim() || 'serif';
const heroData = () => HEROES.find((h) => h.id === state.heroId);

export function initFight(screen) {
  ui.screen = screen;
  ui.floor = el('span', { class: 'chip floor-chip' });
  ui.roomName = el('span', { class: 'room-name' });
  ui.hpFill = el('span', { class: 'meter-fill hp' });
  ui.hpNum = el('span', { class: 'meter-num' });
  ui.stFill = el('span', { class: 'meter-fill st' });
  ui.stNum = el('span', { class: 'meter-num' });
  ui.hpLabel = el('span', { class: 'meter-label' });
  ui.stLabel = el('span', { class: 'meter-label' });
  ui.stage = el('div', { class: 'stage' });
  ui.doors = el('div', { class: 'doors', hidden: true });
  ui.msg = el('div', { class: 'stage-msg', hidden: true });
  ui.fightBtn = el('button', { class: 'btn primary', onclick: onFightButton });
  ui.saveBtn = el('button', { class: 'btn', onclick: demoDeathSaves });
  ui.log = el('ol', { class: 'combat-log' });

  screen.append(
    el('div', { class: 'panel fight-head' },
      el('div', { class: 'fight-title' }, ui.floor, ui.roomName),
      el('div', { class: 'meters' },
        el('div', { class: 'meter' }, ui.hpLabel, el('span', { class: 'meter-track' }, ui.hpFill), ui.hpNum),
        el('div', { class: 'meter', title: 'Tap to refill (test)', onclick: () => { state.stamina = state.staminaMax; updateHead(); } },
          ui.stLabel, el('span', { class: 'meter-track' }, ui.stFill), ui.stNum),
      ),
    ),
    el('div', { class: 'stage-wrap' }, ui.stage, ui.doors, ui.msg),
    el('div', { class: 'fight-actions' }, ui.fightBtn, ui.saveBtn),
    ui.log,
  );
  onLang(() => { updateHead(); if (!ui.doors.hidden) renderDoors(ui.doors.options); });
}

async function ensureApp() {
  if (app) return;
  await document.fonts.ready;
  app = new Application();
  await app.init({ width: SIZE, height: SIZE, background: '#000000', antialias: true, resolution: 1 });
  app.canvas.classList.add('stage-canvas');
  ui.stage.append(app.canvas);
  world = new Container();
  bg = new Sprite(Texture.EMPTY);
  const vignette = new Sprite(Texture.from(vignetteCanvas()));
  vignette.width = SIZE;
  vignette.height = SIZE;
  tokens = new Container();
  texts = new Container();
  world.addChild(bg, vignette, tokens, texts);
  app.stage.addChild(world);
}

// Called whenever the Labyrinth tab opens.
export async function showFight() {
  await ensureApp();
  if (!room) {
    await loadRoom('goblins');
    updateButtons();
  }
}

export async function faceDragon() {
  await ensureApp();
  if (busy) return;
  await travel('lair');
}

function vignetteCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 150, 256, 256, 370);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  return c;
}

async function makeToken({ art, crop, r, ring }) {
  const tex = await Assets.load(art);
  const c = new Container();
  const ringW = Math.max(7, r * 0.085);
  const shadow = new Graphics().circle(8, 12, r).fill({ color: 0x000000, alpha: 0.5 });
  const back = new Graphics().circle(0, 0, r).fill({ color: 0x0c0a08 });
  const sp = new Sprite(tex);
  sp.anchor.set(crop.x / 100, crop.y / 100);
  sp.scale.set((2 * r * crop.zoom) / tex.width);
  const mask = new Graphics().circle(0, 0, r - ringW / 2).fill({ color: 0xffffff });
  sp.mask = mask;
  const rim = new Graphics()
    .circle(0, 0, r - ringW / 2).stroke({ width: ringW, color: ring })
    .circle(0, 0, r - ringW).stroke({ width: 2, color: 0x000000, alpha: 0.75 })
    .circle(0, 0, r).stroke({ width: 3, color: 0x000000, alpha: 0.85 });
  const flash = new Graphics().circle(0, 0, r).fill({ color: 0xffffff });
  flash.alpha = 0;
  flash.blendMode = 'add';
  const hpBack = new Graphics().roundRect(-r * 0.75, r + 12, r * 1.5, 18, 9).fill({ color: 0x000000, alpha: 0.85 });
  const hpFill = new Graphics();
  c.addChild(shadow, back, sp, mask, rim, flash, hpBack, hpFill);
  return { c, sp, flash, hpFill, r, frac: 1 };
}

function drawHp(tok, frac) {
  tok.frac = frac;
  const { r } = tok;
  const color = frac > 0.5 ? 0x74c24e : frac > 0.25 ? 0xe2b23a : RED;
  tok.hpFill.clear();
  if (frac > 0) tok.hpFill.roundRect(-r * 0.75 + 3, r + 15, Math.max(6, (r * 1.5 - 6) * frac), 12, 6).fill({ color });
}

function tweenHp(tok, to) {
  const from = tok.frac;
  return animate(380, (k) => drawHp(tok, from + (to - from) * k));
}

async function loadRoom(id) {
  room = { id, ...ROOMS[id] };
  const tex = await Assets.load(room.art);
  bg.texture = tex;
  bg.width = SIZE;
  bg.height = SIZE;
  bg.tint = id === 'lair' ? 0xffb4a4 : 0xffffff;
  for (const child of tokens.removeChildren()) child.destroy({ children: true });
  for (const child of texts.removeChildren()) child.destroy();

  const hd = heroData();
  const max = hd.hp;
  const hp = state.heroHp[hd.id] ?? max;
  hero = { data: hd, name: hd.name, max, hp, tok: await makeToken({ art: hd.art, crop: hd.crop, r: 112, ring: hexOf(hd.banner) }) };
  hero.tok.c.position.set(HERO_POS.x, HERO_POS.y);
  drawHp(hero.tok, hp / max);
  tokens.addChild(hero.tok.c);

  const list = room.monsters.map((k) => MONSTERS[k]);
  const slots = MON_POS[list.length];
  mons = [];
  for (const [i, m] of list.entries()) {
    const s = slots[i];
    const tok = await makeToken({ art: m.art, crop: m.crop, r: s.r, ring: m.boss ? 0x7a1414 : 0x2e2822 });
    tok.c.position.set(s.x, s.y);
    drawHp(tok, 1);
    tokens.addChild(tok.c);
    mons.push({ data: m, name: tr(m.name), hp: m.hp, max: m.hp, alive: true, tok });
  }
  fought = false;
  updateHead();
  const all = [hero, ...mons];
  for (const u of all) { u.tok.c.alpha = 0; u.tok.c.scale.set(0.6); }
  await Promise.all(all.map((u, i) => wait(i * 90).then(() => animate(420, (k) => {
    u.tok.c.alpha = Math.min(1, k * 1.5);
    u.tok.c.scale.set(0.6 + 0.4 * k);
  }, ease.outBack))));
}

function updateHead() {
  if (!room) return;
  ui.floor.textContent = t('floor', { n: room.floor });
  ui.roomName.textContent = t(room.name);
  ui.hpLabel.textContent = t('health');
  ui.stLabel.textContent = t('stamina');
  if (hero) {
    ui.hpFill.style.width = `${(100 * hero.hp) / hero.max}%`;
    ui.hpNum.textContent = `${hero.hp}/${hero.max}`;
  }
  ui.stFill.style.width = `${(100 * state.stamina) / state.staminaMax}%`;
  ui.stNum.textContent = `${state.stamina}/${state.staminaMax}`;
  updateButtons();
}

function updateButtons() {
  ui.fightBtn.textContent = fought ? t('fightAgain') : t('fight');
  ui.saveBtn.textContent = t('deathSavesDemo');
  ui.fightBtn.disabled = busy;
  ui.saveBtn.disabled = busy;
}

function toClient(x, y) {
  const b = app.canvas.getBoundingClientRect();
  return [b.left + (x / SIZE) * b.width, b.top + (y / SIZE) * b.height];
}

function shakeWorld(strength = 18, dur = 420) {
  return animate(dur, (k) => {
    const s = strength * (1 - k);
    world.position.set(k < 1 ? rand(-s, s) : 0, k < 1 ? rand(-s, s) : 0);
  }, ease.linear);
}

function floatText(x, y, str, { color = 0xffffff, size = 60, rise = 100, dur = 950 } = {}) {
  const tx = new Text({
    text: str,
    style: {
      fontFamily: headFont(), fontSize: size, fontWeight: '800', fill: color,
      stroke: { color: 0x000000, width: Math.round(size / 6) },
      dropShadow: { color: 0x000000, blur: 8, distance: 4, alpha: 0.8, angle: Math.PI / 2 },
    },
  });
  tx.anchor.set(0.5);
  tx.position.set(x, y);
  texts.addChild(tx);
  animate(dur, (k) => {
    tx.y = y - rise * k;
    tx.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    tx.scale.set(1 + 0.25 * Math.sin(Math.min(1, k * 5) * Math.PI));
  }, ease.outCubic).then(() => tx.destroy());
}

function banner(str, color = 0xf1d49a) {
  const tx = new Text({
    text: str,
    style: {
      fontFamily: headFont(), fontSize: 120, fontWeight: '800', fill: color, letterSpacing: 4,
      stroke: { color: 0x000000, width: 14 },
      dropShadow: { color: 0x000000, blur: 18, distance: 0, alpha: 0.9 },
    },
  });
  tx.anchor.set(0.5);
  tx.position.set(512, 530);
  texts.addChild(tx);
  return animate(1500, (k) => {
    tx.scale.set(k < 0.2 ? 0.6 + 2 * k : 1);
    tx.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
  }, ease.linear).then(() => tx.destroy());
}

function log(line, cls = '') {
  ui.log.prepend(el('li', { class: cls }, line));
  while (ui.log.children.length > 4) ui.log.lastChild.remove();
}

function message(text, ms = 2600) {
  ui.msg.textContent = text;
  ui.msg.hidden = false;
  ui.msg.classList.remove('show');
  requestAnimationFrame(() => ui.msg.classList.add('show'));
  clearTimeout(ui.msgTimer);
  ui.msgTimer = setTimeout(() => { ui.msg.hidden = true; }, ms);
}

// ---------- the mock fight ----------

function strike(a, b, luck = 0) {
  let d20 = randInt(1, 20);
  if (luck && Math.random() < luck) d20 = 20;
  const crit = d20 === 20;
  const nat1 = d20 === 1;
  const hit = crit || (!nat1 && d20 + a.atk >= b.ac);
  let dmg = 0;
  if (hit) {
    const [n, s, bonus] = a.dmg;
    dmg = roll(crit ? n * 2 : n, s).reduce((x, y) => x + y, 0) + bonus;
    b.hp = Math.max(0, b.hp - dmg);
  }
  return { type: 'attack', from: a.idx, to: b.idx, d20, crit, nat1, hit, dmg, hpAfter: b.hp, aName: a.name, bName: b.name };
}

function simulate() {
  const H = { idx: -1, name: hero.name, hp: hero.hp, ac: hero.data.ac, atk: hero.data.atk, dmg: hero.data.dmg };
  const M = mons.map((m, i) => ({ idx: i, name: m.name, hp: m.hp, ac: m.data.ac, atk: m.data.atk, dmg: m.data.dmg, boss: m.data.boss }));
  const events = [];
  for (let round = 0; round < 40 && H.hp > 0 && M.some((m) => m.hp > 0); round++) {
    const target = M.find((m) => m.hp > 0);
    events.push(strike(H, target, target.boss ? 0.08 : 0.22)); // demo luck: more crits to look at
    if (target.hp <= 0) events.push({ type: 'kill', idx: target.idx });
    if (!M.some((m) => m.hp > 0)) break;
    for (const m of M) {
      if (m.hp <= 0) continue;
      events.push(strike(m, H, m.boss ? 0.25 : 0));
      if (H.hp <= 0) { events.push({ type: 'down' }); break; }
    }
  }
  if (H.hp > 0 && !M.some((m) => m.hp > 0)) events.push({ type: 'victory' });
  return events;
}

const unit = (idx) => (idx === -1 ? hero : mons[idx]);

async function playAttack(ev) {
  const A = unit(ev.from);
  const B = unit(ev.to);
  if (ev.crit || ev.nat1) await showD20(ev.d20, { label: `${ev.aName}` });
  const ax = A.tok.c.x;
  const ay = A.tok.c.y;
  const dx = B.tok.c.x - ax;
  const dy = B.tok.c.y - ay;
  sfx.swing();
  await animate(170, (k) => { A.tok.c.position.set(ax + dx * 0.32 * k, ay + dy * 0.32 * k); }, ease.inCubic);
  if (ev.hit) impact(B, ev);
  else {
    floatText(B.tok.c.x, B.tok.c.y - B.tok.r * 0.2, t('miss'), { color: 0xb9b0a0, size: 48 });
    sfx.miss();
  }
  await animate(230, (k) => { A.tok.c.position.set(ax + dx * 0.32 * (1 - k), ay + dy * 0.32 * (1 - k)); }, ease.outCubic);
  if (ev.hit) log(t(ev.crit ? 'logCrit' : 'logHit', { a: ev.aName, b: ev.bName, d: ev.dmg }), ev.crit ? 'crit' : '');
  else log(t('logMiss', { a: ev.aName, b: ev.bName }), 'miss');
  await wait(ev.crit ? 380 : 160);
}

function impact(B, ev) {
  B.hp = ev.hpAfter;
  tweenHp(B.tok, B.hp / B.max);
  if (B === hero) updateHead();
  B.tok.flash.alpha = ev.crit ? 1 : 0.75;
  animate(ev.crit ? 420 : 260, (k) => { B.tok.flash.alpha = (ev.crit ? 1 : 0.75) * (1 - k); });
  const bx = B.tok.c.x;
  const by = B.tok.c.y;
  animate(260, (k) => {
    const s = 12 * (1 - k);
    B.tok.c.position.set(bx + (k < 1 ? rand(-s, s) : 0), by + (k < 1 ? rand(-s, s) : 0));
  }, ease.linear);
  const [cx, cy] = toClient(bx, by);
  if (ev.crit) {
    floatText(bx, by - B.tok.r * 0.25, `−${ev.dmg}!`, { color: GOLD, size: 92, rise: 140, dur: 1200 });
    floatText(bx, by - B.tok.r - 30, t('crit'), { color: GOLD, size: 54, rise: 60, dur: 1200 });
    sfx.crit();
    shakeWorld(22, 480);
    fx.sparks(cx, cy, 0xffd27a, 34);
    fx.ring(cx, cy, GOLD, 140, 0.6, 8);
  } else {
    floatText(bx, by - B.tok.r * 0.25, `−${ev.dmg}`, { color: B === hero ? 0xff8a7a : 0xffffff, size: 64 });
    sfx.hit();
    fx.sparks(cx, cy);
  }
}

async function playKill(ev) {
  const m = mons[ev.idx];
  m.alive = false;
  lastKill = { x: m.tok.c.x, y: m.tok.c.y };
  sfx.kill();
  log(t('logKill', { b: m.name }), 'kill');
  const grey = new ColorMatrixFilter();
  grey.desaturate();
  grey.brightness(1.25, true);
  m.tok.sp.filters = [grey];
  const slash = new Graphics();
  m.tok.c.addChild(slash);
  await animate(420, (k) => {
    m.tok.c.alpha = 1 - 0.3 * k;
    m.tok.c.scale.set(1 - 0.1 * k);
    const r = m.tok.r * 0.7;
    slash.clear().moveTo(-r, -r).lineTo(-r + 2 * r * k, -r + 2 * r * k).stroke({ width: 14, color: 0xb01414, alpha: 0.95 });
  });
}

async function playVictory() {
  fought = true;
  sfx.victory();
  banner(t('victory'));
  await wait(750);
  const tier = weighted(DEMO_DROP);
  const item = makeItem({ tier });
  const color = hexOf(TIER_COLOR[tier]);
  const orb = new Graphics()
    .circle(0, 0, 20).fill({ color })
    .circle(0, 0, 30).stroke({ width: 5, color: 0xffffff, alpha: 0.85 });
  texts.addChild(orb);
  const to = { x: 512, y: 560 };
  await animate(650, (k) => {
    orb.position.set(lastKill.x + (to.x - lastKill.x) * k, lastKill.y + (to.y - lastKill.y) * k - Math.sin(k * Math.PI) * 170);
    orb.rotation = k * 6;
  }, ease.inOutCubic);
  const [cx, cy] = toClient(to.x, to.y);
  fx.reveal(tier, cx, cy, { radiant: item.identified && item.radiant });
  animate(500, (k) => { orb.alpha = 1 - k; orb.scale.set(1 + k); }).then(() => orb.destroy());
  await wait(1100);
  openItemSheet(item, { title: t('victory') });
  showDoors();
}

async function runFight() {
  busy = true;
  updateButtons();
  ui.doors.hidden = true;
  let fightOn = true;
  while (fightOn) {
    fightOn = false;
    for (const ev of simulate()) {
      if (ev.type === 'attack') await playAttack(ev);
      else if (ev.type === 'kill') await playKill(ev);
      else if (ev.type === 'victory') await playVictory();
      else if (ev.type === 'down') {
        const outcome = await heroDown();
        if (outcome === 'rise' && mons.some((m) => m.alive)) fightOn = true;
      }
    }
  }
  state.heroHp[hero.data.id] = hero.hp;
  busy = false;
  updateHead();
}

async function onFightButton() {
  if (busy) return;
  ui.log.replaceChildren();
  if (fought || !mons.some((m) => m.alive)) await travel(room.id, { door: false });
  else await runFight();
}

async function travel(roomId, { door = true } = {}) {
  if (door) {
    if (state.stamina <= 0) { message(t('noStamina')); return; }
    state.stamina -= 1;
    sfx.door();
  }
  busy = true;
  updateButtons();
  ui.doors.hidden = true;
  ui.log.replaceChildren();
  await animate(320, (k) => { world.alpha = 1 - k; });
  await loadRoom(roomId);
  await animate(320, (k) => { world.alpha = k; });
  await runFight();
}

// ---------- Doors and Clues ----------

function showDoors() {
  const options = ['goblins', 'crypt', 'demons'].sort(() => Math.random() - 0.5);
  renderDoors(options);
}

function renderDoors(options) {
  ui.doors.options = options;
  ui.doors.replaceChildren(
    el('div', { class: 'doors-title' }, t('chooseDoor')),
    ...['top', 'left', 'right'].map((side, i) => el('button', {
      class: `door door-${side}`,
      onclick: () => travel(options[i]),
    }, el('span', { class: 'door-clue' }, `“${t(ROOMS[options[i]].clue)}”`), el('span', { class: 'door-cost' }, t('moveCost')))),
    el('div', { class: 'door door-bottom back' }, el('span', { class: 'door-clue' }, t('cameFrom'))),
  );
  ui.doors.hidden = false;
}

// ---------- the d20 ----------

function drawDie(g, R, stroke, fill) {
  const P = (deg, rr) => [Math.cos((deg * Math.PI) / 180) * rr, Math.sin((deg * Math.PI) / 180) * rr];
  const H = [-90, -30, 30, 90, 150, 210].map((d) => P(d, R));
  const T = [-90, 30, 150].map((d) => P(d, R * 0.56));
  g.clear();
  g.poly(H.flat()).fill({ color: fill }).stroke({ width: 7, color: stroke });
  g.poly(T.flat()).stroke({ width: 4, color: stroke, alpha: 0.9 });
  for (const [ti, hi] of [[0, 0], [0, 1], [0, 5], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5]]) {
    g.moveTo(...T[ti]).lineTo(...H[hi]);
  }
  g.stroke({ width: 3, color: stroke, alpha: 0.65 });
}

function ensureDice() {
  if (dice) return dice;
  const layer = new Container();
  const dim = new Graphics().rect(0, 0, SIZE, SIZE).fill({ color: 0x000000, alpha: 0.6 });
  const die = new Container();
  die.position.set(512, 470);
  const shape = new Graphics();
  const num = new Text({ text: '20', style: { fontFamily: headFont(), fontSize: 92, fontWeight: '800', fill: BONE, stroke: { color: 0x000000, width: 8 } } });
  num.anchor.set(0.5);
  num.y = 6;
  die.addChild(shape, num);
  const label = new Text({ text: '', style: { fontFamily: headFont(), fontSize: 50, fontWeight: '700', fill: BONE, stroke: { color: 0x000000, width: 7 } } });
  label.anchor.set(0.5);
  label.position.set(512, 250);
  const result = new Text({ text: '', style: { fontFamily: headFont(), fontSize: 58, fontWeight: '800', fill: GOLD, stroke: { color: 0x000000, width: 8 }, align: 'center', wordWrap: true, wordWrapWidth: 900 } });
  result.anchor.set(0.5);
  result.position.set(512, 700);
  const pips = new Container();
  pips.position.set(512, 800);
  layer.addChild(dim, die, label, result, pips);
  layer.visible = false;
  app.stage.addChild(layer);
  dice = { layer, die, shape, num, label, result, pips };
  drawDie(shape, 150, BONE, 0x1b1611);
  return dice;
}

async function showD20(value, { label = '', keep = false } = {}) {
  const d = ensureDice();
  d.label.style.fontFamily = headFont();
  d.num.style.fontFamily = headFont();
  d.label.text = label;
  d.result.text = '';
  if (!keep) d.pips.removeChildren();
  d.layer.visible = true;
  d.layer.alpha = 1;
  drawDie(d.shape, 150, BONE, 0x1b1611);
  d.num.style.fill = BONE;
  sfx.dice();
  await animate(760, (k) => {
    d.die.rotation = (1 - k) * 7;
    d.die.scale.set(0.45 + 0.55 * k);
    if (k < 0.92) d.num.text = String(randInt(1, 20));
  }, ease.outCubic);
  d.die.rotation = 0;
  d.num.text = String(value);
  const crit = value === 20;
  const fumble = value === 1;
  const color = crit ? GOLD : fumble ? RED : BONE;
  drawDie(d.shape, 150, color, crit ? 0x3a2a08 : fumble ? 0x2a0b0b : 0x1b1611);
  d.num.style.fill = color;
  sfx.diceLand(value >= 10);
  if (crit) {
    vibrate([40, 30, 90]);
    const [cx, cy] = toClient(512, 470);
    fx.glow(cx, cy, GOLD, 190, 1.1);
    fx.burst(cx, cy, GOLD, 40, 300);
    d.result.text = t('crit');
    d.result.style.fill = GOLD;
  } else if (fumble) {
    d.result.text = t('nat1');
    d.result.style.fill = RED;
  }
  await animate(280, (k) => d.die.scale.set(1.28 - 0.28 * k), ease.outCubic);
  await wait(keep ? 350 : 700);
  if (!keep) await hideD20();
}

async function hideD20() {
  const d = ensureDice();
  await animate(220, (k) => { d.layer.alpha = 1 - k; });
  d.layer.visible = false;
}

function drawPips(s, f) {
  const d = ensureDice();
  d.pips.removeChildren();
  const row = (count, filled, color, y) => {
    for (let i = 0; i < 3; i++) {
      const g = new Graphics().circle((i - 1) * 64, y, 22).stroke({ width: 5, color });
      if (i < Math.min(filled, 3)) g.circle((i - 1) * 64, y, 15).fill({ color });
      d.pips.addChild(g);
    }
  };
  row(3, s, 0x74c24e, 0);
  row(3, f, RED, 70);
  const style = { fontFamily: headFont(), fontSize: 30, fontWeight: '700', stroke: { color: 0x000000, width: 5 } };
  const ls = new Text({ text: t('success'), style: { ...style, fill: 0x9fd98a } });
  const lf = new Text({ text: t('failure'), style: { ...style, fill: 0xff8a7a } });
  ls.anchor.set(0, 0.5);
  lf.anchor.set(0, 0.5);
  ls.position.set(116, 0);
  lf.position.set(116, 70);
  d.pips.addChild(ls, lf);
}

// Death saves: d20 until 3 successes (10+) or 3 failures. 20 = back up, 1 = two failures.
async function deathSaves() {
  let s = 0;
  let f = 0;
  let n = 0;
  drawPips(0, 0);
  while (s < 3 && f < 3) {
    n += 1;
    const v = randInt(1, 20);
    await showD20(v, { label: `${t('deathSaves')} · ${n}`, keep: true });
    if (v === 20) return 'rise';
    if (v === 1) f += 2;
    else if (v >= 10) s += 1;
    else f += 1;
    drawPips(s, f);
    await wait(420);
  }
  return s >= 3 ? 'survive' : 'dead';
}

async function heroDown() {
  hero.hp = 0;
  drawHp(hero.tok, 0);
  updateHead();
  sfx.down();
  log(t('logDown', { a: hero.name }), 'down');
  const red = new Graphics().rect(0, 0, SIZE, SIZE).fill({ color: 0x5a0000 });
  red.alpha = 0;
  world.addChild(red);
  await animate(600, (k) => { red.alpha = 0.45 * Math.sin(k * Math.PI); });
  red.destroy();
  const outcome = await deathSaves();
  const d = ensureDice();
  const [cx, cy] = toClient(HERO_POS.x, HERO_POS.y);
  if (outcome === 'rise') {
    d.result.text = t('rise');
    d.result.style.fill = GOLD;
    hero.hp = Math.ceil(hero.max * 0.25);
    fx.reveal('relic', cx, cy, { sound: false });
    sfx.crit();
  } else if (outcome === 'survive') {
    d.result.text = t('survived');
    d.result.style.fill = 0x9fd98a;
    hero.hp = 1;
  } else {
    d.result.text = t('died');
    d.result.style.fill = 0xff8a7a;
    const grey = new ColorMatrixFilter();
    grey.desaturate();
    hero.tok.sp.filters = [grey];
    sfx.down();
  }
  drawHp(hero.tok, hero.hp / hero.max);
  updateHead();
  await wait(2300);
  await hideD20();
  if (outcome === 'survive') showDoors();
  if (outcome === 'dead') {
    state.heroHp[hero.data.id] = hero.max;
    message(t('died'), 3000);
    await animate(400, (k) => { world.alpha = 1 - k; });
    await loadRoom('goblins');
    await animate(400, (k) => { world.alpha = k; });
  }
  return outcome;
}

async function demoDeathSaves() {
  if (busy || !hero) return;
  busy = true;
  updateButtons();
  ui.doors.hidden = true;
  const outcome = await heroDown();
  if (outcome === 'rise' && mons.some((m) => m.alive)) {
    busy = false;
    await runFight();
  }
  state.heroHp[hero.data.id] = hero.hp;
  busy = false;
  updateHead();
}

// Called when another Hero is picked on the Heroes screen.
export async function heroChanged() {
  if (!app || busy) return;
  room = null;
  await showFight();
}
