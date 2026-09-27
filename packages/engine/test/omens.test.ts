import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, OMEN_DEFS, OMENS, createRng, heroCombat, marketPayout, omenFor, rollUpgrade, sneakCheck, spawnEncounter, startingHealth,
  upgradeChance,
} from '../src/index.js';

describe('Omens', () => {
  it('gives every day one Omen or none, the same for everyone', () => {
    expect(omenFor('season', 20_000)).toBe(omenFor('season', 20_000));
    const days = Array.from({ length: 1200 }, (_, i) => omenFor('season', 20_000 + i));
    const plain = days.filter((d) => d === null).length / days.length;
    expect(plain).toBeGreaterThan(0.25);
    expect(plain).toBeLessThan(0.42);
    for (const id of OMENS) expect(days).toContain(id);
  });

  it('toughens monsters under a Blood moon and softens them on a Dim day', () => {
    const plain = spawnEncounter(createRng('spawn'), 5, 'fight');
    const blood = spawnEncounter(createRng('spawn'), 5, 'fight', 0, OMEN_DEFS['blood-moon']);
    const dim = spawnEncounter(createRng('spawn'), 5, 'fight', 0, OMEN_DEFS['dim-day']);
    plain.forEach((m, i) => {
      expect(blood[i]!.maxHp).toBe(Math.round(m.maxHp * 1.2));
      expect(blood[i]!.damageFactor).toBeCloseTo(m.damageFactor * 1.1);
      expect(dim[i]!.maxHp).toBe(Math.round(m.maxHp * 0.9));
    });
  });

  it('brings twice the elites in Hunting season', () => {
    const count = (omen: typeof OMEN_DEFS['hunting-season'] | null) => {
      let elites = 0;
      for (let i = 0; i < 3000; i++) elites += spawnEncounter(createRng(`hunt-${i}`), 5, 'fight', 0, omen).filter((m) => m.elite).length;
      return elites;
    };
    expect(count(OMEN_DEFS['hunting-season'])).toBeGreaterThan(count(null) * 1.7);
  });

  it('eases Sneaking in Still air, the Forge on Hot forges days, and the Market on Free market days', () => {
    const scores = { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 };
    const worn = CLASS_DEFS.rogue.starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
    const hp = startingHealth('rogue', 'human', [], 14);
    const rogue = heroCombat({ name: 'R', class: 'rogue', race: 'human', level: 3, talents: [], scores, maxHp: hp, hp, worn });
    expect(sneakCheck(rogue, 3, 1, OMEN_DEFS['still-air'].sneak).modifier).toBe(sneakCheck(rogue, 3, 1).modifier + 3);
    expect(upgradeChance(9, 10)).toBe(40);
    expect(upgradeChance(1, 10)).toBe(95);
    expect(rollUpgrade(createRng('u'), 8, false, 10).chance).toBe(40);
    expect(marketPayout(1000, OMEN_DEFS['free-market'].marketTax)).toBe(1000);
    expect(marketPayout(1000)).toBe(950);
  });
});
