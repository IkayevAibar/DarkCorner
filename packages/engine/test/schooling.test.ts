import { describe, expect, it } from 'vitest';
import { ACADEMY, TRAINING_MS, academyPrice, trainingPrice } from '../src/index.js';

describe('the Academy', () => {
  it('asks more for each Talent, three in all, from level 12', () => {
    expect([0, 1, 2, 3].map(academyPrice)).toEqual([2000, 6000, 15000, null]);
    expect(ACADEMY.minLevel).toBe(12);
  });
});

describe('the Training grounds', () => {
  it('asks more for each training, three in all, eight hours each', () => {
    expect([0, 1, 2, 3].map(trainingPrice)).toEqual([1000, 3000, 8000, null]);
    expect(TRAINING_MS).toBe(8 * 60 * 60 * 1000);
  });
});
