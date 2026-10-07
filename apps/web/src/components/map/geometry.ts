import type { Exit, LabyrinthView } from '@dark/shared';

export type MapView = NonNullable<LabyrinthView['map']>;
export type MapRoom = MapView['rooms'][number];
export type MapDoor = MapView['doors'][number];
export interface MapProps {
  width: number; height: number; map: MapView; current: number; banner: string;
  exits: Exit[]; disabled: boolean; onMove: (to: number) => void;
  /** A Route being followed: the Rooms after the current one, its goal last (route.ts). */
  route?: number[] | null;
  /** The Room picked as a Route's goal, reachable or not. */
  picked?: number | null;
  /** Given, a tap on any Room picks it as a Route's goal instead of walking next door. */
  onPick?: (room: number) => void;
}
export const CELL = 48;
export const center = (r: MapRoom) => ({ x: (r.x + .5) * CELL, y: (r.y + .5) * CELL });
export const doorKey = (d: MapDoor) => `${Math.min(d.a, d.b)}-${Math.max(d.a, d.b)}-${d.kind}`;

/** Known Rooms plus one cell of fog; never zoom out to an entirely unseen Floor. */
export function frame(rooms: MapRoom[], width: number, height: number) {
  const axis = (values: number[], size: number) => {
    if (!values.length) return { start: 0, span: size };
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.min(size, Math.max(6, max - min + 3));
    return { start: Math.max(0, Math.min(size - span, Math.floor((min + max + 1 - span) / 2))), span };
  };
  const x = axis(rooms.map(r => r.x), width), y = axis(rooms.map(r => r.y), height);
  return { x: x.start, y: y.start, w: x.span, h: y.span };
}

/** Only a known connecting Door permits a walking animation; Portals fade. */
export function canSlide(map: MapView, from: number, to: number) {
  const a = map.rooms.find(r => r.id === from), b = map.rooms.find(r => r.id === to);
  return !!a && !!b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
    && map.doors.some(d => (d.a === from && d.b === to) || (d.b === from && d.a === to));
}

/** Breadth-first order follows the revealed route, including its bends, toward the Dragon. */
export function reveals(previous: MapView, next: MapView, current: number) {
  const old = new Map(previous.rooms.map(r => [r.id, r]));
  const distance = new Map([[current, 0]]), queue = [current];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    for (const d of next.doors) {
      const other = d.a === id ? d.b : d.b === id ? d.a : undefined;
      if (other !== undefined && !distance.has(other)) {
        distance.set(other, distance.get(id)! + 1); queue.push(other);
      }
    }
  }
  const changed = next.rooms.filter(r => !old.has(r.id) || (!old.get(r.id)!.visited && r.visited)
    || (!old.get(r.id)!.type && r.type));
  changed.sort((a, b) => (distance.get(a.id) ?? Infinity) - (distance.get(b.id) ?? Infinity) || a.id - b.id);
  return new Map(changed.map((r, i) => [r.id, changed.length > 1 ? i * 140 / (changed.length - 1) : 0]));
}
