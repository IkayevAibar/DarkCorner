import { describe, expect, it } from 'vitest';
import { itemViewSchema, openChestResultSchema } from '@dark/shared';
import { CHESTS, REVEALS, sealed } from '../../screens/sandbox/lootFixtures';
import { makeStrip, PRIZE_AT } from './strip';

describe('Chest presentation', () => {
  it('uses schema-valid fixtures, including sealed prizes without hidden properties', () => {
    for (const result of Object.values(CHESTS)) openChestResultSchema.parse(result);
    for (const item of Object.values(REVEALS)) {
      itemViewSchema.parse(item);
      const before = sealed(item);
      itemViewSchema.parse(before);
      expect([before.quality, before.bonusStats, before.power, before.radiant, before.art, before.serial]).toEqual(Array(6).fill(null));
    }
  });

  it('never rerolls, alters or reveals the server prize', () => {
    const result = CHESTS.gold;
    const original = JSON.stringify(result);
    for (const random of [() => 0, () => .5, () => .99999]) {
      const strip = makeStrip(result, random);
      expect(strip[PRIZE_AT]).toBe(result.prize);
      expect(strip[PRIZE_AT]!.identified).toBe(false);
      expect(strip.filter(tile => tile.id === result.prize.id)).toHaveLength(1);
    }
    expect(JSON.stringify(result)).toBe(original);
  });

  it('samples the supplied weights without boosting rare Tiers or inserting near misses', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const tile = makeStrip(CHESTS.iron, () => (i + .5) / 1000)[0]!;
      counts.set(tile.tier, (counts.get(tile.tier) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ uncommon: 700, rare: 220, epic: 65, legendary: 13, mythic: 2 });
  });

  it('handles normalized, zero and missing weights while keeping the real prize', () => {
    const result = { ...CHESTS.silver, odds: [{ tier: 'rare' as const, percent: 3 }, { tier: 'relic' as const, percent: 0 }, { tier: 'epic' as const, percent: 1 }] };
    expect(makeStrip(result, () => .7)[0]!.tier).toBe('rare');
    expect(makeStrip(result, () => .8)[0]!.tier).toBe('epic');
    expect(makeStrip({ ...result, odds: [] })[PRIZE_AT]).toBe(result.prize);
  });
});
