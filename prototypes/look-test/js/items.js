// PROTOTYPE items: generation, tiles, full cards and the identify reveal.
import {
  BASES, SUFFIXES, DRAGONBONE, BONUS_STATS, BONUS_COUNT, BUYBACK, OWNERS, TIER_COLOR, tierRank,
} from './data.js';
import { t, tr } from './i18n.js';
import { el, pick, randInt, animate, wait } from './util.js';
import { itemIcon } from './icons.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import { openSheet } from './sheet.js';

let uid = 0;

const UNIQUE = {
  legendary: {
    name: { en: 'Ember Fang', ru: 'Угольный клык' },
    power: DRAGONBONE.power,
  },
  mythic: {
    name: { en: 'Wyrmfire', ru: 'Пламя змия' },
    power: { en: 'Wyrmfire: every critical hit also scorches all other enemies.', ru: 'Пламя змия: каждый критический удар обжигает и остальных врагов.' },
  },
  relic: {
    name: DRAGONBONE.name,
    power: { en: 'Dragon’s memory: once per Run, survive a killing blow with 1 health.', ru: 'Память дракона: раз за вылазку герой выживает после смертельного удара с 1 здоровья.' },
  },
};

export function makeItem({ tier, baseId, radiant, identified, radiantChance = 0.1 } = {}) {
  const r = tierRank(tier);
  const painted = r >= 4;
  const base = painted ? BASES.find((b) => b.id === 'sword') : (BASES.find((b) => b.id === baseId) ?? pick(BASES));
  const count = BONUS_COUNT[tier];
  const pool = [...BONUS_STATS].sort(() => Math.random() - 0.5).slice(0, count);
  const boost = 1 + r * 0.18;
  const itemLevel = randInt(3, 9);
  const suffix = r >= 1 && !painted ? pick(SUFFIXES) : null;
  const item = {
    uid: ++uid,
    tier,
    base,
    icon: base.icon,
    art: painted ? DRAGONBONE.art : null,
    name: painted
      ? UNIQUE[tier].name
      : { en: suffix ? `${base.name.en} ${suffix.en}` : base.name.en, ru: suffix ? `${base.name.ru} ${suffix.ru}` : base.name.ru },
    itemLevel,
    quality: randInt(1, 100),
    bonus: pool.map((s) => ({ s, n: Math.round(randInt(s.range[0], s.range[1]) * boost) })),
    power: painted ? UNIQUE[tier].power : null,
    radiant: radiant ?? Math.random() < radiantChance,
    identified: identified ?? r < 2,
    serial: tier === 'relic' ? { n: 2, m: 3 } : null,
    owners: tier === 'relic' ? OWNERS.slice(0, 2) : null,
  };
  item.worth = Math.round(BUYBACK[tier] * (1 + itemLevel / 10) * (item.radiant ? 1.5 : 1));
  return item;
}

function art(item, big = false) {
  const box = el('div', { class: `item-art${big ? ' big' : ''}` });
  if (item.art) box.append(el('img', { src: item.art, alt: '', draggable: 'false' }));
  else box.innerHTML = itemIcon(item.icon);
  return box;
}

const tierClasses = (item) => `tier-${item.tier}${item.radiant && item.identified ? ' radiant' : ''}${item.identified ? '' : ' unidentified'}`;

// Small square used in the spin strip, gallery and equipment slots.
export function tileEl(item, { label = false, onclick } = {}) {
  const tile = el('button', { class: `item-tile ${tierClasses(item)}`, type: 'button', style: { '--tier': TIER_COLOR[item.tier] }, onclick },
    art(item),
    item.serial ? el('span', { class: 'tile-serial' }, `#${item.serial.n}/${item.serial.m}`) : null,
  );
  if (!label) return tile;
  return el('div', { class: 'tile-wrap' }, tile, el('div', { class: 'tile-label', style: { color: TIER_COLOR[item.tier] } }, t(`tier_${item.tier}`)));
}

