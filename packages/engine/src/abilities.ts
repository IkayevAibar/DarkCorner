import { rollDice, sum } from './dice.js';
import type { Rng } from './rng.js';

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export type AbilityScores = Record<Ability, number>;

/** A rolled set below this total is rerolled for free (docs/design.md, v0). */
export const ABILITY_SET_MIN_TOTAL = 65;

/** How many times a Player may reroll the whole set when creating a Hero. */
export const ABILITY_REROLLS = 3;

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);

export interface AbilityRoll {
  dice: number[];
  /** Index into `dice` of the lowest die, which does not count. */
  dropped: number;
  total: number;
}

/** 4d6, drop the lowest. */
export function rollAbility(rng: Rng): AbilityRoll {
  const dice = rollDice(rng, 4, 6);
  const dropped = dice.indexOf(Math.min(...dice));
  return { dice, dropped, total: sum(dice) - dice[dropped]! };
}

export interface AbilitySet {
  rolls: Record<Ability, AbilityRoll>;
  scores: AbilityScores;
  total: number;
  /** Sets thrown away for totalling under the minimum before this one. */
  discarded: number;
}

export function rollAbilitySet(rng: Rng, minTotal = ABILITY_SET_MIN_TOTAL): AbilitySet {
  for (let discarded = 0; ; discarded++) {
    const rolls = Object.fromEntries(ABILITIES.map((a) => [a, rollAbility(rng)])) as Record<Ability, AbilityRoll>;
    const scores = Object.fromEntries(ABILITIES.map((a) => [a, rolls[a].total])) as AbilityScores;
    const total = sum(Object.values(scores));
    if (total >= minTotal) return { rolls, scores, total, discarded };
  }
}
