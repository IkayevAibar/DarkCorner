import { describe, expect, it } from 'vitest';
import {
  BOSS_GATE_DAYS, DAY_MS, RELICS, bossGateAt, createRng, instantiate, lateJoinerBoost, medianLevel, monsterById, pickRelic,
  weakeningAt, weakeningDates,
} from '../src/index.js';

const start = new Date('2026-11-06T16:00:00Z');
const day = (n: number) => new Date(start.getTime() + n * DAY_MS);

describe('the Season clock', () => {
  it('opens the Boss gate on day 14', () => {
    expect(bossGateAt(start).getTime() - start.getTime()).toBe(BOSS_GATE_DAYS * DAY_MS);
  });

  it('weakens the Boss by 10% a week from day 29, down to −40%', () => {
    expect(weakeningDates(start)).toHaveLength(4);
    expect(weakeningAt(start, day(27.9))).toBe(0);
    expect(weakeningAt(start, day(28))).toBe(0.1);
    expect(weakeningAt(start, day(35))).toBe(0.2);
    expect(weakeningAt(start, day(49))).toBe(0.4);
    expect(weakeningAt(start, day(200))).toBe(0.4);
    expect(weakeningAt(null, day(200))).toBe(0);
  });

  it('makes a weakened Boss softer in health and damage', () => {
    const full = instantiate(monsterById('ancient-dragon'), 10, 'm0');
    const weak = instantiate(monsterById('ancient-dragon'), 10, 'm0', 0.4);
    expect(weak.hp).toBe(Math.round(full.hp * 0.6));
    expect(weak.damageFactor).toBeCloseTo(0.6);
    expect(full.damageFactor).toBe(1);
  });
});

describe('late joiners', () => {
  it('get +25% XP per full week late, up to +100%', () => {
    expect(lateJoinerBoost(start, day(-1))).toBe(0);
    expect(lateJoinerBoost(start, day(6))).toBe(0);
    expect(lateJoinerBoost(start, day(7))).toBe(0.25);
    expect(lateJoinerBoost(start, day(22))).toBe(0.75);
    expect(lateJoinerBoost(start, day(60))).toBe(1);
    expect(lateJoinerBoost(null, day(60))).toBe(0);
  });

  it('are measured against the median level', () => {
    expect(medianLevel([])).toBe(1);
    expect(medianLevel([3, 9, 5])).toBe(5);
    expect(medianLevel([2, 4, 6, 10])).toBe(5);
  });
});

describe('Relics', () => {
  it('only come while copies remain, and stop when all are out', () => {
    const rng = createRng('relics');
    const found: Record<string, number> = {};
    const total = RELICS.reduce((s, r) => s + (r.copies ?? 1), 0);
    for (let i = 0; i < total; i++) {
      const relic = pickRelic(rng, found)!;
      expect(relic.tier).toBe('relic');
      found[relic.id] = (found[relic.id] ?? 0) + 1;
      expect(found[relic.id]).toBeLessThanOrEqual(relic.copies ?? 1);
    }
    expect(pickRelic(rng, found)).toBeNull();
  });
});