// Full card. Unidentified cards hide quality, bonus stats, power and Radiant.
export function cardEl(item) {
  const card = el('article', { class: `item-card ${tierClasses(item)}`, style: { '--tier': TIER_COLOR[item.tier] } });
  fillCard(card, item);
  return card;
}

function fillCard(card, item, { hideDetails = false } = {}) {
  card.className = `item-card ${tierClasses(item)}`;
  const known = item.identified;
  const meta = `${t(`tier_${item.tier}`)} · ${tr(item.base.name)} · ${t('itemLevel', { n: item.itemLevel })}`;
  card.replaceChildren(
    el('div', { class: 'card-top' },
      art(item, true),
      item.radiant && known ? el('div', { class: 'radiant-stamp' }, t('radiant')) : null,
    ),
    el('div', { class: 'card-body' },
      el('h3', { class: 'card-name' }, known ? tr(item.name) : tr(item.base.name)),
      el('div', { class: 'card-meta' }, meta),
      item.serial ? el('div', { class: 'card-serial' }, t('relicSerial', item.serial)) : null,
      known
        ? el('div', { class: 'card-quality' },
          el('span', {}, t('quality')),
          el('span', { class: 'q-bar' }, el('span', { class: 'q-fill', style: { width: hideDetails ? '0%' : `${item.quality}%` } })),
          el('span', { class: 'q-num' }, hideDetails ? '0%' : `${item.quality}%`))
        : el('div', { class: 'card-unknown' }, el('strong', {}, t('unidentified')), el('span', {}, t('unidentifiedHint'))),
      el('ul', { class: 'card-stats' },
        known
          ? item.bonus.map(({ s, n }) => el('li', { class: hideDetails ? 'pending' : '' }, tr(s).replace('{n}', n)))
          : [el('li', { class: 'mystery' }, '???'), el('li', { class: 'mystery' }, '???')]),
      known && item.power ? el('p', { class: `card-power${hideDetails ? ' pending' : ''}` }, tr(item.power)) : null,
      known && item.owners ? el('div', { class: 'card-owners' }, t('owners', { list: item.owners.join(' → ') })) : null,
      el('div', { class: 'card-worth' }, t('worth', { n: item.worth.toLocaleString() })),
    ),
  );
}

// The identify reveal: shimmer, then quality counts up, stats pop one by one, then Radiant.
export async function identify(card, item) {
  card.classList.add('identifying');
  sfx.identify();
  await wait(950);
  item.identified = true;
  fillCard(card, item, { hideDetails: true });
  card.classList.add('revealed');
  const [x, y] = fx.centerOf(card.querySelector('.item-art'));
  fx.glow(x, y, Number.parseInt(TIER_COLOR[item.tier].slice(1), 16), 140, 0.8, 0.7);
  const fill = card.querySelector('.q-fill');
  const num = card.querySelector('.q-num');
  await animate(750, (k) => {
    const q = Math.round(item.quality * k);
    fill.style.width = `${q}%`;
    num.textContent = `${q}%`;
  });
  const pending = [...card.querySelectorAll('.pending')];
  for (const [i, node] of pending.entries()) {
    await wait(170);
    node.classList.remove('pending');
    sfx.statPop(i);
  }
  await wait(250);
  if (item.radiant) {
    card.classList.add('radiant');
    card.querySelector('.card-top').append(el('div', { class: 'radiant-stamp' }, t('radiant')));
  }
  fx.reveal(item.tier, x, y, { radiant: item.radiant });
  card.classList.remove('identifying');
}

// Opens a card in the bottom sheet, with an Identify button when needed.
export function openItemSheet(item, { title } = {}) {
  const card = cardEl(item);
  let btn = null;
  if (!item.identified) {
    btn = el('button', {
      class: 'btn primary wide',
      onclick: async () => { btn.disabled = true; await identify(card, item); btn.remove(); },
    }, t('identify'));
  }
  openSheet(title ?? t(`tier_${item.tier}`), el('div', { class: 'sheet-item' }, card, btn));
}
