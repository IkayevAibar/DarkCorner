import { type D20Roll, type Edge, rollD20 } from './dice.js';
import type { Rng } from './rng.js';

export interface CheckInput {
  /** Ability modifier plus proficiency and any bonuses. */
  modifier: number;
  /** Difficulty to meet or beat. */
  dc: number;
  edge?: Edge;
  /** Halfling Lucky. */
  rerollOnes?: boolean;
}

export interface CheckResult {
  roll: D20Roll;
  total: number;
  dc: number;
  success: boolean;
  /** Natural 20: the best outcome, whatever the total. */
  critical: boolean;
  /** Natural 1: the worst outcome, whatever the total. */
  fumble: boolean;
}

/**
 * A Check. Unlike strict SRD ability checks, a natural 20 always succeeds and a
 * natural 1 always fails (docs/design.md → Dice and fights): the dice moments
 * are the point of the game.
 */
export function check(rng: Rng, input: CheckInput): CheckResult {
  const roll = rollD20(rng, { edge: input.edge, rerollOnes: input.rerollOnes });
  const total = roll.natural + input.modifier;
  const critical = roll.natural === 20;
  const fumble = roll.natural === 1;
  const success = critical || (!fumble && total >= input.dc);
  return { roll, total, dc: input.dc, success, critical, fumble };
}
