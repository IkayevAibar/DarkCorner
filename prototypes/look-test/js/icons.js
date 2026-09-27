// PROTOTYPE icons. Hand-drawn stand-ins for game-icons.net silhouettes (production uses those).

const ITEM = {
  sword: '<g transform="rotate(45 32 32)"><path d="M32 3 36.5 12v28h-9V12z"/><rect x="19" y="40" width="26" height="5" rx="2"/><rect x="29.5" y="45" width="5" height="11" rx="1.5"/><circle cx="32" cy="59.5" r="3.8"/></g>',
  axe: '<g transform="rotate(35 32 32)"><rect x="30" y="8" width="4.5" height="53" rx="2"/><path d="M34 9c14-2 23 7 23 17s-6 15-13 15c2-6 0-14-10-16z"/><path d="M30 13c-8 0-12 4-12 9s3 8 7 8c-1-4 0-8 5-9z"/></g>',
  dagger: '<g transform="rotate(45 32 32)"><path d="M32 9 35.5 16v22h-7V16z"/><rect x="22" y="38" width="20" height="4.5" rx="2"/><rect x="29.8" y="42.5" width="4.4" height="10" rx="1.5"/><circle cx="32" cy="55.5" r="3.2"/></g>',
  bow: '<path d="M20 4c26 9 26 47 0 56" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M20 4v56" stroke="currentColor" stroke-width="1.6"/><path d="M10 32h38" stroke="currentColor" stroke-width="2.6"/><path d="M55 32l-8-4.5v9z"/><path d="M10 32l-4-4M10 32l-4 4" stroke="currentColor" stroke-width="2"/>',
  staff: '<g transform="rotate(18 32 32)"><rect x="30" y="20" width="4.5" height="41" rx="2"/><path d="M32.2 2 39 12.5 32.2 22 25.5 12.5z"/><path d="M24 15c-2 7 3 9 8.2 7.5C37.5 24 42.5 22 40.5 15" fill="none" stroke="currentColor" stroke-width="3"/></g>',
  mace: '<g transform="rotate(35 32 32)"><rect x="30" y="25" width="4.5" height="36" rx="2"/><circle cx="32.25" cy="17" r="10"/><path d="M32.25 2 35.5 8.5h-6.5zM46.5 17 40 20.3v-6.6zM18 17l6.5-3.3v6.6z"/></g>',
  shield: '<path fill-rule="evenodd" d="M32 4 54 11c0 23-8 39-22 49C18 50 10 34 10 11zm0 7-16 5c0 17 6 29 16 37 10-8 16-20 16-37z"/><circle cx="32" cy="28" r="6.5"/>',
  helm: '<path fill-rule="evenodd" d="M12 31C12 15 21 6 32 6s20 9 20 25v21c0 4-2 6-6 6H18c-4 0-6-2-6-6zm7-1h26v5.5H19zm10.5 5.5h5V50h-5z"/>',
  armor: '<path d="M20 7h6c1 5 3 7.5 6 7.5S37 12 38 7h6l12 8-6 12.5-4-2V56H18V25.5l-4 2L8 15z"/>',
  gloves: '<path d="M20 58V35l-4.5-10c-1.2-3 2.8-5 4.6-2.2L24 29V11c0-3.2 4.4-3.2 4.4 0v15h1.6V7c0-3.2 4.4-3.2 4.4 0v19H36V9c0-3.2 4.4-3.2 4.4 0v18H42V14c0-3.2 4.4-3.2 4.4 0v26c0 6-2 10-4.4 12v6z"/>',
  boots: '<path d="M18 5h14v33c6 2 14 4 20 8 4 2 4 10 0 10H16c-2 0-3-2-3-4l3-14z"/>',
  ring: '<path fill-rule="evenodd" d="M32 22c11 0 18 8 18 18s-8 18-18 18-18-8-18-18 7-18 18-18zm0 6c-7.5 0-12 5.5-12 12s5 12 12 12 12-5.5 12-12-4.5-12-12-12z"/><path d="M32 3l8.5 8.5L32 20l-8.5-8.5z"/>',
  amulet: '<path d="M16 5c2 17 8 25 14 29M48 5c-2 17-8 25-14 29" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 29l11 13-11 17-11-17z"/><circle cx="32" cy="42" r="3.2" fill="#000" opacity=".35"/>',
  potion: '<path d="M26 4h12v4h-2v12c10 4 16 12 16 22 0 11-9 18-20 18s-20-7-20-18c0-10 6-18 16-22V8h-2z"/>',
  chest: '<path fill-rule="evenodd" d="M8 27C8 15 18 8 32 8s24 7 24 19zm0 3h48v26H8zm20 0v11h8V30z"/>',
  key: '<path fill-rule="evenodd" d="M20 8c8 0 14 6 14 14 0 4-1.5 7-4 9.5L52 53l-5 5-3-3-4 4-4-4 4-4-15-15c-1.5.6-3.2 1-5 1-8 0-14-6.5-14-14.5S12 8 20 8zm0 7c-4 0-7 3-7 7.5s3 7.5 7 7.5 7-3 7-7.5-3-7.5-7-7.5z"/>',
};

export function itemIcon(id, cls = 'item-icon') {
  return `<svg class="${cls}" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${ITEM[id] ?? ITEM.chest}</svg>`;
}

const UI = {
  city: '<path d="M3 21h18M5 21V10l3-2.5 3 2.5v11M13 21V6.5l3-3 3 3V21M8 13v.01M16 10v.01M16 14v.01"/>',
  fight: '<path d="M4 3.5 15 14.5M20 3.5 9 14.5M13 17l4 4 2-2-4-4M11 17l-4 4-2-2 4-4"/>',
  loot: '<path d="M3 11c0-4 4-6.5 9-6.5s9 2.5 9 6.5v9H3zM3 11h18M10.5 11v3.5h3V11"/>',
  heroes: '<path d="M5 20.5c0-4 3.1-7 7-7s7 3 7 7M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"/>',
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9zM17 9.5l5 5M22 9.5l-5 5"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
};

export function uiIcon(id, cls = 'ui-icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[id]}</svg>`;
}
