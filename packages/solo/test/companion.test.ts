import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type ClassId, type Floor, GEAR_BASES, XP_FOR_LEVEL, canUse, doorsOf, generateLabyrinth } from '@dark/engine';
import { type LabyrinthResult, type RankingsView, labyrinthResultSchema } from '@dark/shared';
import { type Backend, bindWorld, createBackend } from '../src/backend.js';
import { prisma } from '../src/db.js';
import { memoryStorage } from '../src/storage.js';
import { COMPANION_PLAYER, type CompanionView, companionFalls } from '../src/services/companion.js';

// The Companion (docs/design.md → The solo game → The Companion): a Hero of another
// Class, hired at the Tavern, played by the AI as the Hero's Duo partner. Played here
// on the local backend as the web plays it, in Days.

/** A Labyrinth whose Floor 1 has a fight Room next to the landing, an Oathstone, and Treasure with an ordinary way in. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const f = generateLabyrinth(`companion-${i}`).floors[0]!;
    const fightNext = doorsOf(f, f.landing).some(({ door, to }) => door.kind === 'open' && f.rooms[to]!.type === 'fight');
    const treasure = f.rooms.some((r) => r.type === 'treasure' && doorsOf(f, r.id).some(({ door, to }) => door.kind === 'open' && f.rooms[to]!.type === 'empty'));
    if (fightNext && treasure && f.rooms.some((r) => r.type === 'oathstone')) return `companion-${i}`;
  }
})();
const lab = generateLabyrinth(SEED);
const floor1: Floor = lab.floors[0]!;
const fightNext = doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')!.to;
const stone = floor1.rooms.find((r) => r.type === 'oathstone')!.id;
const treasure = floor1.rooms.find((r) => r.type === 'treasure' && doorsOf(floor1, r.id).some(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'empty'))!.id;
const besideTreasure = doorsOf(floor1, treasure).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'empty')!.to;
const floor10: Floor = lab.floors[9]!;
const lair = floor10.rooms.find((r) => r.type === 'boss')!.id;
const lairDoor = doorsOf(floor10, lair).find(({ door }) => door.kind === 'open')!.to;

// Every roll on the device comes from crypto.getRandomValues: repeatable here.
let state = 0x1f2e3d4c;
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
const act = async (backend: Backend, url: string, body: unknown = {}): Promise<LabyrinthResult> => labyrinthResultSchema.parse(await call(backend, 'POST', url, body));
const look = async (backend: Backend) => labyrinthResultSchema.parse(await call(backend, 'GET', '/api/labyrinth'));
const companion = (backend: Backend) => call<CompanionView>(backend, 'GET', '/api/companion');
const said = (r: { notices: { en: string }[] }) => r.notices.map((n) => n.en).join(' ');

/** Changes the save the way a test needs, as if it had happened in play; the next request saves it. */
async function arrange<T>(backend: Backend, change: () => Promise<T>): Promise<T> {
  bindWorld(backend.world);
  return change();
}
const rows = (backend: Backend) => arrange(backend, async () => ({
  hero: await prisma.hero.findFirstOrThrow({ where: { playerId: { not: COMPANION_PLAYER }, retiredAt: null }, include: { items: true } }),
  companion: await prisma.hero.findFirst({ where: { playerId: COMPANION_PLAYER, retiredAt: null }, include: { items: true } }),
}));

