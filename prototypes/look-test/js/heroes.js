// PROTOTYPE Heroes screen: portraits as tokens, a character sheet, rolled ability scores
// (4d6 drop the lowest, up to 3 rerolls) and a Diablo-style equipment layout.
import { HEROES } from './data.js';
import { t, tr, onLang } from './i18n.js';
import { el, animate, wait, randInt, mod, fmtMod } from './util.js';
import { sfx } from './audio.js';
import { makeItem, tileEl, openItemSheet } from './items.js';
import { state } from './state.js';

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const AB_RU = { STR: 'СИЛ', DEX: 'ЛОВ', CON: 'ТЕЛ', INT: 'ИНТ', WIS: 'МДР', CHA: 'ХАР' };
const MIN_TOTAL = 65;

let root;
let onPick = () => {};
const gear = {};
const rerolls = {};
let rolling = false;

export function initHeroes(screen, { heroChanged }) {
  root = screen;
  onPick = heroChanged;
  render();
  onLang(render);
}

const current = () => HEROES.find((h) => h.id === state.heroId);

function gearFor(hero) {
  if (gear[hero.id]) return gear[hero.id];
  const off = hero.id === 'rogue' ? 'dagger' : hero.id === 'wizard' ? 'amulet' : 'shield';
  gear[hero.id] = {
    head: makeItem({ tier: 'rare', baseId: 'helm', identified: true }),
    amulet: makeItem({ tier: 'epic', baseId: 'amulet', identified: true, radiant: true }),
    main: makeItem({ tier: 'legendary', identified: true, radiant: false }),
    off: makeItem({ tier: 'uncommon', baseId: off, identified: true, radiant: false }),
    body: makeItem({ tier: 'epic', baseId: 'armor', identified: true, radiant: false }),
    ring1: makeItem({ tier: 'rare', baseId: 'ring', identified: true, radiant: false }),
    hands: null,
    feet: makeItem({ tier: 'common', baseId: 'boots', identified: true, radiant: false }),
    ring2: null,
  };
  return gear[hero.id];
}

const abName = (k) => (document.documentElement.lang === 'ru' ? AB_RU[k] : k);

function portraitImg(hero, cls = '') {
  return el('img', { class: cls, src: hero.art, alt: '', style: { objectPosition: `${hero.crop.x}% ${hero.crop.y}%`, transform: `scale(${hero.crop.zoom})` } });
}

function render() {
  const hero = current();
  if (rerolls[hero.id] == null) rerolls[hero.id] = 3;
  const picker = el('div', { class: 'hero-picker' }, HEROES.map((h) => el('button', {
    class: `hero-pick${h.id === hero.id ? ' active' : ''}`,
    style: { '--ring': h.banner },
    onclick: () => { if (rolling) return; state.heroId = h.id; sfx.click(); render(); onPick(); },
  }, el('span', { class: 'token lg', style: { '--ring': h.banner } }, portraitImg(h)), el('span', { class: 'pick-name' }, h.name))));

  const abilityBoxes = ABILITIES.map((k) => el('div', { class: 'ability', 'data-ab': k },
    el('div', { class: 'ab-name' }, abName(k)),
    el('div', { class: 'ab-score' }, hero.scores[k]),
    el('div', { class: 'ab-mod' }, fmtMod(mod(hero.scores[k]))),
    el('div', { class: 'dice-row' })));

  const rollBtn = el('button', {
    class: 'btn primary',
    disabled: rolling || rerolls[hero.id] <= 0,
    onclick: () => rollScores(hero, abilityBoxes, rollBtn, left),
  }, t('rollScores'));
  const left = el('span', { class: 'muted small' }, t('rerollsLeft', { n: rerolls[hero.id] }));

  const g = gearFor(hero);
  const slot = (key, labelKey) => {
    const item = g[key];
    return el('div', { class: `slot slot-${key}${item ? '' : ' empty'}` },
      item ? tileEl(item, { onclick: () => openItemSheet(item) }) : el('span', { class: 'slot-box' }),
      el('span', { class: 'slot-label' }, t(labelKey)));
  };

  const maxHp = hero.hp;
  const hp = state.heroHp[hero.id] ?? maxHp;

  root.replaceChildren(
    picker,
    el('article', { class: 'panel char', style: { '--ring': hero.banner } },
      el('div', { class: 'char-head' },
        el('div', { class: 'portrait' }, portraitImg(hero)),
        el('div', { class: 'char-info' },
          el('h2', { class: 'char-name' }, hero.name),
          el('div', { class: 'char-line' }, `${tr(hero.race)} · ${tr(hero.cls)}`),
          el('div', { class: 'char-line muted' }, t('level', { n: hero.level })),
          el('div', { class: 'meter char-meter' },
            el('span', { class: 'meter-label' }, t('health')),
            el('span', { class: 'meter-track' }, el('span', { class: 'meter-fill hp', style: { width: `${(100 * hp) / maxHp}%` } })),
            el('span', { class: 'meter-num' }, `${hp}/${maxHp}`)))),
      el('h3', { class: 'sub' }, t('abilities')),
      el('div', { class: 'abilities' }, abilityBoxes),
      el('div', { class: 'row roll-row' }, rollBtn, left),
      el('h3', { class: 'sub' }, t('equipment')),
      el('div', { class: 'equip' },
        slot('head', 'slot_head'), slot('amulet', 'slot_amulet'),
        slot('main', 'slot_main'), slot('off', 'slot_off'),
        slot('body', 'slot_body'), slot('ring1', 'slot_ring'),
        slot('hands', 'slot_hands'), slot('feet', 'slot_feet'), slot('ring2', 'slot_ring'),
        el('div', { class: 'equip-portrait' }, portraitImg(hero)))),
  );
}

function roll4d6() {
  const dice = [randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6)];
  const low = dice.indexOf(Math.min(...dice));
  return { dice, low, total: dice.reduce((a, b) => a + b, 0) - dice[low] };
}

function rollSet() {
  // Sets totalling under MIN_TOTAL are rerolled for free, as in docs/design.md.
  for (;;) {
    const set = ABILITIES.map(() => roll4d6());
    if (set.reduce((s, r) => s + r.total, 0) >= MIN_TOTAL) return set;
  }
}

async function rollScores(hero, boxes, btn, left) {
  if (rolling) return;
  rolling = true;
  btn.disabled = true;
  rerolls[hero.id] -= 1;
  const set = rollSet();
  for (const [i, r] of set.entries()) {
    const box = boxes[i];
    const row = box.querySelector('.dice-row');
    const dice = r.dice.map(() => el('span', { class: 'd6' }, '·'));
    row.replaceChildren(...dice);
    box.classList.add('rolling');
    sfx.dice();
    await animate(420, (k) => {
      if (k < 0.95) dice.forEach((d) => { d.textContent = randInt(1, 6); });
    });
    r.dice.forEach((v, j) => { dice[j].textContent = v; if (j === r.low) dice[j].classList.add('dropped'); });
    const k = ABILITIES[i];
    hero.scores[k] = r.total;
    box.querySelector('.ab-score').textContent = r.total;
    box.querySelector('.ab-mod').textContent = fmtMod(mod(r.total));
    box.classList.remove('rolling');
    box.classList.add(r.total >= 16 ? 'great' : r.total <= 8 ? 'poor' : 'ok');
    sfx.diceLand(r.total >= 12);
    await wait(120);
  }
  left.textContent = t('rerollsLeft', { n: rerolls[hero.id] });
  rolling = false;
  btn.disabled = rerolls[hero.id] <= 0;
}
