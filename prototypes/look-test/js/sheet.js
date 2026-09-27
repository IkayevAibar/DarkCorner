// PROTOTYPE bottom sheet used for buildings and item cards.
import { $, el } from './util.js';
import { t } from './i18n.js';
import { uiIcon } from './icons.js';
import { sfx } from './audio.js';

let onCloseFn = null;

export function openSheet(title, body, { onClose } = {}) {
  const sheet = $('#sheet');
  const panel = $('.sheet-panel', sheet);
  panel.replaceChildren(
    el('div', { class: 'sheet-head' },
      el('h2', { class: 'sheet-title' }, title),
      el('button', { class: 'icon-btn', 'aria-label': t('close'), html: uiIcon('close'), onclick: closeSheet }),
    ),
    el('div', { class: 'sheet-body' }, body),
  );
  onCloseFn = onClose ?? null;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  sfx.click();
}

export function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  setTimeout(() => { sheet.hidden = true; }, 220);
  const fn = onCloseFn;
  onCloseFn = null;
  fn?.();
}

export function initSheet() {
  $('#sheet .sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}
