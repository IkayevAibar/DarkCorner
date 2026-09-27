import { describe, expect, it } from 'vitest';
import { HUNT_PER_HERO, createRng, huntKin, huntTarget, huntTitle } from '../src/index.js';

describe('the Hunt', () => {
  it('hunts only kins that live on the Floors down to where most Heroes are', () => {
    const seen = (depth: number) => new Set(Array.from({ length: 300 }, (_, i) => huntKin(createRng(`hunt-${depth}-${i}`), depth)));
    expect([...seen(1)].sort()).toEqual(['beast', 'goblinoid']);
    expect([...seen(5)].sort()).toEqual(['beast', 'goblinoid', 'undead']);
    expect(seen(10).has('dragonkin')).toBe(true);
    expect(huntKin(createRng('same'), 6)).toBe(huntKin(createRng('same'), 6));
  });

  it('asks 40 for every Hero seen that week, never fewer than for three, and less when posted late in the week', () => {
    expect(huntTarget(0)).toBe(3 * HUNT_PER_HERO);
    expect(huntTarget(8)).toBe(8 * HUNT_PER_HERO);
    expect(huntTarget(7, 3)).toBe(3 * HUNT_PER_HERO);
    expect(huntTarget(3, 1)).toBe(HUNT_PER_HERO);
  });

  it('names the quarry in both languages', () => {
    expect(huntTitle('undead')).toEqual({ en: 'The Hunt: undead', ru: 'Охота на нежить' });
  });
});
