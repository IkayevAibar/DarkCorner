import { beforeEach, describe, expect, it } from 'vitest';
import { bindWorld } from '../src/backend.js';
import { DbNull, PrismaClientKnownRequestError, memdb, prisma } from '../src/db.js';
import { emptyWorld, parseWorld, serializeWorld } from '../src/world.js';

// The in-memory database behaves like Prisma on Postgres where the services can tell.

beforeEach(() => {
  bindWorld(emptyWorld({ clock: 'real' }));
});

async function seed() {
  const player = await prisma.player.create({ data: { discordId: 'p1', username: 'Ann' } });
  const season = await prisma.season.create({ data: { number: 1, seed: 's' } });
  const hero = await prisma.hero.create({
    data: {
      playerId: player.id, seasonId: season.id, name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert'], portrait: 'p', banner: '#fff',
      str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10, maxHp: 12, hp: 12, stamina: 20,
    },
  });
  return { player, season, hero };
}

describe('the in-memory database', () => {
  it('fills in defaults, ids and timestamps the way the schema says', async () => {
    const { hero, player } = await seed();
    expect(hero).toMatchObject({ level: 1, xp: 0, gold: 0, location: 'CITY', stance: 'steady', waypoints: [], growths: [], deedCounts: {}, run: null, floor: null });
    expect(hero.id).toMatch(/^c[0-9a-z]{20,}$/);
    expect(hero.createdAt).toBeInstanceOf(Date);
    expect(player.steps).toEqual({});
    const log = await prisma.rollLog.create({ data: { kind: 'x', seed: 's', detail: {} } });
    const log2 = await prisma.rollLog.create({ data: { kind: 'x', seed: 's', detail: {} } });
    expect([log.id, log2.id]).toEqual([1n, 2n]);
  });

  it('hands out copies, so changing one never changes the table', async () => {
    const { hero } = await seed();
    hero.gold = 999;
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold).toBe(0);
  });

  it('applies increments, pushes and sets, and refuses a missing row', async () => {
    const { hero } = await seed();
    const after = await prisma.hero.update({
      where: { id: hero.id },
      data: { gold: { increment: 50 }, hp: { decrement: 2 }, talents: { push: 'tough' }, waypoints: { set: [1, 2] }, run: { gold: 3 } },
    });
    expect(after).toMatchObject({ gold: 50, hp: 10, talents: ['alert', 'tough'], waypoints: [1, 2], run: { gold: 3 } });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(hero.updatedAt.getTime());
    expect((await prisma.hero.update({ where: { id: hero.id }, data: { run: DbNull } })).run).toBeNull();
    await expect(prisma.hero.update({ where: { id: 'nope' }, data: { gold: 1 } })).rejects.toMatchObject({ code: 'P2025' });
  });

  it('filters like SQL: NULL never matches not, in or comparisons', async () => {
    const { hero, season } = await seed();
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common', quantity: 2 } });
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'WORN', slot: 'main', base: 'longsword', tier: 'common' } });
    await prisma.item.create({ data: { seasonId: season.id, heroId: null, place: 'GRAVE', base: 'dagger', tier: 'rare' } });
    expect(await prisma.item.count({ where: { slot: { not: 'main' } } })).toBe(0);
    expect(await prisma.item.count({ where: { slot: { not: null } } })).toBe(1);
    expect(await prisma.item.count({ where: { heroId: hero.id, place: { in: ['BAG', 'WORN'] } } })).toBe(2);
    expect(await prisma.item.count({ where: { OR: [{ tier: 'rare' }, { quantity: { gt: 1 } }] } })).toBe(2);
    expect(await prisma.item.count({ where: { NOT: { place: 'GRAVE' } } })).toBe(2);
    expect(await prisma.item.count({ where: { hero: { name: 'Garrick' } } })).toBe(2);
    expect(await prisma.hero.count({ where: { items: { some: { base: 'longsword' } } } })).toBe(1);
    expect(await prisma.hero.count({ where: { talents: { has: 'alert' } } })).toBe(1);
  });

  it('includes and selects relations, both ways', async () => {
    const { hero, season, player } = await seed();
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common' } });
    const withItems = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id }, include: { items: true, player: true } });
    expect(withItems.items).toHaveLength(1);
    expect(withItems.player.username).toBe('Ann');
    const picked = await prisma.player.findUniqueOrThrow({ where: { id: player.id }, select: { username: true, heroes: { select: { name: true } } } });
    expect(picked).toEqual({ username: 'Ann', heroes: [{ name: 'Garrick' }] });
  });

  it('finds by compound unique keys, and lets NULLs in them repeat', async () => {
    const { hero, season } = await seed();
    await prisma.heroFloor.create({ data: { heroId: hero.id, floor: 1 } });
    expect(await prisma.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: 1 } } })).not.toBeNull();
    await expect(prisma.heroFloor.create({ data: { heroId: hero.id, floor: 1 } })).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
    // Two Bag Items: heroId_slot is unique, but a NULL slot never clashes.
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common' } });
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common' } });
    await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'WORN', slot: 'main', base: 'dagger', tier: 'common' } });
    await expect(prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'WORN', slot: 'main', base: 'dagger', tier: 'common' } }))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  it('sorts with NULLs last going up and first going down, ties in the order made', async () => {
    const { hero } = await seed();
    for (const [name, floor] of [['a', 3], ['b', null], ['c', 3], ['d', 1]] as const) {
      await prisma.grave.create({ data: { seasonId: hero.seasonId, floor: floor ?? 0, room: 0, ownerName: name, heroId: floor === null ? null : hero.id, expiresAt: new Date() } });
    }
    const up = await prisma.grave.findMany({ orderBy: [{ heroId: 'asc' }, { floor: 'desc' }] });
    expect(up.map((g) => g.ownerName)).toEqual(['a', 'c', 'd', 'b']);
    const down = await prisma.grave.findMany({ orderBy: { heroId: 'desc' } });
    expect(down[0]!.ownerName).toBe('b');
  });

  it('undoes a transaction that throws', async () => {
    const { hero } = await seed();
    await expect(prisma.$transaction(async (tx) => {
      await tx.hero.update({ where: { id: hero.id }, data: { gold: 500 } });
      throw new Error('nope');
    })).rejects.toThrow('nope');
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold).toBe(0);
  });

  it('cascades and nulls on delete as the relations say', async () => {
    const { hero, season, player } = await seed();
    await prisma.heroFloor.create({ data: { heroId: hero.id, floor: 1 } });
    const item = await prisma.item.create({ data: { seasonId: season.id, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common' } });
    await prisma.hero.delete({ where: { id: hero.id } });
    expect(await prisma.heroFloor.count()).toBe(0);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).heroId).toBeNull();
    await prisma.player.delete({ where: { id: player.id } });
    expect(await prisma.player.count()).toBe(0);
  });

  it('treats row locks as nothing and other raw SQL as a mistake', async () => {
    await expect(prisma.$queryRaw`SELECT id FROM "Hero" WHERE id = ${'x'} FOR UPDATE`).resolves.toEqual([]);
    await expect(prisma.$executeRaw`UPDATE "Job" SET "doneAt" = now()`).rejects.toThrow('not available offline');
  });

  it('stores Json as JSON, and a save round-trips with its Dates and BigInts', async () => {
    const { hero } = await seed();
    const at = new Date('2026-10-10T08:00:00Z');
    await prisma.hero.update({ where: { id: hero.id }, data: { deeds: { first: at } as never, hpAt: at } });
    const read = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });
    expect(read.deeds).toEqual({ first: '2026-10-10T08:00:00.000Z' });
    await prisma.rollLog.create({ data: { kind: 'x', seed: 's', detail: { n: 1 } } });

    const world = parseWorld(serializeWorld({ ...emptyWorld({ clock: 'real' }), db: memdb.state }));
    bindWorld(world);
    const again = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });
    expect(again.hpAt).toEqual(at);
    expect((await prisma.rollLog.findFirstOrThrow()).id).toBe(1n);
    expect((await prisma.rollLog.create({ data: { kind: 'x', seed: 's', detail: {} } })).id).toBe(2n);
  });
});
