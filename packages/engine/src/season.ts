import { type ChestGrade } from './economy.js';
import { UNIQUES, type UniqueDef } from './content/loot.js';
import type { Rng } from './rng.js';

// The Season's clock (docs/design.md → Seasons). All numbers are v0.

export const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** The Boss gate opens this many days after the Season starts. */
export const BOSS_GATE_DAYS = 14;
/** From day 29 the Boss weakens by 10% every week, down to −40%. */
export const WEAKEN_FROM_DAYS = 28;
export const WEAKEN_STEP = 0.1;
export const WEAKEN_MAX = 0.4;
/** The Finale: after the Champion's victory, this long until the Wipe. */
export const FINALE_MS = 72 * 60 * 60 * 1000;
/** Places on the Boss podium: the Champion, then 2nd and 3rd during the Finale. */
export const PODIUM = 3;

export const bossGateAt = (startsAt: Date): Date => new Date(startsAt.getTime() + BOSS_GATE_DAYS * DAY_MS);

/** When each weakening step lands: day 29, 36, 43 and 50. */
export function weakeningDates(startsAt: Date): Date[] {
  const steps = Math.round(WEAKEN_MAX / WEAKEN_STEP);
  return Array.from({ length: steps }, (_, i) => new Date(startsAt.getTime() + WEAKEN_FROM_DAYS * DAY_MS + i * WEEK_MS));
}

/** How much the Boss has weakened by `now`: 0, 0.1, … 0.4. */
export function weakeningAt(startsAt: Date | null, now: Date): number {
  if (!startsAt) return 0;
  const passed = weakeningDates(startsAt).filter((d) => d <= now).length;
  return Math.min(WEAKEN_MAX, Math.round(passed * WEAKEN_STEP * 10) / 10);
}

// ─── Late joiners ─────────────────────────────────────────────────────────

/** +25% XP for every full week between the Season's start and the Hero's, up to +100%. */
export const LATE_XP_PER_WEEK = 0.25;
export const LATE_XP_MAX = 1;
/** After this many days, a new Hero's Starter kit is Uncommon. */
export const UNCOMMON_KIT_AFTER_DAYS = 14;

export function lateJoinerBoost(startsAt: Date | null, joinedAt: Date): number {
  if (!startsAt || joinedAt <= startsAt) return 0;
  const weeks = Math.floor((joinedAt.getTime() - startsAt.getTime()) / WEEK_MS);
  return Math.min(LATE_XP_MAX, weeks * LATE_XP_PER_WEEK);
}

export function medianLevel(levels: readonly number[]): number {
  if (levels.length === 0) return 1;
  const sorted = [...levels].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.floor((sorted[mid - 1]! + sorted[mid]!) / 2);
}

// ─── Relics ───────────────────────────────────────────────────────────────

/** Chances of a Relic, while copies remain (docs/design.md → Special rooms and announced vaults). */
export const RELIC_CHANCE = {
  /** A Vault announced ahead of time. */
  announcedVault: 0.6,
  /** Any other Vault on Floors 7–10. */
  deepVault: 0.1,
  /** A Mini-boss on Floors 7–10. */
  deepMiniboss: 0.02,
};
export const DEEP_FLOOR = 7;

export const RELICS: UniqueDef[] = UNIQUES.filter((u) => u.tier === 'relic');

/**
 * One of the Relic designs that still has copies left, more likely the more are
 * left; null once every copy is out. `found` counts copies found per design.
 */
export function pickRelic(rng: Rng, found: Readonly<Record<string, number>>): UniqueDef | null {
  const left = RELICS.map((r) => [r, (r.copies ?? 1) - (found[r.id] ?? 0)] as const).filter(([, n]) => n > 0);
  const total = left.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;
  let r = rng.next() * total;
  return left.find(([, n]) => (r -= n) < 0)?.[0] ?? left[0]![0];
}

// ─── Vaults and the Boss ──────────────────────────────────────────────────

/** A Vault holds Items with the odds three Floors deeper, a good Chest and gold. */
export const VAULT = { items: 3, floorBonus: 3, chest: 'silver' as ChestGrade, deepChest: 'gold' as ChestGrade, gold: [100, 200] as [number, number] };

/** Beating the Boss: a pile of floor-10 Items, a Gold chest and a lot of gold. */
export const BOSS_LOOT = { items: 3, chest: 'gold' as ChestGrade, gold: [800, 1500] as [number, number] };

/** The Vault announcer: about 3 a week, opening in the evening (game time). */
export const VAULT_ANNOUNCE_CHANCE = 3 / 7;
export const VAULT_OPEN_HOUR = 21;
/** Only Floors at least this many Heroes have reached get announced Vaults. */
export const VAULT_MIN_HEROES = 2;
