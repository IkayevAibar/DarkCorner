import {
  CRYPT_EVENT_KINDS, DEPTH_EVENT_KINDS, FIRST_EVENT_KINDS, LAIR_EVENT_KINDS, WARREN_EVENT_KINDS, type EventKind, FLOOR_COUNT, type RoomType, THEMES, type ThemeId, cluesFor, floorSize, themeOf,
} from './content/floors.js';
import type { Text } from './content/text.js';
import { type Rng, createRng } from './rng.js';

/**
 * The Labyrinth is a pure function of the Season's seed: it is never stored,
 * only regenerated (and cached). Bump LABYRINTH_VERSION whenever generation
 * changes, because a running Season must keep the Labyrinth it started with.
 */
export const LABYRINTH_VERSION = 4;

/** About 1 Clue in 5 lies (docs/design.md, v0). */
export const CLUE_LIE_CHANCE = 0.2;

/** Secret Doors lead to hidden rooms and show only to a Hero who spots them; Twin doors open only for a Duo. */
export type DoorKind = 'open' | 'cracked' | 'locked' | 'secret' | 'twin';

export interface Clue {
  text: Text;
  lie: boolean;
}

export interface Room {
  /** Index on its Floor: y * width + x. */
  id: number;
  x: number;
  y: number;
  type: RoomType;
  event: EventKind | null;
  /** Room map art id (apps/web/public/art/rooms/<map>.jpg). */
  map: string;
}

export interface Door {
  a: number;
  b: number;
  /** Cracked walls open only for Fighters; locked Doors need a Key or a Rogue. */
  kind: DoorKind;
  /** Read from Room a, about Room b. */
  clueFromA: Clue;
  /** Read from Room b, about Room a. */
  clueFromB: Clue;
}

export interface Floor {
  number: number;
  theme: ThemeId;
  width: number;
  height: number;
  /** Where a Hero arrives on this Floor, from the gate or the stairs above. */
  landing: number;
  rooms: Room[];
  doors: Door[];
}

export interface Labyrinth {
  seed: string;
  floors: Floor[];
}

export function generateLabyrinth(seed: string): Labyrinth {
  const floors: Floor[] = [];
  for (let n = 1; n <= FLOOR_COUNT; n++) {
    const floor = hideRooms(createRng(`${seed}:floor:${n}:secrets`), generateFloor(createRng(`${seed}:floor:${n}`), n));
    floors.push(twinRooms(createRng(`${seed}:floor:${n}:twins`), laterEvents(seed, floor)));
  }
  return { seed, floors };
}

/**
 * A quarter of the goblin warrens' event Rooms hold one of the kinds added later, a fifth
 * of the crypts' and the depths', and half of the lair's few (v0).
 */
export const WARREN_EVENT_SHARE = 0.25;
export const DEEP_EVENT_SHARE = 0.2;
export const LAIR_EVENT_SHARE = 0.5;

/** Event kinds added after Season 0 began, per theme: the share of event Rooms they take, and the name of their seed. */
const LATER_EVENTS: Partial<Record<ThemeId, { kinds: readonly EventKind[]; share: number; seed: string }>> = {
  warrens: { kinds: WARREN_EVENT_KINDS, share: WARREN_EVENT_SHARE, seed: 'warren-events' },
  crypts: { kinds: CRYPT_EVENT_KINDS, share: DEEP_EVENT_SHARE, seed: 'deep-events' },
  depths: { kinds: DEPTH_EVENT_KINDS, share: DEEP_EVENT_SHARE, seed: 'deep-events' },
  lair: { kinds: LAIR_EVENT_KINDS, share: LAIR_EVENT_SHARE, seed: 'lair-events' },
};

/**
 * A theme's later event kinds, rolled on their own seed after the Floor is made:
 * a Labyrinth generated before they existed keeps its layout, Clues and every
 * other event.
 */
function laterEvents(seed: string, floor: Floor): Floor {
  const later = LATER_EVENTS[floor.theme];
  if (!later) return floor;
  const rng = createRng(`${seed}:floor:${floor.number}:${later.seed}`);
  const rooms = floor.rooms.map((r) => (r.type === 'event' && rng.chance(later.share) ? { ...r, event: rng.pick(later.kinds) } : r));
  return { ...floor, rooms };
}

