// PROTOTYPE Loot screen: every Tier side by side, the Chest Spin, and the identify reveal.
import { CHESTS, TIERS, tierRank } from './data.js';
import { t, onLang } from './i18n.js';
import { el, animate, wait, rand, weighted } from './util.js';
import { itemIcon } from './icons.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import { makeItem, tileEl, cardEl, identify, openItemSheet } from './items.js';

const TILE = 92; // spin tile width + gap, matches CSS
const FORCE = [null, 'rare', 'epic', 'legendary', 'mythic', 'relic'];

let root;
let chest = 'silver';
let forced = null;
let spinning = false;
let gallery = null;
let idItem = null;
let idRadiant = false;

export function initLoot(screen) {
  root = screen;
  gallery = buildGallery();
  idItem = freshMystery();
  render();
  onLang(render);
}

function buildGallery() {
  const list = TIERS.map((tier) => ({ item: makeItem({ tier, identified: true, radiant: false }), label: `tier_${tier}` }));
  list.push({ item: makeItem({ tier: 'epic', identified: true, radiant: true }), label: 'radiant' });
  list.push({ item: makeItem({ tier: 'legendary', identified: false, radiant: false }), label: 'unidentified' });
  return list;
}

const freshMystery = () => makeItem({ tier: weighted([['rare', 3], ['epic', 3], ['legendary', 2], ['mythic', 1]]), identified: false, radiant: idRadiant || undefined });

function section(title, hint, ...body) {
  return el('section', { class: 'section' }, el('h2', { class: 'section-title' }, title), el('p', { class: 'hint' }, hint), ...body);
}

function render() {
  const tiles = gallery.map(({ item, label }) => {
    const wrap = tileEl(item, { label: true, onclick: () => openItemSheet(item) });
    wrap.querySelector('.tile-label').textContent = t(label);
    return wrap;
  });

  const chests = Object.entries(CHESTS).map(([id, c]) => el('button', {
    class: `chest-btn chest-${id}${chest === id ? ' on' : ''}`,
    onclick: () => { chest = id; sfx.click(); render(); },
  }, el('span', { class: 'chest-icon', html: itemIcon('chest') }), el('span', { class: 'chest-name' }, t(`chest${id[0].toUpperCase()}${id.slice(1)}`)), el('span', { class: 'chest-key', html: `${itemIcon('key', 'mini-icon')} ${c.key}` })));

  const forceRow = el('div', { class: 'force-row' },
    el('span', { class: 'force-label' }, t('force')),
    ...FORCE.map((f) => el('button', {
      class: `chip-btn${forced === f ? ' on' : ''}`,
      style: f ? { '--tier': `var(--t-${f})` } : null,
      onclick: () => { forced = f; sfx.click(); render(); },
    }, f ? t(`tier_${f}`) : t('random'))));

  const strip = el('div', { class: 'spin-strip' });
  const win = el('div', { class: 'spin-window' }, strip, el('div', { class: 'spin-marker' }));
  seedStrip(strip);
  const openBtn = el('button', { class: 'btn primary wide', onclick: () => spin(win, strip, openBtn) }, t('openChest', { price: CHESTS[chest].key }));

  const card = cardEl(idItem);
  const idBtn = el('button', {
    class: 'btn primary',
    disabled: idItem.identified,
    onclick: async () => { idBtn.disabled = true; await identify(card, idItem); },
  }, t('identify'));
  const radBtn = el('button', {
    class: `chip-btn${idRadiant ? ' on' : ''}`,
    onclick: () => { idRadiant = !idRadiant; idItem = freshMystery(); render(); },
  }, t('forceRadiant'));
  const nextBtn = el('button', { class: 'btn', onclick: () => { idItem = freshMystery(); render(); } }, t('newItem'));

  root.replaceChildren(
    section(t('tiersTitle'), t('tiersHint'), el('div', { class: 'tier-grid' }, tiles)),
    section(t('chestTitle'), t('chestHint'), el('div', { class: 'chest-picker' }, chests), forceRow, win, openBtn),
    section(t('identifyTitle'), t('identifyHint'), el('div', { class: 'identify-box' }, card, el('div', { class: 'row' }, idBtn, nextBtn, radBtn))),
  );
}

function stripTier(odds) {
  // Decoys follow the chest odds, with top Tiers boosted so near-misses happen.
  return weighted(odds.map(([tier, w]) => [tier, tierRank(tier) >= 4 ? w * 4 : w]));
}

function seedStrip(strip) {
  const odds = CHESTS[chest].odds;
  strip.replaceChildren(...Array.from({ length: 12 }, () => tileEl(makeItem({ tier: stripTier(odds), identified: true, radiant: false }))));
}

async function spin(win, strip, btn) {
  if (spinning) return;
  spinning = true;
  btn.disabled = true;
  const { odds } = CHESTS[chest];
  const tier = forced ?? weighted(odds);
  const prize = makeItem({ tier });
  const count = 64;
  const at = 56;
  const items = Array.from({ length: count }, (_, i) => {
    if (i === at) return prize;
    const near = Math.abs(i - at) <= 2 && Math.random() < 0.45;
    return makeItem({ tier: near ? (Math.random() < 0.5 ? 'legendary' : 'mythic') : stripTier(odds), identified: true, radiant: false });
  });
  strip.replaceChildren(...items.map((it) => tileEl(it)));
  strip.style.transform = 'translateX(0px)';
  sfx.click();
  const w = win.clientWidth;
  const target = at * TILE + (TILE - 8) / 2 - w / 2 + rand(-TILE * 0.38, TILE * 0.38);
  let last = -1;
  await animate(5600, (k) => {
    const x = target * k;
    strip.style.transform = `translateX(${-x}px)`;
    const idx = Math.floor((x + w / 2) / TILE);
    if (idx !== last) { last = idx; sfx.tick(); }
  }, (p) => 1 - (1 - p) ** 4.2);
  await wait(250);
  const won = strip.children[at];
  won.classList.add('won');
  const [x, y] = fx.centerOf(won);
  fx.reveal(tier, x, y, { radiant: prize.identified && prize.radiant });
  await wait(tierRank(tier) >= 4 ? 1500 : 900);
  openItemSheet(prize);
  spinning = false;
  btn.disabled = false;
}
