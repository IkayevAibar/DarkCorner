import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Floor, type GearBase, baseById, canUse, doorsOf, generateLabyrinth, isGear } from '@dark/engine';
import { type HeroView, type LabyrinthResult, labyrinthResultSchema, myHeroResponseSchema } from '@dark/shared';
import { type Backend, bindWorld, createBackend } from '../src/backend.js';
import { prisma } from '../src/db.js';
import { memoryStorage } from '../src/storage.js';

// The local backend as the web uses it: a save in storage, requests one at a
// time, in-game days. Phase 1 is done when a new player, offline, makes a Hero,
// clears a Floor 1 Room, puts on its loot, goes home, reloads, and finds
// everything as it was (docs/plan-solo-offline.md, section 6).

/** A Labyrinth whose Floor 1 landing has a fight Room behind an ordinary Door, and Treasure further in. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const floor = generateLabyrinth(`solo-${i}`).floors[0]!;
    const nextDoor = doorsOf(floor, floor.landing).some(({ door, to }) => door.kind === 'open' && floor.rooms[to]!.type === 'fight');
    if (nextDoor && floor.rooms.filter((r) => r.type === 'treasure').length >= 2) return `solo-${i}`;
  }
})();
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const fightNextToLanding = doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')!.to;

// Every roll on the device comes from crypto.getRandomValues: made repeatable
// here, so each run plays the same game.
let state = 0x2545f491;
beforeAll(() => {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
    const bytes = new Uint8Array(array!.buffer, array!.byteOffset, array!.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      bytes[i] = state & 0xff;
    }
    return array;
  });
});
afterAll(() => {
  vi.restoreAllMocks();
});

async function call<T = unknown>(backend: Backend, method: string, url: string, body?: unknown): Promise<T> {
  const response = await backend.handle(method, url, body);
  if (response.status !== 200) throw new Error(`${method} ${url} -> ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as T;
}
const look = async (backend: Backend) => labyrinthResultSchema.parse(await call(backend, 'GET', '/api/labyrinth'));

/** Changes the save the way a test needs, as if it had happened in play; the next request saves it. */
async function arrange(backend: Backend, change: () => Promise<unknown>) {
  bindWorld(backend.world);
  await change();
}

