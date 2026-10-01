// The City's places that grow a Hero for gold (docs/design.md → The City). All numbers are v0.

/**
 * The Academy: from level `minLevel`, a Hero learns one more Talent at a time, any it
 * doesn't know, for City gold: the first costs `prices[0]`, the next `prices[1]`, and so
 * on, `prices.length` in all. Learned Talents are the Hero's like any other.
 */
export const ACADEMY = { minLevel: 12, prices: [2000, 6000, 15000] } as const;

/** What the next Talent costs a Hero that has learned `learned` at the Academy, or null once it has learned all it may. */
export const academyPrice = (learned: number): number | null => ACADEMY.prices[learned] ?? null;

/**
 * The Training grounds: a Hero trains one ability at a time for City gold, away for
 * `hours`; then that score rises by 1 (never above ABILITY_CAP). The first costs
 * `prices[0]`, the next `prices[1]`, and so on, `prices.length` in all. Meanwhile the
 * Hero can't go into the Labyrinth or down the Well.
 */
export const TRAINING = { hours: 8, prices: [1000, 3000, 8000] } as const;
export const TRAINING_MS = TRAINING.hours * 60 * 60 * 1000;

/** What the next training costs a Hero that has trained `trained` times, or null once it has done all it may. */
export const trainingPrice = (trained: number): number | null => TRAINING.prices[trained] ?? null;
