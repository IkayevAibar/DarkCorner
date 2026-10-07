import { describe, expect, it } from 'vitest';
import { canSlide, doorKey, frame, reveals } from './geometry';
import { MAPS } from '../../screens/sandbox/mapExamples';

describe('Floor map framing and motion', () => {
  it('crops a fresh Floor and fits every known Room on dense and lair Floors', () => {
    expect(frame(MAPS[0]!.map.rooms, 10, 10)).toEqual({ x: 1, y: 1, w: 6, h: 6 });
    for (const example of MAPS) {
      const view = frame(example.revealed.rooms, example.width, example.height);
      expect(view.x).toBeGreaterThanOrEqual(0);
      expect(view.y).toBeGreaterThanOrEqual(0);
      expect(view.x + view.w).toBeLessThanOrEqual(example.width);
      expect(view.y + view.h).toBeLessThanOrEqual(example.height);
      for (const r of example.revealed.rooms) {
        expect(r.x).toBeGreaterThanOrEqual(view.x); expect(r.x).toBeLessThan(view.x + view.w);
        expect(r.y).toBeGreaterThanOrEqual(view.y); expect(r.y).toBeLessThan(view.y + view.h);
      }
    }
    expect(frame([], 6, 6)).toEqual({ x: 0, y: 0, w: 6, h: 6 });
  });
  it('slides only through a known adjacent Door, including locks and secrets', () => {
    const map = MAPS[1]!.map;
    expect(canSlide(map, 44, 45)).toBe(true);
    expect(canSlide(map, 43, 53)).toBe(true);
    expect(canSlide(map, 44, 15)).toBe(false);
    expect(canSlide(map, 45, 35)).toBe(false);
    expect(canSlide(map, 44, 999)).toBe(false);
    expect(doorKey({ a: 44, b: 45, kind: 'locked', passable: true, key: true })).toBe(doorKey({ a: 45, b: 44, kind: 'locked', passable: true, key: true }));
  });
  it('unrolls a winding lair path from the Hero, all within 350 ms', () => {
    const example = MAPS[3]!;
    const before = JSON.stringify(example);
    const changed = reveals(example.map, example.revealed, 0);
    expect([...changed.keys()]).toEqual([2, 8, 14, 15, 21, 27, 28, 29, 35]);
    expect(Math.max(...changed.values()) + 210).toBeLessThan(400);
    expect(reveals(example.revealed, example.revealed, 0).size).toBe(0);
    expect(JSON.stringify(example)).toBe(before);
  });
  it('lifts fog on first visit and on a known type revealed without visiting', () => {
    const map = MAPS[0]!.map;
    const visited = { ...map, rooms: map.rooms.map(r => r.id === 34 ? { ...r, visited: true, type: 'empty' as const } : r) };
    const revealed = { ...map, rooms: map.rooms.map(r => r.id === 34 ? { ...r, type: 'hidden' as const } : r) };
    expect([...reveals(map, visited, 34).keys()]).toEqual([34]);
    expect([...reveals(map, revealed, 44).keys()]).toEqual([34]);
  });
});