/** Rooms that can become hidden rooms: plain ones, a dead end with a single ordinary Door, a few steps from the landing. */
const HIDEABLE: RoomType[] = ['fight', 'empty', 'event', 'treasure'];

/**
 * 1–2 dead-end Rooms per Floor (not the lair) become hidden rooms behind a
 * secret Door (v0). It runs on its own RNG after the rest, so it changes only
 * those Rooms and their Doors.
 */
function hideRooms(rng: Rng, floor: Floor): Floor {
  if (floor.number >= FLOOR_COUNT) return floor;
  const doorsTouching = (id: number) => floor.doors.filter((d) => d.a === id || d.b === id);
  const x = (id: number) => id % floor.width;
  const y = (id: number) => Math.floor(id / floor.width);
  const steps = (a: number, b: number) => Math.abs(x(a) - x(b)) + Math.abs(y(a) - y(b));
  const candidates = floor.rooms.filter((r) => {
    if (!HIDEABLE.includes(r.type) || steps(r.id, floor.landing) < 3) return false;
    const touching = doorsTouching(r.id);
    return touching.length === 1 && touching[0]!.kind === 'open';
  });
  const wanted = rng.int(1, 2);
  const hidden: number[] = [];
  while (hidden.length < wanted && candidates.length > 0) {
    const pick = candidates.splice(rng.int(0, candidates.length - 1), 1)[0]!;
    if (hidden.some((h) => steps(h, pick.id) < 4)) continue;
    hidden.push(pick.id);
  }
  const clue = (): Clue => ({ text: rng.pick(cluesFor('hidden', floor.theme)), lie: false });
  return {
    ...floor,
    rooms: floor.rooms.map((r) => (hidden.includes(r.id) ? { ...r, type: 'hidden', event: null } : r)),
    doors: floor.doors.map((d) => {
      if (hidden.includes(d.b)) return { ...d, kind: 'secret', clueFromA: clue() };
      if (hidden.includes(d.a)) return { ...d, kind: 'secret', clueFromB: clue() };
      return d;
    }),
  };
}

/**
 * One Room per Floor (not the lair, which no Duo enters) holds the Twin Wardens, behind
 * Twin doors (v0): a dead end where there is one, or else a Room that is never the only
 * way to anything. It is reached without passing a Mini-boss or a Vault, and walls off
 * nothing else that was. Like hidden rooms it runs on its own RNG, last of all, so it
 * changes only that Room and its Doors: a Labyrinth made before keeps every other Room,
 * event and Clue.
 */
