import { describe, expect, it } from 'vitest';
import {
  BOND_FACTOR, BOND_STATS, BONUS_COUNT, BONUS_STATS, DROP_ODDS, GEAR_BASES, TIERS, UNIQUES, baseById, bonusLines, bonusPoolOf, bondedStats, buybackPrice,
  createRng, itemName, qualityFactor, rollBondRings, rollBonusStats, rollDropTier, rollGear,
} from '../src/index.js';

describe('rollDropTier', () => {
  it('matches the design odds on every Floor band', () => {
    for (const band of DROP_ODDS) {
      const rng = createRng(`drops-${band.floors[0]}`);
      const n = 200_000;
      const counts = new Map<string, number>();
      for (let i = 0; i < n; i++) {
        const tier = rollDropTier(rng, band.floors[0]);
        counts.set(tier, (counts.get(tier) ?? 0) + 1);
      }
      for (const [tier, percent] of band.odds) {
        const observed = ((counts.get(tier) ?? 0) / n) * 100;
        // Loose enough for rare Tiers at this sample size, tight enough to catch a wrong table.
        expect(Math.abs(observed - percent)).toBeLessThan(Math.max(0.1, percent * 0.05));
      }
    }
  });

  it('never drops a Relic', () => {
    const rng = createRng('no-relics');
    for (let i = 0; i < 50_000; i++) expect(rollDropTier(rng, 10)).not.toBe('relic');
  });
});

