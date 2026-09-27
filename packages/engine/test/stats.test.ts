import { describe, expect, it } from 'vitest';
import { type GearBase, armorClass, baseById, canUse } from '../src/index.js';

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
