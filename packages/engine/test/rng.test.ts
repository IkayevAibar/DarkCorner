import { describe, expect, it } from 'vitest';
import { createRng } from '../src/index.js';

describe('createRng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createRng('season-0:hero-1:fight-7');
    const b = createRng('season-0:hero-1:fight-7');
    const first = Array.from({ length: 50 }, () => a.next());
    const second = Array.from({ length: 50 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('keeps next() inside [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('covers every value of int() evenly', () => {
    const rng = createRng('fairness');
    const counts = new Array(20).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) counts[rng.int(1, 20) - 1]++;
    for (const c of counts) {
      // Each face should land within 5% of n/20 over this many rolls.
      expect(Math.abs(c - n / 20) / (n / 20)).toBeLessThan(0.05);
    }
  });

  it('rejects impossible ranges and empty picks', () => {
    const rng = createRng('errors');
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