describe('rollGear', () => {
  it('replays exactly from the same seed', () => {
    expect(rollGear(createRng('same'), { tier: 'epic', itemLevel: 5 })).toEqual(rollGear(createRng('same'), { tier: 'epic', itemLevel: 5 }));
  });

  it('gives each Tier its number of distinct Bonus stats', () => {
    const rng = createRng('bonus');
    for (const tier of TIERS) {
      for (let i = 0; i < 200; i++) {
        const roll = rollGear(rng, { tier, itemLevel: rng.int(1, 10) });
        expect(roll.bonusStats).toHaveLength(BONUS_COUNT[tier]);
        expect(new Set(roll.bonusStats.map((b) => b.stat)).size).toBe(BONUS_COUNT[tier]);
        for (const b of roll.bonusStats) expect(b.value).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('hides Rare and better until identified', () => {
    const rng = createRng('identified');
    expect(rollGear(rng, { tier: 'uncommon', itemLevel: 1 }).identified).toBe(true);
    expect(rollGear(rng, { tier: 'rare', itemLevel: 1 }).identified).toBe(false);
    expect(rollGear(rng, { tier: 'mythic', itemLevel: 1 }).identified).toBe(false);
  });

  it('makes Legendary and above named uniques of the right Tier', () => {
    const rng = createRng('uniques');
    for (const tier of ['legendary', 'mythic', 'relic'] as const) {
      for (let i = 0; i < 50; i++) {
        const roll = rollGear(rng, { tier, itemLevel: 8 });
        const unique = UNIQUES.find((u) => u.id === roll.uniqueId);
        expect(unique?.tier).toBe(tier);
        expect(roll.base).toBe(unique?.base);
        expect(roll.suffix).toBeNull();
      }
    }
  });

  it('turns about 1 in 200 Items Radiant', () => {
    const rng = createRng('radiant');
    const n = 100_000;
    let radiant = 0;
    for (let i = 0; i < n; i++) if (rollGear(rng, { tier: 'common', itemLevel: 1 }).radiant) radiant++;
    expect(radiant / n).toBeGreaterThan(0.004);
    expect(radiant / n).toBeLessThan(0.006);
  });

  it('keeps Quality in 1–100', () => {
    const rng = createRng('quality');
    for (let i = 0; i < 5_000; i++) {
      const q = rollGear(rng, { tier: 'rare', itemLevel: 3 }).quality;
      expect(q).toBeGreaterThanOrEqual(1);
      expect(q).toBeLessThanOrEqual(100);
    }
    expect(qualityFactor(1)).toBeCloseTo(0.85);
    expect(qualityFactor(100)).toBeCloseTo(1.15);
  });

  it('refuses a base that is not gear', () => {
    expect(() => rollGear(createRng('x'), { tier: 'rare', itemLevel: 1, baseId: 'potion' })).toThrow();
  });
});

describe('item text', () => {
  it('names every roll in both languages', () => {
    const rng = createRng('names');
    for (const tier of TIERS) {
      const name = itemName(rollGear(rng, { tier, itemLevel: 4 }));
      expect(name.en.length).toBeGreaterThan(2);
      expect(name.ru.length).toBeGreaterThan(2);
    }
    expect(itemName({ base: 'longsword', suffix: null, uniqueId: null })).toEqual(baseById('longsword').name);
  });

  it('shows Radiant Bonus stats boosted by 10%', () => {
    const plain = bonusLines({ bonusStats: [{ stat: 'maxHp', value: 20 }], radiant: false });
    const radiant = bonusLines({ bonusStats: [{ stat: 'maxHp', value: 20 }], radiant: true });
    expect(plain[0]?.en).toBe('+20 max health');
    expect(radiant[0]?.en).toBe('+22 max health');
  });

  it('prices higher Tiers and item levels higher', () => {
    expect(buybackPrice({ tier: 'rare', itemLevel: 5, radiant: false })).toBeGreaterThan(buybackPrice({ tier: 'rare', itemLevel: 1, radiant: false }));
    expect(buybackPrice({ tier: 'epic', itemLevel: 1, radiant: false })).toBeGreaterThan(buybackPrice({ tier: 'rare', itemLevel: 1, radiant: false }));
  });
});

describe('content', () => {
  it('has a label and a sane range for every Bonus stat', () => {
    for (const def of BONUS_STATS) {
      expect(def.label.en).toContain('{n}');
      expect(def.label.ru).toContain('{n}');
      expect(def.range[0]).toBeLessThanOrEqual(def.range[1]);
    }
  });

  it('points every unique at real gear', () => {
    for (const unique of UNIQUES) expect(GEAR_BASES.some((b) => b.id === unique.base)).toBe(true);
  });
});

describe('Bond rings', () => {
  it('come in pairs of one Tier, Rare or Epic, identified, each half with its own fighting Bonus stats', () => {
    const tiers = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const [a, b] = rollBondRings(createRng(`bond-${i}`), 1 + (i % 9));
      expect(a.base).toBe('bond-ring');
      expect(b.base).toBe('bond-ring');
      expect(a.tier).toBe(b.tier);
      expect(['rare', 'epic']).toContain(a.tier);
      tiers.add(a.tier);
      for (const half of [a, b]) {
        expect(half.identified).toBe(true);
        expect(half.suffix).toBeNull();
        expect(half.bonusStats).toHaveLength(BONUS_COUNT[half.tier]);
        for (const { stat } of half.bonusStats) expect(BOND_STATS).toContain(stat);
      }
    }
    expect(tiers).toEqual(new Set(['rare', 'epic']));
    expect(itemName({ base: 'bond-ring', suffix: null, uniqueId: null })).toEqual({ en: 'Bond ring', ru: 'Кольцо уз' });
  });

  it('never drop, sell or turn up at random', () => {
    expect(GEAR_BASES.map((b) => b.id)).not.toContain('bond-ring');
    for (let i = 0; i < 300; i++) expect(rollGear(createRng(`any-${i}`), { tier: 'rare', itemLevel: 3 }).base).not.toBe('bond-ring');
    expect(bonusPoolOf('bond-ring')).toBe(BOND_STATS);
    expect(bonusPoolOf('ring')).toBeNull();
    for (let i = 0; i < 50; i++) {
      for (const { stat } of rollBonusStats(createRng(`reforge-${i}`), 'epic', 5, bonusPoolOf('bond-ring'))) expect(BOND_STATS).toContain(stat);
    }
  });

  it('count their Bonus stats twice while joined', () => {
    const stats = [{ stat: 'str' as const, value: 2 }, { stat: 'damage' as const, value: 6 }];
    expect(bondedStats(stats, false)).toEqual(stats);
    expect(bondedStats(stats, true)).toEqual([{ stat: 'str', value: 2 * BOND_FACTOR }, { stat: 'damage', value: 6 * BOND_FACTOR }]);
  });
});
