import { describe, expect, it } from 'vitest';
import {
  BLESSING_IDS, BLESSINGS, CURSE_IDS, FLOOR_COUNT, OATH_DEPTH, bestLeft, cluesFor, doorsOf, dropOdds, generateLabyrinth, luckOf, nextPicker, oathOdds,
  oathOutcome, tierRank,
} from '../src/index.js';

describe('Oathstones', () => {
  it('stand in one quiet Room per Floor above the lair, and every Clue toward one is true', () => {
    for (const seed of ['season-0', 'alpha', 'beta', 'gamma']) {
      const plain = new Map(generateLabyrinth(seed).floors.map((f) => [f.number, f]));
      for (const floor of plain.values()) {
        const stones = floor.rooms.filter((r) => r.type === 'oathstone');
        if (floor.number === FLOOR_COUNT) {
          expect(stones).toHaveLength(0);
          continue;
        }
        expect(stones).toHaveLength(1);
        const stone = stones[0]!;
        expect(stone.event).toBeNull();
        const { x, y } = floor.rooms[floor.landing]!;
        expect(Math.abs(stone.x - x) + Math.abs(stone.y - y)).toBeGreaterThanOrEqual(3);
        const said = cluesFor('oathstone', floor.theme).map((c) => c.en);
        for (const { to } of doorsOf(floor, stone.id)) {
          const back = doorsOf(floor, to).find((d) => d.to === stone.id)!;
          expect(back.clue.lie).toBe(false);
          expect(said).toContain(back.clue.text.en);
        }
      }
    }
  });

  it('play a game of chicken: share and share alike, take it all, or both are cursed', () => {
    expect(oathOutcome('share', 'share')).toEqual({ gifts: [1, 1], cursed: false });
    expect(oathOutcome('take', 'share')).toEqual({ gifts: [2, 0], cursed: false });
    expect(oathOutcome('share', 'take')).toEqual({ gifts: [0, 2], cursed: false });
    expect(oathOutcome('take', 'take')).toEqual({ gifts: [0, 0], cursed: true });
  });

  it('give Rare and better gifts, with the odds of three Floors deeper', () => {
    const odds = oathOdds(2);
    expect(odds.every(([tier]) => tierRank(tier) >= tierRank('rare'))).toBe(true);
    expect(odds).toEqual(dropOdds(2 + OATH_DEPTH).filter(([tier]) => tierRank(tier) >= tierRank('rare')));
  });

  it('crack into a curse nobody can pray for or buy, which halves gold and dims luck', () => {
    expect(BLESSING_IDS).not.toContain('oathbroken');
    expect(CURSE_IDS).toContain('oathbroken');
    expect(BLESSINGS.oathbroken.curse).toBe(true);
    expect(luckOf({ worn: [], blessing: 'oathbroken' })).toMatchObject({ goldFind: -50, magicFind: -25 });
  });
});

describe('Duo Chests', () => {
  const pair = ['a', 'b'] as const;
  const anyone = () => true;

  it('take turns, the first picker first', () => {
    expect(nextPicker(pair, null, anyone)).toBe('a');
    expect(nextPicker(pair, 'a', anyone)).toBe('b');
    expect(nextPicker(pair, 'b', anyone)).toBe('a');
  });

  it('skip a Hero who can carry no more, and stop when neither can', () => {
    expect(nextPicker(pair, 'b', (id) => id !== 'a')).toBe('b');
    expect(nextPicker(pair, null, () => false)).toBeNull();
  });

  it('take the best Item left for a Player whose time ran out', () => {
    const items = [{ tier: 'rare' as const, itemLevel: 3 }, { tier: 'epic' as const, itemLevel: 2 }, { tier: 'epic' as const, itemLevel: 4 }];
    expect(bestLeft(items, new Set())).toBe(2);
    expect(bestLeft(items, new Set([2]))).toBe(1);
    expect(bestLeft(items, new Set([0, 1, 2]))).toBeNull();
  });
});
