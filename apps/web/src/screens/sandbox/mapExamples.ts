import type { Exit, RoomTypeId } from '@dark/shared';
import type { MapView } from '../../components/map/geometry';

export interface MapExample { id: 'fresh' | 'half' | 'full' | 'lair'; width: number; height: number; current: number; map: MapView; revealed: MapView }
const room = (id: number, width: number, type: RoomTypeId | null, visited = true, cleared = false) =>
  ({ id, x: id % width, y: Math.floor(id / width), type, visited, cleared, free: visited && (cleared || ['empty', 'landing', 'waypoint', 'camp'].includes(type ?? '')), back: cleared ? '2026-10-11T00:00:00Z' : null });
const door = (a: number, b: number, kind: MapView['doors'][number]['kind'] = 'open') => ({ a, b, kind, passable: kind !== 'twin', key: kind === 'locked' });
const fresh: MapView = { rooms: [room(44, 10, 'landing'), ...[34, 43, 45, 54].map(id => room(id, 10, null, false))], doors: [34, 43, 45, 54].map(id => door(44, id)) };
const half: MapView = {
  rooms: [room(31, 10, 'landing'), room(32, 10, 'fight', true, true), room(33, 10, 'camp'), room(23, 10, 'event'), room(13, 10, 'treasure', true, true), room(14, 10, 'empty'), room(15, 10, 'waypoint'), room(25, 10, 'fight'), room(35, 10, 'miniboss'), room(43, 10, 'empty'), room(44, 10, 'waypoint'), room(45, 10, 'vault', false), room(54, 10, null, false), room(53, 10, 'hidden', false), room(65, 10, 'stairs', false)],
  doors: [door(31, 32), door(32, 33), door(33, 23), door(23, 13), door(13, 14), door(14, 15), door(15, 25), door(25, 35), door(33, 43), door(43, 44), door(44, 45, 'locked'), door(44, 54, 'cracked'), door(43, 53, 'secret')],
};
const kinds: RoomTypeId[] = ['empty', 'fight', 'event', 'fight', 'treasure', 'empty', 'fight', 'camp'];
const full: MapView = { rooms: [], doors: [] };
for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
  const id = y * 10 + x;
  if (id === 9 || id === 90 || id === 99) continue;
  full.rooms.push(room(id, 10, id === 0 ? 'landing' : id === 98 ? 'stairs' : id === 57 ? 'waypoint' : kinds[(id * 7 + y) % kinds.length]!, id < 89, id % 3 !== 0));
  if (x > 0 && full.rooms.some(r => r.id === id - 1)) full.doors.push(door(id - 1, id, id % 17 === 0 ? 'locked' : 'open'));
  if (y > 0 && (x === (y % 2 ? 9 : 0) || x === 4) && full.rooms.some(r => r.id === id - 10)) full.doors.push(door(id - 10, id, id === 44 ? 'cracked' : 'open'));
}
const lair: MapView = { rooms: [room(0, 6, 'landing'), room(1, 6, 'event'), room(6, 6, null, false)], doors: [door(0, 1), door(0, 6)] };
const path = [2, 8, 14, 15, 21, 27, 28, 29, 35];
const revealedLair: MapView = { rooms: [...lair.rooms, ...path.map((id, i) => room(id, 6, i === path.length - 1 ? 'boss' : i === 3 ? 'event' : 'empty', false))], doors: [...lair.doors, ...path.map((id, i) => door(i === 0 ? 1 : path[i - 1]!, id))] };
export const MAPS: MapExample[] = [
  { id: 'fresh', width: 10, height: 10, current: 44, map: fresh, revealed: { rooms: [...fresh.rooms, room(35, 10, 'hidden', false)], doors: [...fresh.doors, door(45, 35, 'secret')] } },
  { id: 'half', width: 10, height: 10, current: 44, map: half, revealed: { rooms: [...half.rooms, room(55, 10, 'hidden', false)], doors: [...half.doors, door(54, 55, 'secret')] } },
  { id: 'full', width: 10, height: 10, current: 44, map: full, revealed: full },
  { id: 'lair', width: 6, height: 6, current: 0, map: lair, revealed: revealedLair },
];

/** Sandbox only: live passability and costs always come from the server's Exit[]. */
export function exitsFor(map: MapView, current: number): Exit[] {
  const here = map.rooms.find(r => r.id === current)!;
  return map.doors.flatMap(d => {
    const to = d.a === current ? d.b : d.b === current ? d.a : undefined;
    const r = map.rooms.find(r => r.id === to);
    if (!r) return [];
    return [{ to: r.id, direction: r.x < here.x ? 'w' : r.x > here.x ? 'e' : r.y < here.y ? 'n' : 's', kind: d.kind,
      passable: true, visited: r.visited, free: r.visited && (r.cleared || r.type === 'empty' || r.type === 'waypoint' || r.type === 'landing'),
      suspicious: false, clue: { en: '', ru: '' } }];
  });
}