function twinRooms(rng: Rng, floor: Floor): Floor {
  if (floor.number >= FLOOR_COUNT) return floor;
  const x = (id: number) => id % floor.width;
  const y = (id: number) => Math.floor(id / floor.width);
  const steps = (a: number, b: number) => Math.abs(x(a) - x(b)) + Math.abs(y(a) - y(b));
  const touching = floor.rooms.map((r) => floor.doors.filter((d) => d.a === r.id || d.b === r.id));
  const open = touching.map((doors, id) => doors.filter((d) => d.kind === 'open').map((d) => (d.a === id ? d.b : d.a)));
  /** Rooms reached from the landing by open Doors, without entering any of `avoid`. */
  const reach = (avoid: ReadonlySet<number>): Set<number> => {
    const reached = new Set([floor.landing]);
    const queue = [floor.landing];
    while (queue.length > 0) {
      for (const to of open[queue.shift()!]!) {
        if (reached.has(to) || avoid.has(to)) continue;
        reached.add(to);
        queue.push(to);
      }
    }
    return reached;
  };
  const aside = new Set(floor.rooms.filter((r) => r.type === 'miniboss' || r.type === 'vault').map((r) => r.id));
  const around = reach(aside);
  const fit = floor.rooms.filter((r) => HIDEABLE.includes(r.type) && steps(r.id, floor.landing) >= 3 && around.has(r.id)
    && touching[r.id]!.every((d) => d.kind !== 'secret'));
  // A dead end is never the only way to anything; any other Room has to be shown not to be.
  const deadEnds = fit.filter((r) => touching[r.id]!.length === 1);
  const all = deadEnds.length > 0 ? 0 : reach(new Set()).size;
  const pool = deadEnds.length > 0 ? deadEnds
    : fit.filter((r) => reach(new Set([r.id])).size === all - 1 && reach(new Set([...aside, r.id])).size === around.size - 1);
  if (pool.length === 0) return floor;
  const twin = rng.pick(pool).id;
  const clue = (): Clue => ({ text: rng.pick(cluesFor('twin', floor.theme)), lie: false });
  return {
    ...floor,
    rooms: floor.rooms.map((r) => (r.id === twin ? { ...r, type: 'twin', event: null } : r)),
    doors: floor.doors.map((d) => {
      if (d.b === twin) return { ...d, kind: 'twin', clueFromA: clue() };
      if (d.a === twin) return { ...d, kind: 'twin', clueFromB: clue() };
      return d;
    }),
  };
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function gridNeighbors(id: number, width: number, height: number): number[] {
  const x = id % width;
  const y = Math.floor(id / width);
  const out: number[] = [];
  if (y > 0) out.push(id - width);
  if (y < height - 1) out.push(id + width);
  if (x > 0) out.push(id - 1);
  if (x < width - 1) out.push(id + 1);
  return out;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Breadth-first distances over the given passable edges. */
function distances(start: number, count: number, edges: Map<string, { a: number; b: number }>): number[] {
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (const { a, b } of edges.values()) {
    adj[a]!.push(b);
    adj[b]!.push(a);
  }
  const dist = new Array<number>(count).fill(Infinity);
  dist[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj[cur]!) {
      if (dist[next] === Infinity) {
        dist[next] = dist[cur]! + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

function generateFloor(rng: Rng, number: number): Floor {
  const { width, height } = floorSize(number);
  const count = width * height;
  const theme = themeOf(number);
  const isLair = number === FLOOR_COUNT;

  // 1. A perfect maze (randomized depth-first search): every Room reachable, exactly one path.
  const tree = new Map<string, { a: number; b: number }>();
  const seen = new Set<number>();
  const start = rng.int(0, count - 1);
  const stack = [start];
  seen.add(start);
  while (stack.length > 0) {
    const cur = stack[stack.length - 1]!;
    const open = gridNeighbors(cur, width, height).filter((n) => !seen.has(n));
    if (open.length === 0) {
      stack.pop();
      continue;
    }
    const next = rng.pick(open);
    tree.set(pairKey(cur, next), { a: Math.min(cur, next), b: Math.max(cur, next) });
    seen.add(next);
    stack.push(next);
  }

  // 2. Loops (many ways to the Boss), cracked walls and locks. Locks and cracks
  //    only ever sit off the maze's tree, so every Room stays reachable for everyone.
  const doors = new Map<string, { a: number; b: number; kind: DoorKind }>();
  for (const [key, edge] of tree) doors.set(key, { ...edge, kind: 'open' });
  for (let id = 0; id < count; id++) {
    for (const n of gridNeighbors(id, width, height)) {
      if (n < id) continue;
      const key = pairKey(id, n);
      if (doors.has(key)) continue;
      const roll = rng.next();
      if (roll < 0.12) doors.set(key, { a: id, b: n, kind: rng.chance(0.35) ? 'locked' : 'open' });
      else if (roll < 0.16) doors.set(key, { a: id, b: n, kind: 'cracked' });
    }
  }

  // 3. The landing sits on the edge of the grid; everything else is placed by distance from it.
  const border = Array.from({ length: count }, (_, i) => i).filter((i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    return x === 0 || y === 0 || x === width - 1 || y === height - 1;
  });
  const landing = rng.pick(border);
  const dist = distances(landing, count, tree);
  const degree = new Array<number>(count).fill(0);
  for (const d of doors.values()) {
    if (d.kind === 'cracked') continue;
    degree[d.a]!++;
    degree[d.b]!++;
  }

  const types = new Array<RoomType | null>(count).fill(null);
  types[landing] = 'landing';
  const free = () => shuffle(rng, Array.from({ length: count }, (_, i) => i).filter((i) => types[i] === null));
  const byDistance = (ids: number[]) => [...ids].sort((p, q) => dist[p]! - dist[q]!);
  const maxDist = Math.max(...dist.filter(Number.isFinite));
  const within = (id: number, lo: number, hi: number) => dist[id]! >= lo * maxDist && dist[id]! <= hi * maxDist;
  const farFrom = (id: number, placed: number[], min: number) =>
    placed.every((p) => Math.abs((p % width) - (id % width)) + Math.abs(Math.floor(p / width) - Math.floor(id / width)) >= min);

  const place = (type: RoomType, pick: number[], n: number, spread = 0) => {
    const placed: number[] = [];
    for (const id of pick) {
      if (placed.length >= n) break;
      if (types[id] !== null || !farFrom(id, placed, spread)) continue;
      types[id] = type;
      placed.push(id);
    }
    return placed;
  };

  // A Mini-boss or a Vault is never the only way through: every other Room stays reachable
  // from the landing by open Doors without entering one, so neither can bar the way down.
  const openAround = new Map<number, number[]>();
  for (const d of doors.values()) {
    if (d.kind !== 'open') continue;
    openAround.set(d.a, [...(openAround.get(d.a) ?? []), d.b]);
    openAround.set(d.b, [...(openAround.get(d.b) ?? []), d.a]);
  }
  const walls = new Set<number>();
  const cutsOff = (id: number): boolean => {
    const blocked = new Set([...walls, id]);
    const reached = new Set([landing]);
    const queue = [landing];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of openAround.get(cur) ?? []) {
        if (reached.has(next) || blocked.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    return reached.size < count - blocked.size;
  };
  const placeAside = (type: RoomType, pick: number[], n: number) => {
    const placed = place(type, pick.filter((id) => !cutsOff(id)), n);
    for (const id of placed) walls.add(id);
    return placed;
  };

  if (isLair) {
    const farthest = byDistance(free()).pop()!;
    types[farthest] = 'boss';
  } else {
    place('stairs', free().filter((id) => within(id, 0.7, 1)), rng.int(2, 4), 3);
    placeAside('miniboss', free().filter((id) => within(id, 0.6, 1)), 1);
    const deadEnds = free().filter((id) => degree[id] === 1 && within(id, 0.4, 1));
    const vaults = rng.int(1, 2);
    const placedVaults = placeAside('vault', deadEnds, vaults);
    placeAside('vault', free().filter((id) => within(id, 0.4, 1)), vaults - placedVaults.length);
  }
  place('waypoint', free().filter((id) => within(id, 0.3, 0.7)), 1);
  place('camp', free().filter((id) => dist[id]! >= 2), isLair ? 2 : 4, 3);

  // 4. Everything else: fights, quiet rooms, events and treasure (docs/design.md, v0).
  const rooms: Room[] = [];
  for (let id = 0; id < count; id++) {
    let type = types[id] ?? null;
    if (type === null) {
      const r = rng.next();
      type = r < 0.59 ? 'fight' : r < 0.77 ? 'empty' : r < 0.91 ? 'event' : 'treasure';
    }
    rooms.push({
      id,
      x: id % width,
      y: Math.floor(id / width),
      type,
      event: type === 'event' ? rng.pick(FIRST_EVENT_KINDS) : null,
      map: rng.pick(THEMES[theme].maps),
    });
  }

  // 5. Clues on both sides of every Door; about one in five lies.
  const lieTypes: RoomType[] = ['fight', 'empty', 'event', 'treasure', 'camp', 'stairs', 'miniboss'];
  const clueFor = (target: Room): Clue => {
    if (rng.chance(CLUE_LIE_CHANCE)) {
      const other = rng.pick(lieTypes.filter((t) => t !== target.type));
      return { text: rng.pick(cluesFor(other, theme)), lie: true };
    }
    return { text: rng.pick(cluesFor(target.type, theme)), lie: false };
  };
  const doorList: Door[] = [...doors.values()]
    .sort((p, q) => p.a - q.a || p.b - q.b)
    .map((d) => ({ ...d, clueFromA: clueFor(rooms[d.b]!), clueFromB: clueFor(rooms[d.a]!) }));

  return { number, theme, width, height, landing, rooms, doors: doorList };
}

/** Doors of a Room, with the Room on the other side. */
export function doorsOf(floor: Floor, roomId: number): { door: Door; to: number; clue: Clue }[] {
  const out: { door: Door; to: number; clue: Clue }[] = [];
  for (const door of floor.doors) {
    if (door.a === roomId) out.push({ door, to: door.b, clue: door.clueFromA });
    else if (door.b === roomId) out.push({ door, to: door.a, clue: door.clueFromB });
  }
  return out;
}