async function newHero(backend: Backend): Promise<HeroView> {
  await call(backend, 'POST', '/api/heroes/draft');
  const { hero } = await call<{ hero: HeroView }>(backend, 'POST', '/api/heroes', {
    name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
  return hero;
}

/** Moves into a Room, and fights whatever waits there. */
async function walkIn(backend: Backend, to: number): Promise<LabyrinthResult> {
  const moved = labyrinthResultSchema.parse(await call(backend, 'POST', '/api/labyrinth/move', { to }));
  return moved.view.room?.facing ? labyrinthResultSchema.parse(await call(backend, 'POST', '/api/labyrinth/face', { action: 'fight', auto: true })) : moved;
}

/** The Rooms to walk through, over ordinary Doors. */
function path(floor: Floor, from: number, to: number): number[] {
  const prev = new Map<number, number>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const { door, to: next } of doorsOf(floor, cur)) {
      if (door.kind === 'open' && !prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(to)) return [];
  const steps: number[] = [];
  for (let cur = to; cur !== from; cur = prev.get(cur)!) steps.unshift(cur);
  return steps;
}

/** Walks a Hero kept sturdy and rested to a Room, fighting what stands in the way. */
async function walkTo(backend: Backend, to: number): Promise<LabyrinthResult[]> {
  const results: LabyrinthResult[] = [];
  for (const step of path(floor1, (await look(backend)).view.room!.id, to)) {
    await arrange(backend, () => prisma.hero.updateMany({ data: { stamina: 20, hp: 999 } }));
    results.push(await walkIn(backend, step));
  }
  return results;
}

const wearable = (hero: HeroView) => hero.bag.find((i) => {
  const base = baseById(i.base);
  return i.identified && isGear(base) && canUse('fighter', base as GearBase);
});

describe('the local backend', () => {
  it('starts a new save with its one Player and the first Chapter open', async () => {
    const storage = memoryStorage();
    const backend = await createBackend({ storage, seed: SEED });
    expect(await call(backend, 'GET', '/auth/status')).toEqual({ sso: false, loginUrl: null, logoutUrl: null, devLogin: false });
    expect(await call(backend, 'GET', '/api/me')).toMatchObject({ player: { name: 'Player', status: 'approved', isAdmin: false } });
    expect(myHeroResponseSchema.parse(await call(backend, 'GET', '/api/heroes/me'))).toMatchObject({ season: 1, hero: null, canCreate: true });
    expect(storage.text).toContain('"version":1');
  });

  it('plays the first loop offline, and a reload finds everything as it was', async () => {
    const storage = memoryStorage();
    const backend = await createBackend({ storage, seed: SEED });
    await newHero(backend);
    // Sturdy enough that no Floor 1 fight ends the test at the Temple.
    await arrange(backend, () => prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } }));

    const entered = labyrinthResultSchema.parse(await call(backend, 'POST', '/api/labyrinth/enter', { floor: 1 }));
    expect(entered.view.room).toMatchObject({ id: floor1.landing, type: 'landing' });

    // Clears the fight Room next to the landing.
    const [fought] = await walkTo(backend, fightNextToLanding);
    expect(fought!.fight?.outcome).toBe('victory');
    expect(fought!.view.room?.facing ?? null).toBeNull();

    // Then the Floor's Treasure rooms, until there is gear the Fighter can wear.
    let loot: HeroView['bag'][number] | undefined;
    for (const treasure of floor1.rooms.filter((r) => r.type === 'treasure')) {
      if (path(floor1, (await look(backend)).view.room!.id, treasure.id).length === 0) continue;
      const results = await walkTo(backend, treasure.id);
      expect(results.at(-1)!.view.room!.type).toBe('treasure');
      loot = wearable(myHeroResponseSchema.parse(await call(backend, 'GET', '/api/heroes/me')).hero!);
      if (loot) break;
    }
    expect(loot).toBeDefined();
    const { hero: dressed } = await call<{ hero: HeroView }>(backend, 'POST', `/api/items/${loot!.id}/equip`, {});
    expect(dressed.worn.some((w) => w.item.id === loot!.id)).toBe(true);

    // Home, through the landing's Waypoint.
    await walkTo(backend, floor1.landing);
    const home = labyrinthResultSchema.parse(await call(backend, 'POST', '/api/labyrinth/leave'));
    expect(home.view.location).toBe('city');
    expect(home.run).toMatchObject({ won: expect.any(Number), died: false });
    expect(home.run!.won).toBeGreaterThan(0);

    // A reload: a new backend from what was saved.
    const before = await call(backend, 'GET', '/api/heroes/me');
    const reloaded = await createBackend({ storage: memoryStorage(storage.text) });
    expect(await call(reloaded, 'GET', '/api/heroes/me')).toEqual(before);
    expect(((await call(reloaded, 'GET', '/api/heroes/me')) as { hero: HeroView }).hero.worn.some((w) => w.item.id === loot!.id)).toBe(true);
    expect((await look(reloaded)).view.location).toBe('city');
  });

  it('keeps in-game time still until the Hero sleeps; a night at the Tavern brings the next morning', async () => {
    const backend = await createBackend({ storage: memoryStorage(), seed: SEED });
    await newHero(backend);
    const morning = backend.world.clock.now;
    await call(backend, 'POST', '/api/labyrinth/enter', { floor: 1 });
    await call(backend, 'POST', '/api/labyrinth/move', { to: fightNextToLanding });
    await call(backend, 'POST', '/api/labyrinth/face', { action: 'retreat' });
    expect((await look(backend)).view.hero.stamina).toBe(19);
    // However long the player waits, the Stamina doesn't come back and the clock stands still.
    expect((await look(backend)).view.hero.stamina).toBe(19);
    expect(backend.world.clock.now).toBe(morning);

    await call(backend, 'POST', '/api/labyrinth/leave');
    const night = await call<{ stamina: number; availableAt: string | null }>(backend, 'POST', '/api/tavern/lodging');
    expect(backend.world.clock.now).toBe(morning + 86_400_000);
    expect(night).toMatchObject({ stamina: 20, availableAt: null });
    // The Omen's job, due at midnight, runs before the next request and waits for the next midnight.
    await call(backend, 'GET', '/api/heroes/me');
    bindWorld(backend.world);
    expect(await prisma.job.count({ where: { kind: 'omen', doneAt: { not: null } } })).toBe(1);
    expect(await prisma.job.count({ where: { kind: 'omen', doneAt: null } })).toBe(1);
  });

  it('forgets what a refused request wrote, and does not save it', async () => {
    const storage = memoryStorage();
    const backend = await createBackend({ storage, seed: SEED });
    await newHero(backend);
    const saved = storage.text;
    const refused = await backend.handle('POST', '/api/labyrinth/enter', { floor: 3 });
    expect(refused).toMatchObject({ status: 409, body: { error: 'no_waypoint' } });
    expect(storage.text).toBe(saved);
  });

  it('answers in the server’s error shape for routes solo does not have', async () => {
    const backend = await createBackend({ storage: memoryStorage(), seed: SEED });
    expect(await backend.handle('GET', '/api/nowhere')).toEqual({ status: 404, body: { error: 'not_found', message: 'No route for GET /api/nowhere' } });
    expect(await backend.handle('GET', '/api/push')).toMatchObject({ status: 404, body: { error: 'push_offline' } });
  });
});
