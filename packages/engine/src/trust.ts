import { type Tier, tierRank } from './content/loot.js';
import { dropOdds } from './items.js';

// Trust and greed (docs/design.md → Duos → Trust and greed): an Oathstone's secret
// choice for two, and a Duo Chest split by picking in turns.

export const OATHS = ['share', 'take'] as const;
export type Oath = (typeof OATHS)[number];

/** A Hero swears at a given Oathstone once a week (v0). */
export const OATH_MS = 7 * 24 * 60 * 60 * 1000;
/** The Oathstone's gifts have the odds of this many Floors deeper, Rare at least (v0). */
export const OATH_DEPTH = 3;

/**
 * What two oaths bring, a game of chicken: both share, a gift each; one takes, it takes
 * both gifts and the other gets nothing; both take, the stone cracks and curses them both.
 */
export function oathOutcome(a: Oath, b: Oath): { gifts: [number, number]; cursed: boolean } {
  if (a === 'share' && b === 'share') return { gifts: [1, 1], cursed: false };
  if (a === 'take' && b === 'take') return { gifts: [0, 0], cursed: true };
  return { gifts: a === 'take' ? [2, 0] : [0, 2], cursed: false };
}

/** The odds an Oathstone's gift is rolled with: three Floors deeper, Rare and better only. */
export const oathOdds = (floor: number): [Tier, number][] =>
  dropOdds(Math.min(10, floor + OATH_DEPTH)).filter(([tier]) => tierRank(tier) >= tierRank('rare'));

/** Duo Chest (v0): a pick waits this long for its Player, then the best Item left is taken for it. */
export const PICK_MS = 30_000;

/**
 * Who picks next from a Duo Chest: the one who didn't pick last (the first picker to begin
 * with), unless it can't carry more, then the other. Null when neither can.
 */
export function nextPicker(order: readonly [string, string], last: string | null, canCarry: (heroId: string) => boolean): string | null {
  const due = last === null || last === order[1] ? order[0] : order[1];
  const other = due === order[0] ? order[1] : order[0];
  if (canCarry(due)) return due;
  return canCarry(other) ? other : null;
}

/** The Item taken for a Player whose pick ran out: the best Tier left, then the highest item level, then the first. */
export function bestLeft(items: readonly { tier: Tier; itemLevel: number }[], taken: ReadonlySet<number>): number | null {
  let best: number | null = null;
  items.forEach((item, i) => {
    if (taken.has(i)) return;
    const b = best === null ? null : items[best]!;
    if (!b || tierRank(item.tier) > tierRank(b.tier) || (item.tier === b.tier && item.itemLevel > b.itemLevel)) best = i;
  });
  return best;
}
