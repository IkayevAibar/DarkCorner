import { describe, expect, it } from 'vitest';
import {
  type GearBase, armorClass, baseById, canUse, critFromOf, effectiveStats, escapeSteps, gearFacts, gearScores, upgradeSteps,
} from '../src/index.js';

const gear = (base: string, extra: Partial<Parameters<typeof armorClass>[1][number]> = {}) => ({
  base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], ...extra,
});

describe('canUse', () => {
  it('follows the Proficiency table', () => {
    const b = (id: string) => baseById(id) as GearBase;
    expect(canUse('fighter', b('greatsword'))).toBe(true);
    expect(canUse('rogue', b('greatsword'))).toBe(false);
    expect(canUse('wizard', b('orb'))).toBe(true);
    expect(canUse('cleric', b('orb'))).toBe(false);
    expect(canUse('cleric', b('plate'))).toBe(false);
    expect(canUse('rogue', b('ring'))).toBe(true);
  });
});

describe('armorClass', () => {
  it('is 10 + DEX with no armor', () => {
    expect(armorClass(14, [])).toBe(12);
  });

  it('ignores DEX in heavy armor and caps it in medium', () => {
    expect(armorClass(18, [gear('chainmail')])).toBe(16);
    expect(armorClass(18, [gear('breastplate')])).toBe(14 + 2);
  });

  it('adds shield, helm and armor Bonus stats', () => {
    expect(armorClass(10, [gear('chainmail'), gear('shield'), gear('helm', { bonusStats: [{ stat: 'armor', value: 2 }] })])).toBe(16 + 2 + 1 + 2);
  });

  it('rewards Quality on the armor above 10', () => {
    expect(armorClass(10, [gear('plate', { quality: 100 })])).toBeGreaterThan(armorClass(10, [gear('plate', { quality: 1 })]));
  });
});

describe('Upgrades and Bonus stats', () => {
  const bonusStats = [{ stat: 'wis', value: 3 }, { stat: 'goldFind', value: 20 }, { stat: 'crit', value: 2 }];

  it('grow percentage stats 5% a level, and the d20 ones by +1 at +5 and +10', () => {
    const at = (upgrade: number, radiant = false) => effectiveStats({ bonusStats, radiant, upgrade }).map((b) => b.value);
    expect(at(0)).toEqual([3, 20, 2]);
    expect(at(4)).toEqual([3, 24, 2]);
    expect(at(5)).toEqual([4, 25, 3]);
    expect(at(10)).toEqual([5, 30, 3]);
    // Radiant first (+10%), then the Upgrades.
    expect(at(10, true)).toEqual([5, 33, 3]);
    expect(upgradeSteps(4)).toBe(0);
    expect(upgradeSteps(9)).toBe(1);
  });

  it('give a helm or shield +1 armor at +5 and +10, and count armor Bonus stats', () => {
    const helm = (upgrade: number) => armorClass(10, [gear('helm', { quality: 70, upgrade })]);
    expect([helm(0), helm(4), helm(5), helm(9), helm(10)]).toEqual([11, 11, 12, 12, 13]);
    expect(gearFacts(baseById('helm') as GearBase, { quality: 70, upgrade: 10, radiant: false }).armor?.ac).toBe(3);
    expect(armorClass(10, [gear('ring', { bonusStats: [{ stat: 'armor', value: 1 }], upgrade: 5 })])).toBe(12);
  });

  it('put gear abilities into the scores Checks and fights use, with the Phylactery', () => {
    const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 10 };
    const worn = [{ bonusStats, radiant: false, upgrade: 5, uniqueId: null }, { bonusStats: [], radiant: false, uniqueId: 'phylactery' }];
    expect(gearScores(scores, worn)).toEqual({ str: 12, dex: 12, con: 12, int: 12, wis: 18, cha: 12 });
  });

  it('count critical chance and escape chance in 5% steps', () => {
    expect([critFromOf(0, false), critFromOf(4, false), critFromOf(6, false), critFromOf(10, false), critFromOf(40, false)]).toEqual([20, 20, 19, 18, 18]);
    expect(critFromOf(10, true)).toBe(17);
    expect([escapeSteps(4), escapeSteps(12)]).toEqual([0, 2]);
  });
});
