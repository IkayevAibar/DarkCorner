import type { DuoChestView } from '@dark/shared';

/** Missing history means this whole closed snapshot is new, never that unclaimed Items were taken. */
export function newChestPicks(chest: DuoChestView, before?: DuoChestView) {
  const known = new Map(before?.items.map(entry => [entry.item.id, entry.takenBy]));
  return chest.items.flatMap((entry, index) => entry.takenBy && !known.get(entry.item.id)
    ? [{ item: entry.item, index, side: entry.takenBy }] : []);
}

export const PICK_FLIGHT_MS = 900;
