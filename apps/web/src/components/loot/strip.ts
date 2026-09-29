import type { ItemView, OpenChestResult } from '@dark/shared';

export const TILE = 76;
export const STRIDE = 88;
export const PRIZE_AT = 40;
export const SPIN_MS = 4400;
const ICONS = ['sword', 'axe', 'dagger', 'bow', 'staff', 'mace', 'shield', 'orb', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];

/** Cosmetic tiles only. No boosted odds or fabricated near-misses; the server's prize is inserted verbatim. */
export function makeStrip(result: OpenChestResult, random = Math.random): ItemView[] {
  const odds = result.odds.filter(o => Number.isFinite(o.percent) && o.percent > 0);
  const total = odds.reduce((sum, o) => sum + o.percent, 0);
  return Array.from({ length: PRIZE_AT + 5 }, (_, i) => {
    if (i === PRIZE_AT) return result.prize;
    let value = random() * total;
    const tier = odds.find(o => (value -= o.percent) < 0)?.tier ?? odds.at(-1)?.tier ?? result.prize.tier;
    return {
      ...result.prize, id: `decoy-${i}`, tier, icon: ICONS[Math.floor(random() * ICONS.length)] ?? 'sword',
      name: { en: '', ru: '' }, art: null, identified: true, quantity: 1, quality: null, bonusStats: null,
      power: null, radiant: null, serial: null, owners: null, upgrade: 0, gear: null, about: null, worth: 0,
    };
  });
}

export const stripOffset = (progress: number) => TILE / 2 + PRIZE_AT * STRIDE * (1 - (1 - progress) ** 4);
