import { describe, expect, it } from 'vitest';
import type { MapView } from './geometry';
import { findRoute } from './route';

type Room = MapView['rooms'][number];
type Door = MapView['doors'][number];
const room = (id: number, x: number, y: number, over: Partial<Room> = {}): Room =>
  ({ id, x, y, type: 'empty', visited: true, cleared: false, free: true, back: null, ...over });
const door = (a: number, b: number, over: Partial<Door> = {}): Door => ({ a, b, kind: 'open', passable: true, key: false, ...over });

/**
 *   0 - 1 - 2
 *   |       |
 *   3 - 4 - 5 - 6 (6 only seen)
 */
const map = (rooms: Partial<Record<number, Partial<Room>>> = {}, doors: Partial<Record<string, Partial<Door>>> = {}): MapView => ({
  rooms: [
    room(0, 0, 0), room(1, 1, 0), room(2, 2, 0), room(3, 0, 1), room(4, 1, 1), room(5, 2, 1), room(6, 3, 1, { visited: false, free: false, type: null }),
  ].map((r) => ({ ...r, ...rooms[r.id] })),
  doors: [door(0, 1), door(1, 2), door(0, 3), door(3, 4), door(4, 5), door(2, 5), door(5, 6)].map((d) => ({ ...d, ...doors[`${d.a}-${d.b}`] })),
});

describe('Routes on the Map', () => {
  it('finds the shortest way through known Rooms, free all along', () => {
    expect(findRoute(map(), 0, 2)).toEqual({ rooms: [1, 2], stamina: 0, keys: 0, waits: 0 });
    expect(findRoute(map(), 3, 2)?.rooms).toEqual([0, 1, 2]);
  });

  it('goes round a Room where something waits, if there is a way round', () => {
    expect(findRoute(map({ 1: { free: false } }), 0, 2)).toEqual({ rooms: [3, 4, 5, 2], stamina: 0, keys: 0, waits: 0 });
    // No way round: through it, and the walk will stop there.
    expect(findRoute(map({ 1: { free: false }, 4: { free: false } }), 0, 2)).toEqual({ rooms: [1, 2], stamina: 1, keys: 0, waits: 1 });
  });

  it('spares the Iron keys a lock takes, and keeps to Doors the Hero gets through', () => {
    expect(findRoute(map({}, { '0-1': { kind: 'locked', key: true } }), 0, 2)?.rooms).toEqual([3, 4, 5, 2]);
    expect(findRoute(map({}, { '0-1': { kind: 'locked', key: true }, '0-3': { kind: 'locked', key: true } }), 0, 2)).toMatchObject({ rooms: [1, 2], keys: 1 });
    expect(findRoute(map({}, { '0-1': { passable: false }, '0-3': { passable: false } }), 0, 2)).toBeNull();
  });

  it('ends in a Room only seen, but never walks through one', () => {
    expect(findRoute(map(), 0, 6)).toEqual({ rooms: [1, 2, 5, 6], stamina: 1, keys: 0, waits: 0 });
    // Past an unvisited Room the Doors are unknown, so there is no way to 2 through it.
    expect(findRoute(map({ 1: { visited: false, free: false }, 4: { visited: false, free: false } }), 0, 2)).toBeNull();
    expect(findRoute(map(), 0, 0)).toBeNull();
    expect(findRoute(map(), 0, 42)).toBeNull();
  });
});