/** A new save with a Fighter, Garrick, in the City: `level` and `gold` as the test needs. */
async function start(level = 1, gold = 100): Promise<Backend> {
  const backend = await createBackend({ storage: memoryStorage(), seed: SEED });
  await call(backend, 'POST', '/api/heroes/draft');
  await call(backend, 'POST', '/api/heroes', {
    name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
  await arrange(backend, () => prisma.hero.updateMany({ data: { level, xp: XP_FOR_LEVEL[level]!, gold } }));
  return backend;
}

/** Garrick with a Companion, hired from the first offer. */
async function withCompanion(level = 1, gold = 1000): Promise<{ backend: Backend; view: CompanionView }> {
  const backend = await start(level, gold);
  return { backend, view: await call<CompanionView>(backend, 'POST', '/api/companion/hire', { offer: 0 }) };
}

/** Both Heroes moved to a Room of a Floor, as if they had walked there, sturdy and rested. */
const placeBoth = (backend: Backend, floor: number, room: number) =>
  arrange(backend, () => prisma.hero.updateMany({
    where: { retiredAt: null },
    data: { location: 'LABYRINTH', floor, room, prevRoom: room, facing: false, maxHp: 999, hp: 999, stamina: 20, waypoints: [floor] },
  }));

const loyaltyOf = async (backend: Backend) => (await companion(backend)).companion?.loyalty;

describe('the Companion', () => {
  it('is hired at the Tavern: another Class at its Hero’s level, its Path chosen, for a wage each morning', async () => {
    const backend = await start(7, 1000);
    const before = await companion(backend);
    expect(before.companion).toBeNull();
    expect(before.offers).toHaveLength(3);
    expect(before.offers.map((o) => o.class)).not.toContain('fighter');
    expect(new Set(before.offers.map((o) => o.class)).size).toBe(3);
    expect(before.offers[0]).toMatchObject({ level: 7, wage: 140 });
    // The same three all Day.
    expect((await companion(backend)).offers).toEqual(before.offers);

    const hired = await call<CompanionView>(backend, 'POST', '/api/companion/hire', { offer: 1 });
    expect(hired.companion).toMatchObject({
      name: before.offers[1]!.name, class: before.offers[1]!.class, level: 7, loyalty: 5, loyaltyMax: 10, wage: 140, backAt: null, waiting: false,
    });
    expect(hired.companion!.gear.length).toBeGreaterThan(0);
    expect(hired.gold).toBe(1000 - 140);
    expect(hired.offers).toEqual([]);
    expect(said(hired)).toContain('joins you, for 140 gold each morning');

    const { hero, companion: row } = await rows(backend);
    expect(row).toMatchObject({ level: 7, partnerId: hero.id, location: 'CITY' });
    expect(hero.partnerId).toBe(row!.id);
    expect(row!.path).not.toBeNull();
    expect(row!.growths).toHaveLength(1);
    // A second one can't be hired, and the Companion keeps out of the Records.
    expect((await backend.handle('POST', '/api/companion/hire', { offer: 0 })).body).toMatchObject({ error: 'companion_hired' });
    expect(JSON.stringify(await call<RankingsView>(backend, 'GET', '/api/tavern/rankings'))).not.toContain(row!.name);
  });

  it('walks beside its Hero, pays no Stamina, and is played by the AI in every fight', async () => {
    const { backend, view } = await withCompanion();
    const entered = await act(backend, '/api/labyrinth/enter', { floor: 1 });
    expect(entered.view.duo).toMatchObject({ name: view.companion!.name, online: true });
    await arrange(backend, () => prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } }));

    const moved = await act(backend, '/api/labyrinth/move', { to: fightNext });
    expect(moved.view.room!.facing).not.toBeNull();
    let { hero, companion: row } = await rows(backend);
    expect(row).toMatchObject({ room: fightNext, stamina: 20 });
    expect(hero.stamina).toBe(19);

    // Played by hand, the Player is asked only for its own Hero's turns.
    const opened = await act(backend, '/api/labyrinth/face', { action: 'fight', auto: false });
    const fight = await arrange(backend, () => prisma.fight.findFirst());
    if (fight) {
      expect(fight.manual).toEqual(['hero']);
      expect(fight.partnerId).toBe(row!.id);
      expect(opened.view.fight!.turn.hero).toBe('hero');
    }
    const done = opened.view.fight ? await act(backend, '/api/labyrinth/fight', { action: { kind: 'auto' } }) : opened;
    expect(done.view.fight).toBeNull();
    ({ hero, companion: row } = await rows(backend));
    // Its level is its Hero's, and it finds nothing of its own.
    expect(row).toMatchObject({ xp: 0, carriedGold: 0, level: 1 });
    expect(row!.items.filter((i) => i.place === 'BAG').map((i) => i.base)).toEqual(['potion']);
  });

  it('breaks away from a fight with its Hero: the Duo retreats together', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await arrange(backend, () => prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, dex: 20 } }));
    await act(backend, '/api/labyrinth/move', { to: fightNext });
    let r = await act(backend, '/api/labyrinth/face', { action: 'fight', auto: false });
    expect(r.view.fight!.turn.actions).toContain('escape');
    // The Hero rolls to get away until it does; the Companion comes out on that roll.
    for (let i = 0; i < 40 && r.view.fight; i++) r = await act(backend, '/api/labyrinth/fight', { action: { kind: 'escape' } });
    expect(r.fight!.outcome).toBe('escaped');
    expect(said(r)).toContain('You break away');
    const { hero, companion: row } = await rows(backend);
    expect(hero.room).toBe(floor1.landing);
    expect(row).toMatchObject({ room: floor1.landing, partnerId: hero.id });
    expect(r.view.duo).not.toBeNull();
  });

  it('swears at an Oathstone by its loyalty, which the Player’s own oath moves', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await placeBoth(backend, 1, stone);
    const gifts = async () => (await rows(backend)).hero.items.filter((i) => i.place === 'BAG' && i.quantity === 1 && i.base !== 'potion').length;
    const before = await gifts();

    const shared = await act(backend, '/api/labyrinth/oath', { choice: 'share' });
    expect(shared.oath).toEqual({ mine: 'share', partner: 'share' });
    expect(said(shared)).toContain('Loyalty: 6 of 10');
    expect(await gifts()).toBe(before + 1);

    // Below 5, it takes; the Player sharing still earns 1.
    const again = (loyalty: number) => arrange(backend, async () => {
      await prisma.heroFloor.updateMany({ data: { cleared: {} } });
      const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'companion' } });
      await prisma.setting.update({ where: { key: 'companion' }, data: { value: { ...(row.value as object), loyalty } } });
    });
    await again(4);
    const robbed = await act(backend, '/api/labyrinth/oath', { choice: 'share' });
    expect(robbed.oath).toEqual({ mine: 'share', partner: 'take' });
    expect(said(robbed)).toContain('Loyalty: 5 of 10');

    // Taking from a loyal Companion costs 2.
    await again(5);
    const greedy = await act(backend, '/api/labyrinth/oath', { choice: 'take' });
    expect(greedy.oath).toEqual({ mine: 'take', partner: 'share' });
    expect(said(greedy)).toContain('Loyalty: 3 of 10');
  });

  it('takes its turns at a Duo Chest at once, and minds a Player who takes it all', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await placeBoth(backend, 1, besideTreasure);

    let r = await act(backend, '/api/labyrinth/move', { to: treasure });
    expect(r.view.chest).not.toBeNull();
    expect(r.view.chest!.turn).toBe('me');
    while (r.view.chest) r = await act(backend, '/api/labyrinth/chest', { index: r.view.chest.items.findIndex((i) => i.takenBy === null) });
    expect(r.closedChest!.items.some((i) => i.takenBy === 'partner')).toBe(true);
    expect(said(r)).toContain('Loyalty: 6 of 10');
    const bag = (await rows(backend)).hero.items.length;

    // The Treasure again, as on another Day: this time the Player takes everything.
    await arrange(backend, () => prisma.heroFloor.updateMany({ data: { cleared: {} } }));
    await act(backend, '/api/labyrinth/move', { to: besideTreasure });
    r = await act(backend, '/api/labyrinth/move', { to: treasure });
    const left = r.view.chest!.items.filter((i) => i.takenBy === null).length;
    const all = await act(backend, '/api/labyrinth/chest/all');
    expect(all.view.chest).toBeNull();
    expect(all.closedChest!.items.filter((i) => i.takenBy === 'me').length).toBeGreaterThanOrEqual(left);
    expect(said(all)).toContain('Loyalty: 4 of 10');
    // Everything left came to the Hero, beside what the Treasure itself gave it.
    expect((await rows(backend)).hero.items.length).toBe(bag + r.loot.length + left);
  });

  it('leaves for good at no loyalty, giving back what it wears', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await placeBoth(backend, 1, stone);
    await arrange(backend, async () => {
      const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'companion' } });
      await prisma.setting.update({ where: { key: 'companion' }, data: { value: { ...(row.value as object), loyalty: 2 } } });
    });
    const worn = (await rows(backend)).companion!.items.filter((i) => i.place === 'WORN').map((i) => i.id);
    const gone = await act(backend, '/api/labyrinth/oath', { choice: 'take' });
    expect(said(gone)).toContain('has had enough of your greed');
    expect(gone.view.duo).toBeNull();
    const { hero, companion: row } = await rows(backend);
    expect(row).toBeNull();
    expect(hero.items.filter((i) => worn.includes(i.id)).map((i) => i.place)).toEqual(worn.map(() => 'BAG'));
  });

  it('falls, and is back at its Hero’s side the next morning; in Iron mode it is gone, its gear in its Grave', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    const fall = () => arrange(backend, async () => {
      const c = await prisma.hero.findFirstOrThrow({ where: { playerId: COMPANION_PLAYER, retiredAt: null }, include: { items: true } });
      const season = await prisma.season.findFirstOrThrow();
      const out = { notices: [] as { en: string; ru: string }[] };
      await prisma.$transaction((tx) => companionFalls(tx, c, season, 1, floor1.landing, out));
      return out;
    });
    expect(said(await fall())).toContain('Tomorrow morning your Companion is at your side again');
    expect((await look(backend)).view.duo).toBeNull();
    expect((await companion(backend)).companion!.backAt).not.toBeNull();

    const woken = await act(backend, '/api/labyrinth/sleep');
    expect(said(woken)).toContain('is back on its feet');
    expect(said(woken)).toContain('takes this morning\'s wage');
    expect(woken.view.duo).not.toBeNull();
    const { companion: row } = await rows(backend);
    expect(row).toMatchObject({ location: 'LABYRINTH', room: floor1.landing });

    // In Iron mode: gone for good, and what it wore lies in its Grave.
    backend.world.settings.iron = true;
    const worn = row!.items.filter((i) => i.place === 'WORN').length;
    expect(said(await fall())).toContain('in Iron mode that is the end');
    const grave = await arrange(backend, () => prisma.grave.findFirstOrThrow({ include: { items: true } }));
    expect(grave.items).toHaveLength(worn);
    expect((await companion(backend)).companion).toBeNull();
  });

  it('goes home through a Town Portal with its Hero, and steps back through with it', async () => {
    const { backend } = await withCompanion();
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await arrange(backend, async () => {
      const { hero } = await rows(backend);
      await prisma.item.create({ data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base: 'scroll-portal', tier: 'common', quantity: 1 } });
    });
    await placeBoth(backend, 1, besideTreasure);
    const home = await act(backend, '/api/labyrinth/portal');
    expect(home.view.location).toBe('city');
    expect(home.view.duo).not.toBeNull();
    const back = await act(backend, '/api/labyrinth/enter', { floor: 1, portal: true });
    expect(back.view.room!.id).toBe(besideTreasure);
    expect(back.view.duo).not.toBeNull();
    expect((await rows(backend)).companion).toMatchObject({ location: 'LABYRINTH', room: besideTreasure });
  });

  it('waits at the door of the Dragon’s lair, and rejoins its Hero there', async () => {
    const { backend } = await withCompanion(15, 5000);
    await arrange(backend, () => prisma.season.updateMany({ data: { bossGateAt: new Date(0) } }));
    await act(backend, '/api/labyrinth/enter', { floor: 1 });
    await placeBoth(backend, 10, lairDoor);
    const inside = await act(backend, '/api/labyrinth/move', { to: lair });
    expect(said(inside)).toContain('waits at the lair\'s door');
    expect(inside.view.duo).toBeNull();
    expect((await companion(backend)).companion!.waiting).toBe(true);
    expect((await rows(backend)).companion).toMatchObject({ room: lairDoor, partnerId: null });

    const out = await act(backend, '/api/labyrinth/face', { action: 'retreat' });
    expect(out.view.room!.id).toBe(lairDoor);
    expect((await look(backend)).view.duo).not.toBeNull();
    expect((await companion(backend)).companion!.waiting).toBe(false);
  });

  it('wears what the Player gives it, and gives it back on asking', async () => {
    const { backend, view } = await withCompanion();
    const cls = view.companion!.class as ClassId;
    const weapon = GEAR_BASES.find((b) => b.slot === 'main' && b.hands !== 2 && canUse(cls, b))!;
    const made = await arrange(backend, async () => {
      const { hero } = await rows(backend);
      return prisma.item.create({
        data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base: weapon.id, tier: 'rare', itemLevel: 3, quality: 80, identified: true },
      });
    });
    const before = (await rows(backend)).companion!.items.find((i) => i.place === 'WORN' && i.slot === 'main');

    const given = await call<CompanionView>(backend, 'POST', '/api/companion/give', { itemId: made.id });
    expect(given.companion!.gear.map((i) => i.id)).toContain(made.id);
    const { hero } = await rows(backend);
    if (before) expect(hero.items.find((i) => i.id === before.id)).toMatchObject({ place: 'BAG' });

    const taken = await call<CompanionView>(backend, 'POST', '/api/companion/take', { itemId: made.id });
    expect(taken.companion!.gear.map((i) => i.id)).not.toContain(made.id);
    expect((await rows(backend)).hero.items.find((i) => i.id === made.id)).toMatchObject({ place: 'BAG' });
  });

  it('takes its wage each morning, and leaves on one the Hero can’t pay; dismissed, it gives back its gear', async () => {
    const { backend } = await withCompanion(1, 100);
    await call(backend, 'POST', '/api/tavern/lodging');
    const paid = await companion(backend);
    expect(said(paid)).toContain('takes this morning\'s wage: 20 gold');
    expect(paid.gold).toBe(100 - 20 - 20);

    const worn = (await rows(backend)).companion!.items.filter((i) => i.place === 'WORN').map((i) => i.id);
    await arrange(backend, () => prisma.hero.updateMany({ where: { playerId: { not: COMPANION_PLAYER } }, data: { gold: 5, carriedGold: 0 } }));
    await call(backend, 'POST', '/api/tavern/lodging');
    const unpaid = await companion(backend);
    expect(said(unpaid)).toContain('can\'t pay');
    expect(unpaid.companion).toBeNull();
    expect(unpaid.offers).toHaveLength(3);
    expect((await rows(backend)).hero.items.filter((i) => worn.includes(i.id))).toHaveLength(worn.length);

    await arrange(backend, () => prisma.hero.updateMany({ where: { playerId: { not: COMPANION_PLAYER } }, data: { gold: 100 } }));
    await call(backend, 'POST', '/api/companion/hire', { offer: 0 });
    const dismissed = await call<CompanionView>(backend, 'POST', '/api/companion/dismiss');
    expect(dismissed.companion).toBeNull();
    expect(said(dismissed)).toContain('leaves your service');
    expect((await look(backend)).view.duo).toBeNull();
  });

  it('leaves with its Hero’s Retire, what it wore going to Storage for the next Hero', async () => {
    const { backend } = await withCompanion();
    const worn = (await rows(backend)).companion!.items.filter((i) => i.place === 'WORN').map((i) => i.id);
    await call(backend, 'POST', '/api/heroes/retire');
    await arrange(backend, async () => {
      for (const id of worn) expect(await prisma.item.findUnique({ where: { id } })).toMatchObject({ place: 'STORAGE' });
      expect(await prisma.setting.findUnique({ where: { key: 'companion' } })).toBeNull();
    });
  });
});
