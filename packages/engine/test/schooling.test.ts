import { describe, expect, it } from 'vitest';
import { ACADEMY, academyPrice } from '../src/index.js';

describe('the Academy', () => {
  it('asks more for each Talent, three in all, from level 12', () => {
    expect([0, 1, 2, 3].map(academyPrice)).toEqual([2000, 6000, 15000, null]);
    expect(ACADEMY.minLevel).toBe(12);
  });
});
