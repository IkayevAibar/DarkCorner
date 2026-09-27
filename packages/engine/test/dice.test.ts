import { describe, expect, it } from 'vitest';
import {
  ABILITIES, ABILITY_SET_MIN_TOTAL, abilityModifier, check, createRng, rollAbility, rollAbilitySet, rollD20,
  type Rng,
} from '../src/index.js';

/** An Rng that plays back fixed d20 faces, for testing rules rather than luck. */
function scripted(faces: number[]): Rng {
  let i = 0;
  const next = () => {
    const face = faces[i++];
    if (face === undefined) throw new Error('script ran out of rolls');
    return (face - 1) / 20 + 0.001;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}

describe('rollD20', () => {
  it('keeps the higher die with advantage and the lower with disadvantage', () => {
    expect(rollD20(scripted([4, 17]), { edge: 'advantage' }).natural).toBe(17);
    expect(rollD20(scripted([4, 17]), { edge: 'disadvantage' }).natural).toBe(4);
  });

  it('rerolls a natural 1 once for a Halfling and keeps the new die', () => {
    const roll = rollD20(scripted([1, 1]), { rerollOnes: true });
    expect(roll.rolls).toEqual([1, 1]);
    expect(roll.natural).toBe(1);
    expect(rollD20(scripted([1, 12]), { rerollOnes: true }).natural).toBe(12);
  });

  it('does not reroll ones for anyone else', () => {
    expect(rollD20(scripted([1])).natural).toBe(1);
  });
});

describe('check', () => {
  it('succeeds when the total meets the difficulty', () => {
    expect(check(scripted([10]), { modifier: 3, dc: 13 }).success).toBe(true);
    expect(check(scripted([9]), { modifier: 3, dc: 13 }).success).toBe(false);
  });

  it('always succeeds on a natural 20 and always fails on a natural 1', () => {
    const crit = check(scripted([20]), { modifier: -5, dc: 30 });
    expect(crit).toMatchObject({ success: true, critical: true, fumble: false });
    const fumble = check(scripted([1]), { modifier: 20, dc: 2 });
    expect(fumble).toMatchObject({ success: false, critical: false, fumble: true });
  });
});

describe('ability scores', () => {
  it('maps scores to D&D modifiers', () => {
    expect([1, 8, 9, 10, 11, 12, 18, 20].map(abilityModifier)).toEqual([-5, -1, -1, 0, 0, 1, 4, 5]);
  });

  it('drops the lowest of 4d6', () => {
    const rng = createRng('abilities');
    for (let i = 0; i < 1_000; i++) {
      const roll = rollAbility(rng);
      expect(roll.dice).toHaveLength(4);
      expect(roll.dice[roll.dropped]).toBe(Math.min(...roll.dice));
      expect(roll.total).toBeGreaterThanOrEqual(3);
      expect(roll.total).toBeLessThanOrEqual(18);
    }
  });

  it('never hands out a set below the minimum total', () => {
    const rng = createRng('sets');
    let discarded = 0;
    for (let i = 0; i < 2_000; i++) {
      const set = rollAbilitySet(rng);
      expect(set.total).toBeGreaterThanOrEqual(ABILITY_SET_MIN_TOTAL);
      expect(Object.keys(set.scores).sort()).toEqual([...ABILITIES].sort());
      discarded += set.discarded;
    }
    // Roughly one set in nine falls under 65, so some must have been thrown away.
    expect(discarded).toBeGreaterThan(0);
  });
});
