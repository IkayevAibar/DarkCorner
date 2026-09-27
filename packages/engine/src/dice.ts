import type { Rng } from './rng.js';

/** Advantage rolls two d20s and keeps the higher; disadvantage keeps the lower. */
export type Edge = 'normal' | 'advantage' | 'disadvantage';

export interface D20Roll {
  /** Every d20 that hit the table, in order, including a Halfling's rerolled 1s. */
  rolls: number[];
  /** The die that counts, before modifiers. 20 and 1 are the special ones. */
  natural: number;
  edge: Edge;
}

export function rollDie(rng: Rng, sides: number): number {
  return rng.int(1, sides);
}

export function rollDice(rng: Rng, count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(rng, sides));
}

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * One d20 for a Check, attack or save.
 *
 * `rerollOnes` is the Halfling's Lucky trait: any die that shows a 1 is rolled
 * again once and the new number must be used. With advantage it applies to each
 * die separately, as in the SRD.
 */
export function rollD20(rng: Rng, opts: { edge?: Edge; rerollOnes?: boolean } = {}): D20Roll {
  const edge = opts.edge ?? 'normal';
  const rolls: number[] = [];

  const one = (): number => {
    let value = rollDie(rng, 20);
    rolls.push(value);
    if (value === 1 && opts.rerollOnes) {
      value = rollDie(rng, 20);
      rolls.push(value);
    }
    return value;
  };

  if (edge === 'normal') return { rolls, natural: one(), edge };
  const a = one();
  const b = one();
  return { rolls, natural: edge === 'advantage' ? Math.max(a, b) : Math.min(a, b), edge };
}
