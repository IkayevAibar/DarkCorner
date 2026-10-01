// The City's places that grow a Hero for gold (docs/design.md → The City). All numbers are v0.

/**
 * The Academy: from level `minLevel`, a Hero learns one more Talent at a time, any it
 * doesn't know, for City gold: the first costs `prices[0]`, the next `prices[1]`, and so
 * on, `prices.length` in all. Learned Talents are the Hero's like any other.
 */
export const ACADEMY = { minLevel: 12, prices: [2000, 6000, 15000] } as const;

/** What the next Talent costs a Hero that has learned `learned` at the Academy, or null once it has learned all it may. */
export const academyPrice = (learned: number): number | null => ACADEMY.prices[learned] ?? null;
