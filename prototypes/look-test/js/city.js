// PROTOTYPE City: the inked town map with tappable Buildings and a little life on it.
import { BUILDINGS, TORCHES, SMOKE, HEROES, TIER_COLOR } from './data.js';
import { t, tr, onLang } from './i18n.js';
import { el } from './util.js';
import { uiIcon } from './icons.js';
import { openSheet, closeSheet } from './sheet.js';
import { makeItem, tileEl, openItemSheet } from './items.js';
import { state } from './state.js';

let hooks = {};
let root = null;

export function initCity(screen, { goFight, faceDragon, goLoot }) {
  hooks = { goFight, faceDragon, goLoot };
  root = screen;
  render();
  onLang(render);
}

function render() {
  const pins = BUILDINGS.map((b) => el('button', {
    class: `pin${b.later ? ' later' : ''}`,
    style: { left: `${b.x}%`, top: `${b.y}%` },
    onclick: () => openBuilding(b),
  },
  el('span', { class: 'pin-dot' }),
  el('span', { class: 'pin-label', html: b.later ? `${uiIcon('lock')}${t(`b_${b.id}`)}` : '' }, b.later ? null : t(`b_${b.id}`))));

  const torches = TORCHES.map(([x, y], i) => el('span', { class: 'torch', style: { left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.37}s` } }));
  const smoke = [0, 1, 2].map((i) => el('span', { class: 'smoke', style: { left: `${SMOKE[0]}%`, top: `${SMOKE[1]}%`, animationDelay: `${-i * 1.6}s` } }));

  root.replaceChildren(
    el('div', { class: 'city-bar' },
      el('span', { class: 'chip' }, t('seasonChip')),
      el('span', { class: 'chip gold' }, t('goldChip', { n: state.gold.toLocaleString() }))),
    el('div', { class: 'city-map' },
      el('img', { src: 'assets/city-map.jpg', alt: '', draggable: 'false' }),
      el('div', { class: 'fog fog-a' }),
      el('div', { class: 'fog fog-b' }),
      ...torches, ...smoke, ...pins),
  );
}

const token = (hero, size = 'sm') => el('span', { class: `token ${size}`, style: { '--ring': hero.banner } },
  el('img', { src: hero.art, alt: '', style: { objectPosition: `${hero.crop.x}% ${hero.crop.y}%`, transform: `scale(${hero.crop.zoom})` } }));

function itemName(item) {
  return el('span', { class: 'inline-item', style: { color: TIER_COLOR[item.tier] } }, `[${tr(item.name)}]`);
}

function feedLine(key, vars) {
  const text = t(key, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === 'string' || typeof v === 'number' ? v : '§'])));
  const parts = text.split('§');
  const nodes = [];
  parts.forEach((p, i) => {
    nodes.push(p);
    if (i < parts.length - 1) nodes.push(vars.item ? itemName(vars.item) : '');
  });
  return el('li', {}, ...nodes);
}

function tavernBody() {
  const [g, e, p, b] = HEROES;
  const mythic = makeItem({ tier: 'mythic', identified: true });
  const epic = makeItem({ tier: 'epic', identified: true });
  const leg = makeItem({ tier: 'legendary', identified: true });
  return el('div', { class: 'building' },
    el('p', { class: 'lede' }, t('b_tavern_desc')),
    el('h3', { class: 'sub' }, t('online')),
    el('div', { class: 'online' }, ...HEROES.map((h) => el('div', { class: 'online-hero' }, token(h), el('span', {}, h.name)))),
    el('h3', { class: 'sub' }, t('feed')),
    el('ul', { class: 'feed' },
      feedLine('feedFound', { hero: e.name, item: mythic }),
      feedLine('feedVault', {}),
      feedLine('feedSold', { hero: p.name, item: epic, gold: '2,400' }),
      feedLine('feedGrave', { hero: b.name, n: 4 }),
      feedLine('feedUpgrade', { hero: g.name, item: leg })),
  );
}

function shopBody(desc, tiers, withSeller = false) {
  const names = HEROES.map((h) => h.name);
  const rows = tiers.map((tier, i) => {
    const item = makeItem({ tier, identified: true, radiant: false });
    const price = withSeller ? Math.round(item.worth * (2 + Math.random() * 2)) : Math.round(item.worth * 4);
    return el('div', { class: 'listing' },
      tileEl(item, { onclick: () => openItemSheet(item) }),
      el('div', { class: 'listing-text' },
        el('strong', { style: { color: TIER_COLOR[tier] } }, tr(item.name)),
        el('span', { class: 'muted' }, withSeller ? `${t(`tier_${tier}`)} · ${names[i % names.length]}` : t(`tier_${tier}`))),
      el('button', { class: 'btn small' }, `${price.toLocaleString()}`));
  });
  return el('div', { class: 'building' },
    el('p', { class: 'lede' }, desc),
    el('h3', { class: 'sub' }, withSeller ? t('listings') : t('forSale')),
    el('div', { class: 'listings' }, rows));
}

function gateBody() {
  const dragon = el('div', { class: 'boss-preview' },
    el('div', { class: 'boss-token' }, el('img', { src: 'assets/boss-dragon.png', alt: '' }), el('span', { class: 'embers' })),
    el('div', {},
      el('div', { class: 'boss-name' }, t('bossName')),
      el('div', { class: 'muted' }, t('bossGate'))));
  return el('div', { class: 'building' },
    el('p', { class: 'lede' }, t('b_gate_desc')),
    dragon,
    el('div', { class: 'stack' },
      el('button', { class: 'btn primary wide', onclick: () => { closeSheet(); hooks.goFight(); } }, t('enterLabyrinth')),
      el('button', { class: 'btn wide danger', onclick: () => { closeSheet(); hooks.faceDragon(); } }, t('faceDragon'))));
}

function openBuilding(b) {
  const title = t(`b_${b.id}`);
  let body;
  switch (b.id) {
    case 'tavern': body = tavernBody(); break;
    case 'shops': body = shopBody(t('b_shops_desc'), ['common', 'uncommon', 'uncommon']); break;
    case 'market': body = shopBody(t('b_market_desc'), ['rare', 'epic', 'legendary', 'mythic'], true); break;
    case 'gate': body = gateBody(); break;
    case 'forge':
      body = el('div', { class: 'building' }, el('p', { class: 'lede' }, t('b_forge_desc')),
        el('button', { class: 'btn primary wide', onclick: () => { closeSheet(); hooks.goLoot(); } }, t('toLoot')));
      break;
    default: body = el('div', { class: 'building' }, el('p', { class: 'lede' }, t(`b_${b.id}_desc`)));
  }
  openSheet(title, body);
}
