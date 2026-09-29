import { describe, expect, it } from 'vitest';
import { MONSTERS, STRIKES, baseById, isGear, monsterById, monsterStrike, weaponStrike } from '../src/index.js';

describe('strikes', () => {
  it('gives every monster a way to strike, by its nature or its kin', () => {
    for (const def of MONSTERS) expect(STRIKES).toContain(monsterStrike(def));
    expect(monsterStrike(monsterById('goblin-archer'))).toBe('shoot');
    expect(monsterStrike(monsterById('wraith'))).toBe('touch');
    expect(monsterStrike(monsterById('wolf'))).toBe('bite');
    expect(monsterStrike(monsterById('ghoul'))).toBe('claw');
  });

  it('lets a Hero strike as its main weapon does', () => {
    const strike = (id: string) => {
      const base = baseById(id);
      if (!isGear(base)) throw new Error(id);
      return weaponStrike(base);
    };
    expect(strike('longbow')).toBe('shoot');
    expect(strike('rapier')).toBe('pierce');
    expect(strike('greataxe')).toBe('slash');
    expect(strike('warhammer')).toBe('blunt');
    expect(weaponStrike(null)).toBe('blunt');
  });
});
