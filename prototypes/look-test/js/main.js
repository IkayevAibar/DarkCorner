// PROTOTYPE look test for Dark Corner. Throwaway: answers "does this art and UI look right?"
// One page (City, Labyrinth, Loot, Heroes) in three UI looks, switchable with ?variant=A|B|C.
import { $, $$ } from './util.js';
import { t, setLang, getLang, applyStatic, onLang } from './i18n.js';
import { uiIcon } from './icons.js';
import { setSound, soundOn, sfx } from './audio.js';
import { initFx } from './fx.js';
import { initSheet } from './sheet.js';
import { initCity } from './city.js';
import { initFight, showFight, faceDragon, heroChanged } from './fight.js';
import { initLoot } from './loot.js';
import { initHeroes } from './heroes.js';
import { state } from './state.js';

const VARIANTS = ['A', 'B', 'C'];
const TABS = ['city', 'fight', 'loot', 'heroes'];
const params = new URLSearchParams(location.search);

function setParam(key, value) {
  params.set(key, value);
  history.replaceState(null, '', `?${params}`);
}

function setVariant(v) {
  state.variant = v;
  document.documentElement.dataset.variant = v;
  setParam('variant', v);
  $('#proto-switcher .label').textContent = t('variantLabel', { k: v, name: t(`variant${v}`) });
}

function cycleVariant(step) {
  const i = VARIANTS.indexOf(state.variant);
  setVariant(VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]);
}

async function showTab(tab) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${tab}`));
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  setParam('tab', tab);
  window.scrollTo({ top: 0 });
  if (tab === 'fight') await showFight();
}

function renderChrome() {
  $('#btn-lang').textContent = getLang() === 'en' ? 'RU' : 'EN';
  $('#btn-sound').innerHTML = uiIcon(soundOn() ? 'soundOn' : 'soundOff');
  $$('.tabbar button').forEach((b) => {
    b.innerHTML = `${uiIcon(b.dataset.tab)}<span>${t(`tab${b.dataset.tab[0].toUpperCase()}${b.dataset.tab.slice(1)}`)}</span>`;
  });
  $('#proto-switcher .label').textContent = t('variantLabel', { k: state.variant, name: t(`variant${state.variant}`) });
}

async function boot() {
  const v = params.get('variant');
  setVariant(VARIANTS.includes(v) ? v : 'B');
  if (params.get('lang') === 'ru') setLang('ru');
  applyStatic();
  renderChrome();
  onLang(renderChrome);

  $('#btn-lang').addEventListener('click', () => setLang(getLang() === 'en' ? 'ru' : 'en'));
  $('#btn-sound').addEventListener('click', () => { setSound(!soundOn()); renderChrome(); sfx.click(); });
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => { sfx.click(); showTab(b.dataset.tab); }));
  $('#proto-prev').addEventListener('click', () => cycleVariant(-1));
  $('#proto-next').addEventListener('click', () => cycleVariant(1));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') cycleVariant(-1);
    if (e.key === 'ArrowRight') cycleVariant(1);
  });

  initSheet();
  await initFx();
  initCity($('#screen-city'), {
    goFight: () => showTab('fight'),
    goLoot: () => showTab('loot'),
    faceDragon: async () => { await showTab('fight'); await faceDragon(); },
  });
  initFight($('#screen-fight'));
  initLoot($('#screen-loot'));
  initHeroes($('#screen-heroes'), { heroChanged });

  const tab = params.get('tab');
  await showTab(TABS.includes(tab) ? tab : 'city');
}

boot();
