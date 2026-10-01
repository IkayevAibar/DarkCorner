import { describe, expect, it } from 'vitest';
import { trustChest } from '../../sandbox/trustFixtures';
import { newChestPicks } from './chestPicks';

describe('confirmed Chest flights', () => {
  it('flies only newly assigned Items, to their server-provided takers', () => {
    const chest = trustChest();
    const before = { ...chest, items: chest.items.map((entry, index) => ({ ...entry, takenBy: index === 0 ? 'me' as const : null })) };
    const closed = { ...before, turn: null, items: before.items.map((entry, index) => index === 1 ? { ...entry, takenBy: 'partner' as const } : entry) };
    expect(newChestPicks(closed, before)).toEqual([{ item: closed.items[1]!.item, index: 1, side: 'partner' }]);
    expect(newChestPicks(closed, closed)).toEqual([]);
  });

  it('handles multiple automatic picks received at once and leaves unclaimed Items behind', () => {
    const chest = trustChest();
    const closed = { ...chest, turn: null, items: chest.items.map((entry, index) => ({ ...entry, takenBy: index === 0 ? 'me' as const : index === 1 ? 'partner' as const : null })) };
    expect(newChestPicks(closed, chest).map(({ index, side }) => ({ index, side }))).toEqual([{ index: 0, side: 'me' }, { index: 1, side: 'partner' }]);
    expect(newChestPicks(closed)).toEqual(newChestPicks(closed, chest));
    expect(newChestPicks({ ...chest, turn: null })).toEqual([]);
  });
});
