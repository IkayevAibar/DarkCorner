import { describe, expect, it } from 'vitest';
import {
  BOON_IDS, DELVE_ROOMS, delveEncounter, delveFloor, delveGold, delveMap, delveOffer, delveRoomFloor, delveScore, delveSeed, monsterById,
  takeBoon, withBoons,
} from '../src/index.js';
import type { HeroCombat } from '../src/index.js';

const seed = delveSeed('season-seed', 20_000);

describe('the Daily Delve', () => {
  it('starts at the Hero’s deepest Floor, or half its level, and goes deeper Room by Room', () => {
    expect(delveFloor(0, 1)).toBe(1);
    expect(delveFloor(3, 10)).toBe(5);
    expect(delveFloor(7, 10)).toBe(7);
    expect(delveFloor(10, 20)).toBe(10);
    expect(Array.from({ length: DELVE_ROOMS }, (_, r) => delveRoomFloor(4, r))).toEqual([4, 4, 5, 5, 6, 6]);
    expect(delveRoomFloor(9, 5)).toBe(10);
  });

  it('meets the same monsters, maps and Boons for the same day, and a guardian in the last Room', () => {
    expect(delveEncounter(seed, 3, 2, null)).toEqual(delveEncounter(seed, 3, 2, null));
    expect(delveMap(seed, 3, 2)).toBe(delveMap(seed, 3, 2));
    expect(delveMap(seed, 1, 0)).toMatch(/^goblins-/);
    const guardian = delveEncounter(seed, 2, DELVE_ROOMS - 1, null);
    expect(monsterById(guardian[0]!.id).role).toBe('miniboss');
    // The Dragon's lair has no Mini-boss: two Drakes, one an elite.
    const lair = delveEncounter(seed, 10, DELVE_ROOMS - 1, null);
    expect(lair.map((m) => m.id)).toEqual(['drake', 'drake']);
    expect(lair[0]!.elite).not.toBeNull();

    for (let room = 1; room < DELVE_ROOMS; room++) {
      const [a, b] = delveOffer(seed, room);
      expect(a).not.toBe(b);
      expect(BOON_IDS).toContain(a);
      expect(delveOffer(seed, room)).toEqual([a, b]);
    }
  });

  it('gives a Boon’s gift at once, and its lasting power in every fight after', () => {
    const full = { maxHp: 100, uses: { spells: 3, heals: 0 } };
    const state = { hp: 30, potions: 1, uses: { spells: 0, heals: 0 } };
    expect(takeBoon(state, 'mend', full)).toEqual({ ...state, hp: 70 });
    expect(takeBoon({ ...state, hp: 90 }, 'mend', full).hp).toBe(100);
    expect(takeBoon(state, 'draught', full).potions).toBe(2);
    expect(takeBoon(state, 'breath', full)).toEqual({ hp: 45, potions: 1, uses: { spells: 3, heals: 0 } });
    expect(takeBoon(state, 'ward', full)).toBe(state);

    const hero = { ac: 15, damagePct: 5, critChance: 0, lifeSteal: 0 } as HeroCombat;
    expect(withBoons(hero, ['ward', 'ward', 'whetstone', 'keen', 'leech', 'mend'])).toMatchObject({ ac: 19, damagePct: 20, critChance: 10, lifeSteal: 10 });
  });

  it('scores 100 a Room, the health left for stopping, and half for falling', () => {
    expect(delveScore(0, 50, 50, 'stopped')).toBe(0);
    expect(delveScore(3, 25, 100, 'stopped')).toBe(325);
    expect(delveScore(6, 100, 100, 'cleared')).toBe(700);
    expect(delveScore(4, 60, 100, 'fled')).toBe(400);
    expect(delveScore(5, 0, 100, 'fell')).toBe(250);
    expect(delveGold(4, 3)).toBe(150);
  });
});
