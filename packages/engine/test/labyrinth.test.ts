import { describe, expect, it } from 'vitest';
import { FLOOR_COUNT, type Floor, doorsOf, generateLabyrinth } from '../src/index.js';

/** Rooms reachable from the landing through Doors of the given kinds. */
function reachable(floor: Floor, kinds: string[]): Set<number> {
  const seen = new Set([floor.landing]);
  const queue = [floor.landing];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const { door, to } of doorsOf(floor, cur)) {
      if (kinds.includes(door.kind) && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

const count = (floor: Floor, type: string) => floor.rooms.filter((r) => r.type === type).length;

describe('generateLabyrinth', () => {
  const seeds = ['season-0', 'alpha', 'beta', 'gamma', 'delta'];

  it('is the same Labyrinth for the same seed', () => {
    expect(generateLabyrinth('season-0')).toEqual(generateLabyrinth('season-0'));
    expect(generateLabyrinth('season-0')).not.toEqual(generateLabyrinth('season-1'));
  });

  it('has ten Floors, the last one the Dragon’s lair', () => {
    const lab = generateLabyrinth('season-0');
    expect(lab.floors).toHaveLength(FLOOR_COUNT);
    expect(lab.floors.map((f) => f.theme)).toEqual([
      'warrens', 'warrens', 'warrens', 'crypts', 'crypts', 'crypts', 'depths', 'depths', 'depths', 'lair',
    ]);
  });

  it('lets anyone reach every Room through ordinary Doors, apart from hidden ones behind a secret Door', () => {
    for (const seed of seeds) {
      for (const floor of generateLabyrinth(seed).floors) {
        const hidden = floor.rooms.filter((r) => r.type === 'hidden');
        expect(reachable(floor, ['open']).size).toBe(floor.rooms.length - hidden.length);
        expect(reachable(floor, ['open', 'secret']).size).toBe(floor.rooms.length);
      }
    }
  });

  it('hides 1–2 dead-end Rooms per Floor above the lair, each behind one secret Door', () => {
    for (const seed of seeds) {
      for (const floor of generateLabyrinth(seed).floors) {
        const hidden = floor.rooms.filter((r) => r.type === 'hidden');
        if (floor.number === FLOOR_COUNT) {
          expect(hidden).toHaveLength(0);
          continue;
        }
        expect(hidden.length).toBeGreaterThanOrEqual(1);
        expect(hidden.length).toBeLessThanOrEqual(2);
        for (const room of hidden) {
          const doors = floor.doors.filter((d) => d.a === room.id || d.b === room.id);
          expect(doors.map((d) => d.kind)).toEqual(['secret']);
        }
      }
    }
  });

  it('places the fixed Rooms on every Floor', () => {
    for (const seed of seeds) {
      for (const floor of generateLabyrinth(seed).floors) {
        expect(count(floor, 'landing')).toBe(1);
        expect(count(floor, 'waypoint')).toBe(1);
        if (floor.number < FLOOR_COUNT) {
          expect(count(floor, 'stairs')).toBeGreaterThanOrEqual(2);
          expect(count(floor, 'stairs')).toBeLessThanOrEqual(4);
          expect(count(floor, 'miniboss')).toBe(1);
          expect(count(floor, 'vault')).toBeGreaterThanOrEqual(1);
          expect(count(floor, 'camp')).toBeGreaterThanOrEqual(3);
          expect(count(floor, 'boss')).toBe(0);
        } else {
          expect(count(floor, 'boss')).toBe(1);
          expect(count(floor, 'stairs')).toBe(0);
        }
      }
    }
  });

  it('mixes Rooms roughly as the design says', () => {
    const floors = seeds.flatMap((s) => generateLabyrinth(s).floors.slice(0, 9));
    const total = floors.reduce((n, f) => n + f.rooms.length, 0);
    const share = (type: string) => floors.reduce((n, f) => n + count(f, type), 0) / total;
    expect(share('fight')).toBeGreaterThan(0.45);
    expect(share('fight')).toBeLessThan(0.62);
    expect(share('event')).toBeGreaterThan(0.08);
    expect(share('treasure')).toBeGreaterThan(0.04);
  });

  it('gives every Room an event kind only when it is an Event room', () => {
    for (const floor of generateLabyrinth('season-0').floors) {
      for (const room of floor.rooms) expect(room.event !== null).toBe(room.type === 'event');
    }
  });

  it('lies on about one Clue in five', () => {
    const doors = seeds.flatMap((s) => generateLabyrinth(s).floors.flatMap((f) => f.doors));
    const clues = doors.flatMap((d) => [d.clueFromA, d.clueFromB]);
    const lies = clues.filter((c) => c.lie).length / clues.length;
    expect(lies).toBeGreaterThan(0.16);
    expect(lies).toBeLessThan(0.24);
    for (const clue of clues) {
      expect(clue.text.en.length).toBeGreaterThan(3);
      expect(clue.text.ru.length).toBeGreaterThan(3);
    }
  });
});
