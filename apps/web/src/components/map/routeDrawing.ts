import { canSlide, center, type MapRoom, type MapView } from './geometry';

type Point = { x: number; y: number };
const SIDES: Point[] = [{ x: 0, y: -22 }, { x: 22, y: 0 }, { x: 0, y: 22 }, { x: -22, y: 0 }];
const CORNERS: Point[] = [{ x: 22, y: -22 }, { x: 22, y: 22 }, { x: -22, y: 22 }, { x: -22, y: -22 }];
const side = (a: MapRoom, b: MapRoom) => b.y < a.y ? 0 : b.x > a.x ? 1 : b.y > a.y ? 2 : 3;
const at = (room: MapRoom, offset: Point): Point => ({ x: center(room).x + offset.x, y: center(room).y + offset.y });

/** Follow Door centers and the outside of Room walls, leaving each glyph clear. */
export function routeInk(map: MapView, current: number, route: readonly number[] = []): Point[] {
  const rooms = new Map(map.rooms.map(r => [r.id, r]));
  const ids = [current, ...route], ink: Point[] = [];
  for (let i = 0; i < ids.length; i++) {
    const room = rooms.get(ids[i]!);
    if (!room) return [];
    const previous = i ? rooms.get(ids[i - 1]!) : undefined, next = rooms.get(ids[i + 1]!);
    if (next && !canSlide(map, room.id, next.id)) return [];
    if (previous) ink.push(at(room, SIDES[side(room, previous)]!));
    if (previous && next) {
      const enter = side(room, previous), leave = side(room, next);
      const clockwise = (leave - enter + 4) % 4;
      const direction = clockwise <= 2 ? 1 : -1, turns = Math.min(clockwise, 4 - clockwise);
      for (let turn = 0; turn < turns; turn++) {
        const edge = (enter + direction * turn + 4) % 4;
        ink.push(at(room, CORNERS[direction === 1 ? edge : (edge + 3) % 4]!));
        ink.push(at(room, SIDES[(edge + direction + 4) % 4]!));
      }
    } else if (next) ink.push(at(room, SIDES[side(room, next)]!));
  }
  return ink;
}

/** The response may stop before the goal; animate only the confirmed prefix of the old Route. */
export function walkedRooms(previous: MapView, next: MapView, from: number, to: number, route?: readonly number[] | null): MapRoom[] {
  if (from === to) return [];
  const end = route?.indexOf(to) ?? -1;
  const ids = end >= 0 ? [from, ...route!.slice(0, end + 1)] : [from, to];
  const combined: MapView = { rooms: [...previous.rooms.filter(r => !next.rooms.some(n => n.id === r.id)), ...next.rooms], doors: [...previous.doors, ...next.doors] };
  if (ids.some((id, i) => i > 0 && !canSlide(combined, ids[i - 1]!, id))) return [];
  return ids.map(id => combined.rooms.find(r => r.id === id)!);
}
