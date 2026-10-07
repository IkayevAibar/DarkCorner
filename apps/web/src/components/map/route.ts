import type { MapView } from './geometry';

/** A Route picked on the Map: the Rooms to walk through after the one the Hero stands in, the goal last. */
export interface Route {
  rooms: number[];
  /** Rooms on it that cost Stamina: not stood in yet, or something new waits there. */
  stamina: number;
  /** Locked Doors on it without a Rogue: each takes an Iron key. */
  keys: number;
  /** Rooms on the way (the goal aside) where something waits: the walk stops at the first. */
  waits: number;
}

/** A step costs 1; a Room where something waits, or a lock that eats a Key, costs more, so a Route goes round them when it can. */
const WAITING = 20;
const KEY = 8;

/**
 * The cheapest known way from one Room to another (docs/design.md → Routes): through Doors
 * this Hero gets through and Rooms it has stood in, the goal any Room on the Map. Null when
 * there is no known way, or the Hero is there already.
 */
export function findRoute(map: MapView, from: number, to: number): Route | null {
  const rooms = new Map(map.rooms.map((r) => [r.id, r]));
  if (from === to || !rooms.has(to)) return null;
  const doors = new Map<number, { to: number; key: boolean }[]>();
  for (const d of map.doors) {
    if (!d.passable) continue;
    for (const [a, b] of [[d.a, d.b], [d.b, d.a]] as const) doors.set(a, [...(doors.get(a) ?? []), { to: b, key: d.key }]);
  }
  // Dijkstra over a Floor of at most a hundred Rooms: picking the nearest by a scan is plenty.
  const cost = new Map<number, number>([[from, 0]]);
  const came = new Map<number, { room: number; key: boolean }>();
  const open = new Set([from]);
  while (open.size > 0) {
    let at = -1;
    for (const id of open) if (at === -1 || cost.get(id)! < cost.get(at)!) at = id;
    open.delete(at);
    if (at === to) break;
    // Only Rooms stood in are walked through: past one only seen, the Doors are unknown.
    if (at !== from && !rooms.get(at)?.visited) continue;
    for (const step of doors.get(at) ?? []) {
      const room = rooms.get(step.to);
      if (!room) continue;
      const next = cost.get(at)! + 1 + (step.key ? KEY : 0) + (step.to !== to && !room.free ? WAITING : 0);
      if (next < (cost.get(step.to) ?? Infinity)) {
        cost.set(step.to, next);
        came.set(step.to, { room: at, key: step.key });
        open.add(step.to);
      }
    }
  }
  if (!came.has(to)) return null;
  const path: number[] = [];
  let keys = 0;
  for (let at = to; at !== from; at = came.get(at)!.room) {
    path.unshift(at);
    if (came.get(at)!.key) keys++;
  }
  const paid = (id: number) => !rooms.get(id)!.free;
  return { rooms: path, stamina: path.filter(paid).length, keys, waits: path.slice(0, -1).filter(paid).length };
}
