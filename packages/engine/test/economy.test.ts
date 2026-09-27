import { describe, expect, it } from 'vitest';
import {
  BAD_LUCK_MAX, CHEST_ODDS, MAX_UPGRADE, RECIPES, REFORGE_COST, SHOP_BASICS, STACK_BUYBACK, UPGRADE_CHANCE, UPGRADE_SAFE_UNTIL,
  baseById, chestGradeOf, createRng, luckOf, marketPayout, rollChestTier, rollDropTier, rollLootTier, rollSalvage,
  rollUpgrade, salvageRange, sellValue, shopBuyPrice, shopSellPrice, shopStock, tierRank, upgradeCost, dropOdds, canUse,
} from '../src/index.js';

const tally = <T extends string>(n: number, roll: () => T) => {
  const counts = new Map<T, number>();
  for (let i = 0; i < n; i++) {
    const v = roll();
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return (v: T) => ((counts.get(v) ?? 0) / n) * 100;
};

describe('Chests', () => {
  it('open at the printed odds', () => {
    for (const grade of ['iron', 'silver', 'gold'] as const) {
      const rng = createRng(`chest-${grade}`);
      const pct = tally(100_000, () => rollChestTier(rng, grade));
      for (const [tier, percent] of CHEST_ODDS[grade]) expect(Math.abs(pct(tier) - percent)).toBeLessThan(Math.max(0.12, percent * 0.05));
    }
  });

  it('know their grade from the base', () => {
    expect(chestGradeOf('chest-silver')).toBe('silver');
    expect(chestGradeOf('key-silver')).toBeNull();
    expect(chestGradeOf('chest-bronze')).toBeNull();
  });
});

describe('magic find and the Bad-luck meter', () => {
  it('makes Rare and better more likely, and never lowers them', () => {
    const plain = tally(100_000, (() => { const r = createRng('mf0'); return () => rollDropTier(r, 5); })());
    const lucky = tally(100_000, (() => { const r = createRng('mf1'); return () => rollDropTier(r, 5, 100); })());
    expect(lucky('rare')).toBeGreaterThan(plain('rare') * 1.3);
    expect(lucky('common')).toBeLessThan(plain('common'));
  });

  it('forces Legendary or better when full, and says to reset', () => {
    const rng = createRng('pity');
    for (let i = 0; i < 2000; i++) {
      const r = rollLootTier(rng, { odds: dropOdds(1), magicFind: 0, badLuck: BAD_LUCK_MAX });
      expect(r.forced).toBe(true);
      expect(r.reset).toBe(true);
      expect(['legendary', 'mythic']).toContain(r.tier);
    }
  });

  it('resets on any natural Legendary', () => {
    const rng = createRng('natural');
    for (let i = 0; i < 20_000; i++) {
      const r = rollLootTier(rng, { odds: dropOdds(10), magicFind: 0, badLuck: 50 });
      expect(r.reset).toBe(tierRank(r.tier) >= tierRank('legendary'));
    }
  });

  it('adds gear, Blessings and the First King’s Crown together', () => {
    const worn = [
      { bonusStats: [{ stat: 'magicFind', value: 5 }], radiant: false, uniqueId: null },
      { bonusStats: [{ stat: 'goldFind', value: 10 }, { stat: 'magicFind', value: 10 }], radiant: true, uniqueId: 'first-kings-crown' },
    ];
    expect(luckOf({ worn, blessing: 'fortune' })).toEqual({ magicFind: 5 + 11 + 25, goldFind: 11, badLuckRate: 2 });
    expect(luckOf({ worn: [], blessing: 'providence' }).badLuckRate).toBe(2);
    expect(luckOf({ worn: [], blessing: null })).toEqual({ magicFind: 0, goldFind: 0, badLuckRate: 1 });
  });
});

describe('Shops', () => {
  it('sell every basic and pay less than they charge', () => {
    for (const { base, price } of SHOP_BASICS) {
      expect(baseById(base).kind).not.toBe('gear');
      expect(STACK_BUYBACK[base]).toBeLessThan(price);
    }
  });

  it('give a Haggler 10% either way', () => {
    expect(shopBuyPrice(200, true)).toBe(180);
    expect(shopSellPrice(200, true)).toBe(220);
    expect(shopBuyPrice(200, false)).toBe(200);
  });

  it('value a stack by the piece', () => {
    expect(sellValue({ base: 'potion', tier: 'common', itemLevel: 1, radiant: false, quantity: 4 })).toBe(4 * STACK_BUYBACK.potion!);
  });

  it('stock only gear the Hero can use, identified, Common and Uncommon', () => {
    const stock = shopStock(createRng('stock'), { classId: 'wizard', itemLevel: 3 });
    expect(stock).toHaveLength(6);
    for (const roll of stock) {
      expect(['common', 'uncommon']).toContain(roll.tier);
      expect(roll.identified).toBe(true);
      expect(roll.itemLevel).toBe(3);
      expect(canUse('wizard', baseById(roll.base) as never)).toBe(true);
    }
  });
});

describe('the Forge', () => {
  it('succeeds at the design chances', () => {
    for (let to = 1; to <= MAX_UPGRADE; to++) {
      const rng = createRng(`up-${to}`);
      const n = 40_000;
      let wins = 0;
      for (let i = 0; i < n; i++) if (rollUpgrade(rng, to - 1, false).outcome === 'success') wins++;
      expect(Math.abs((wins / n) * 100 - UPGRADE_CHANCE[to]!)).toBeLessThan(1);
    }
  });

  it('only risks the Item past +5, and a Protection scroll saves it', () => {
    const rng = createRng('risk');
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const safe = rollUpgrade(rng, UPGRADE_SAFE_UNTIL - 1, false);
      expect(['success', 'failed']).toContain(safe.outcome);
      const risky = rollUpgrade(rng, 8, true);
      expect(risky.outcome).not.toBe('destroyed');
      if (risky.outcome === 'saved') expect(risky).toMatchObject({ level: 7, protectionUsed: true });
      seen.add(rollUpgrade(rng, 8, false).outcome);
    }
    expect([...seen].sort()).toEqual(['destroyed', 'dropped', 'success']);
  });

  it('costs more gold at every step and more for higher Tiers', () => {
    for (let to = 2; to <= MAX_UPGRADE; to++) expect(upgradeCost('rare', to).gold).toBeGreaterThan(upgradeCost('rare', to - 1).gold);
    expect(upgradeCost('mythic', 5).gold).toBeGreaterThan(upgradeCost('common', 5).gold);
    expect(upgradeCost('common', 9).materials[0]!.base).toBe('soulstone');
  });

  it('salvages by Tier, never Relics, with more for Upgrades', () => {
    expect(salvageRange('relic', 0)).toBeNull();
    expect(salvageRange('epic', 7)).toEqual({ base: 'essence', min: 4, max: 6 });
    const rng = createRng('salvage');
    for (let i = 0; i < 500; i++) {
      const got = rollSalvage(rng, 'uncommon', 0)!;
      expect(got.base).toBe('scrap');
      expect(got.quantity).toBeGreaterThanOrEqual(2);
      expect(got.quantity).toBeLessThanOrEqual(4);
    }
  });

  it('can’t reforge Commons, and crafts only from Materials', () => {
    expect(REFORGE_COST.common).toBeNull();
    for (const r of RECIPES) for (const m of r.materials) expect(baseById(m.base).kind).toBe('material');
  });
});

describe('the Market', () => {
  it('keeps a 5% tax, rounded up', () => {
    expect(marketPayout(100)).toBe(95);
    expect(marketPayout(10)).toBe(9);
    expect(marketPayout(1)).toBe(0);
  });
});
