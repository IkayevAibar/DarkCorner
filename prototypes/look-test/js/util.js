// PROTOTYPE helpers. Throwaway code: no tests, no error handling beyond what runs.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const roll = (n, sides) => Array.from({ length: n }, () => randInt(1, sides));
export const mod = (score) => Math.floor((score - 10) / 2);
export const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

export function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inCubic: (t) => t ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

export function animate(duration, onUpdate, easing = ease.outCubic) {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      onUpdate(easing(t), t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function shake(node, strength = 10, duration = 450) {
  return animate(duration, (t) => {
    const s = strength * (1 - t);
    node.style.transform = t < 1 ? `translate(${rand(-s, s)}px, ${rand(-s, s)}px)` : '';
  }, ease.linear);
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* iPhones: no vibration for websites */ }
}
