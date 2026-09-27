import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, RELICS, doorsOf, generateLabyrinth } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { emptyOutcome } from '../src/services/fights.js';
import { lockHero } from '../src/services/ledger.js';
import { boostedXp } from '../src/services/progression.js';
import { grantRelic } from '../src/services/relics.js';
import { runDueJobs } from '../src/services/scheduler.js';
import { devLogin, resetDatabase } from './helpers.js';

const SEED = 'season-test';
const lab = generateLabyrinth(SEED);

/** A Room of this type with a plain Door into it, and the Room on the other side. */
function roomOfType(type: 'boss' | 'vault', floorNumber?: number) {
  for (const floor of lab.floors) {
    if (floorNumber && floor.number !== floorNumber) continue;
    for (const room of floor.rooms) {
      if (room.type !== type) continue;
      const door = doorsOf(floor, room.id).find((d) => d.door.kind === 'open');
      if (door) return { floor: floor.number, room: room.id, from: door.to };
    }
  }
  throw new Error(`no ${type}`);
}

let app: FastifyInstance;
let admin: string;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

async function makeHero(name: string, asAdmin = false) {
  const cookie = await devLogin(app, name, asAdmin);
  if (!asAdmin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const r = await post(cookie, '/api/heroes', { name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
  if (r.statusCode !== 200) throw new Error(r.body);
  const hero = await prisma.hero.findFirstOrThrow({ where: { name } });
  if (asAdmin) admin = cookie;
  return { cookie, hero };
}

/** A Hero that can't lose to the Dragon, standing next to a Room. */
const champion = (heroId: string, floor: number, room: number) => prisma.hero.update({
  where: { id: heroId },
  data: { location: 'LABYRINTH', floor, room, prevRoom: room, level: 20, str: 30, maxHp: 99_999, hp: 99_999, stamina: 20, staminaAt: new Date() },
});

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  await prisma.job.deleteMany();
  await prisma.season.create({ data: { number: 0, seed: SEED } });
  await makeHero('Admira', true);
});

describe('the Season', () => {
  it('starts, schedules its jobs, and refuses to start twice', async () => {
    const r = await post(admin, '/api/admin/season', { action: 'start' });
    expect(r.statusCode).toBe(200);
    const view = r.json();
    expect(view.season.status).toBe('active');
    expect(new Date(view.season.bossGateAt).getTime() - new Date(view.season.startsAt).getTime()).toBe(14 * DAY_MS);
    const kinds = (await prisma.job.findMany()).map((j) => j.kind).sort();
    expect(kinds).toEqual(['boss-gate', 'broadcast', 'vault-plan', 'weaken', 'weaken', 'weaken', 'weaken']);
    expect((await prisma.job.findFirstOrThrow({ where: { kind: 'broadcast' } })).doneAt).not.toBeNull();
    expect((await post(admin, '/api/admin/season', { action: 'start' })).json().error).toBe('season_running');
  });

  it('keeps the Labyrinth shut until it starts, and admin tools from other Players', async () => {
    const { cookie } = await makeHero('Early');
    expect((await post(cookie, '/api/labyrinth/enter', { floor: 1 })).json().error).toBe('season_not_started');
    expect((await get(cookie, '/api/admin/season')).statusCode).toBe(403);
  });

  it('opens the Boss gate on demand and says so in the Feed', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const season = await prisma.season.findFirstOrThrow();
    expect(season.bossGateAt!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await prisma.feedEvent.count({ where: { kind: 'gate-open' } })).toBe(1);
    const tavern = (await get(admin, '/api/tavern')).json();
    expect(tavern.entries[0].text.en).toBe('The Boss gate is open');
    expect(tavern.online.map((o: { name: string }) => o.name)).toContain('Admira');
  });

  it('crowns a Champion, starts the Finale, fills the podium, and wipes', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const boss = roomOfType('boss');
    const first = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await champion(first.id, boss.floor, boss.from);
    const won = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/move', { to: boss.room })).json());
    expect(won.fight?.outcome).toBe('victory');
    expect(won.loot.length).toBeGreaterThanOrEqual(3);

    let season = await prisma.season.findFirstOrThrow();
    expect(season.status).toBe('FINALE');
    expect(await prisma.job.count({ where: { kind: 'wipe', doneAt: null } })).toBe(1);

    // Coming back the same day: a quiet lair, no second podium place.
    await champion(first.id, boss.floor, boss.from);
    const again = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/move', { to: boss.room })).json());
    expect(again.fight).toBeNull();

    const { cookie, hero } = await makeHero('Second');
    await champion(hero.id, boss.floor, boss.from);
    await post(cookie, '/api/labyrinth/move', { to: boss.room });
    const podium = (await get(cookie, '/api/tavern')).json().season.podium;
    expect(podium.map((p: { hero: string; place: number }) => [p.place, p.hero])).toEqual([[1, 'Admira'], [2, 'Second']]);

    await post(admin, '/api/admin/season', { action: 'end' });
    season = await prisma.season.findFirstOrThrow({ where: { number: 0 } });
    expect(season.status).toBe('ENDED');
    const hall = (await get(admin, '/api/hall')).json().entries;
    // A best-drop entry comes too if the Dragon's hoard held a Legendary.
    expect(hall.map((e: { kind: string }) => e.kind).filter((k: string) => k !== 'best-drop').sort()).toEqual(['champion', 'deepest', 'highest-level', 'second']);
    // The next Season begins empty: nobody has a Hero in it.
    const me = (await get(admin, '/api/heroes/me')).json();
    expect(me).toMatchObject({ season: 1, hero: null, canCreate: true });
    expect(await prisma.job.count({ where: { doneAt: null, kind: { not: 'broadcast' } } })).toBe(0);
  });
});

describe('the Wipe', () => {
  it('records the best drop of the Season', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const season = await prisma.season.findFirstOrThrow();
    const player = await prisma.player.findFirstOrThrow({ where: { username: 'Admira' } });
    await prisma.feedEvent.createMany({
      data: [
        { seasonId: season.id, playerId: player.id, kind: 'drop', data: { hero: 'Admira', tier: 'legendary', base: 'helm' } },
        { seasonId: season.id, playerId: player.id, kind: 'chest', data: { hero: 'Admira', tier: 'mythic', base: 'ring', grade: 'gold' } },
      ],
    });
    await post(admin, '/api/admin/season', { action: 'end' });
    const best = (await get(admin, '/api/hall')).json().entries.find((e: { kind: string }) => e.kind === 'best-drop');
    expect(best).toMatchObject({ hero: 'Admira', detail: { en: 'Mythic ring' } });
  });
});

describe('a test Season', () => {
  it('can be discarded without a trace in the Hall of Fame, freeing its number', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await prisma.hallEntry.create({ data: { seasonNumber: 0, kind: 'relic', playerName: 'A', heroName: 'B' } });
    const r = await post(admin, '/api/admin/season', { action: 'discard' });
    expect(r.statusCode).toBe(200);
    expect(r.json().season).toMatchObject({ number: 0, status: 'planned' });
    expect(await prisma.hallEntry.count()).toBe(0);
    expect((await prisma.season.findMany({ orderBy: { number: 'asc' } })).map((s) => [s.number, s.status])).toEqual([[-1, 'ENDED'], [0, 'PLANNED']]);
    expect(await prisma.job.count({ where: { doneAt: null, kind: { not: 'broadcast' } } })).toBe(0);
  });
});

describe('Vaults and Relics', () => {
  it('lets the first Hero in empty a Vault, and seals an announced one until it opens', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const vault = roomOfType('vault', 1);
    const first = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await champion(first.id, vault.floor, vault.from);
    const opened = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/move', { to: vault.room })).json());
    expect(opened.loot.length).toBeGreaterThanOrEqual(4);
    expect(opened.view.room?.vault?.state).toBe('claimed');

    const { cookie, hero } = await makeHero('Late');
    await champion(hero.id, vault.floor, vault.from);
    const empty = labyrinthResultSchema.parse((await post(cookie, '/api/labyrinth/move', { to: vault.room })).json());
    expect(empty.loot).toHaveLength(0);

    // An announcement reseals it for later.
    await prisma.vaultOpening.create({
      data: { seasonId: (await prisma.season.findFirstOrThrow()).id, floor: vault.floor, room: vault.room, opensAt: new Date(Date.now() + 3_600_000) },
    });
    await champion(hero.id, vault.floor, vault.from);
    const sealed = labyrinthResultSchema.parse((await post(cookie, '/api/labyrinth/move', { to: vault.room })).json());
    expect(sealed.view.room?.vault).toMatchObject({ state: 'sealed' });
    // Time passes: the first claim is old news when the seals break.
    await prisma.specialClaim.updateMany({ data: { claimedAt: new Date(Date.now() - 2 * 3_600_000) } });
    await prisma.vaultOpening.updateMany({ data: { opensAt: new Date(Date.now() - 1000) } });
    await champion(hero.id, vault.floor, vault.from);
    const refilled = labyrinthResultSchema.parse((await post(cookie, '/api/labyrinth/move', { to: vault.room })).json());
    expect(refilled.loot.length).toBeGreaterThanOrEqual(4);
    expect((await prisma.vaultOpening.findFirstOrThrow()).claimedAt).not.toBeNull();
  });

  it('numbers Relic copies and stops when every copy is out', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const season = await prisma.season.findFirstOrThrow();
    const player = await prisma.player.findFirstOrThrow({ where: { username: 'Admira' } });
    const copies = RELICS.reduce((s, r) => s + (r.copies ?? 1), 0);
    for (let i = 0; i <= copies; i++) {
      const got = await prisma.$transaction(async (tx) => grantRelic(tx, await lockHero(tx, player, season.id), season, 8, 'test', emptyOutcome()));
      expect(got).toBe(i < copies);
    }
    const finds = await prisma.relicFind.findMany();
    for (const relic of RELICS) {
      expect(finds.filter((f) => f.uniqueId === relic.id).map((f) => f.serial).sort()).toEqual(Array.from({ length: relic.copies ?? 1 }, (_, i) => i + 1));
    }
    const items = await prisma.item.findMany({ where: { tier: 'relic' } });
    expect(items.every((i) => i.identified && Array.isArray(i.owners))).toBe(true);
    expect(await prisma.hallEntry.count({ where: { kind: 'relic' } })).toBe(copies);
    expect((await get(admin, '/api/tavern')).json().season.relicsLeft).toBe(0);
  });

  it('announces Vaults only on Floors Heroes have reached', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    expect((await post(admin, '/api/admin/season', { action: 'vault', minutes: 30 })).json().error).toBe('no_vault_floor');
    await prisma.hero.updateMany({ data: { bestFloor: 3 } });
    expect((await post(admin, '/api/admin/season', { action: 'vault', minutes: 30 })).statusCode).toBe(200);
    const opening = await prisma.vaultOpening.findFirstOrThrow();
    expect(opening.floor).toBeLessThanOrEqual(3);
    expect(lab.floors[opening.floor - 1]!.rooms[opening.room]!.type).toBe('vault');
  });
});

describe('late joiners and admin tools', () => {
  it('give Heroes who start two weeks late an Uncommon kit and more XP', async () => {
    await prisma.season.updateMany({ data: { status: 'ACTIVE', startsAt: new Date(Date.now() - 15 * DAY_MS) } });
    const { hero } = await makeHero('Tardy');
    const kit = await prisma.item.findMany({ where: { heroId: hero.id, place: 'WORN' } });
    expect(kit.every((i) => i.tier === 'uncommon')).toBe(true);
    const early = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    const kitEarly = await prisma.item.findMany({ where: { heroId: early.id, place: 'WORN' } });
    expect(kitEarly.every((i) => i.tier === 'common')).toBe(true);

    // Two full weeks late: +50% XP, until the Season's median level.
    const season = await prisma.season.findFirstOrThrow();
    await prisma.hero.update({ where: { id: early.id }, data: { level: 9 } });
    expect(await boostedXp(prisma, await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } }), season, 100)).toBe(150);
    expect(await boostedXp(prisma, await prisma.hero.findUniqueOrThrow({ where: { id: early.id } }), season, 100)).toBe(100);
    await prisma.hero.update({ where: { id: hero.id }, data: { level: 9 } });
    expect(await boostedXp(prisma, await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } }), season, 100)).toBe(100);
  });

  it('grants gold and Items, and reads the roll log', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const player = await prisma.player.findFirstOrThrow({ where: { username: 'Admira' } });
    const r = await post(admin, '/api/admin/grant', { playerId: player.id, gold: 500, item: { base: 'key-silver', quantity: 3 } });
    expect(r.statusCode).toBe(200);
    await post(admin, '/api/admin/grant', { playerId: player.id, item: { base: 'ring', tier: 'epic', identified: false } });
    const hero = await prisma.hero.findFirstOrThrow({ where: { playerId: player.id }, include: { items: true } });
    expect(hero.gold).toBe(600);
    expect(hero.items.find((i) => i.base === 'key-silver')?.quantity).toBe(3);
    expect(hero.items.some((i) => i.base === 'ring' && i.tier === 'epic' && !i.identified)).toBe(true);
    expect((await post(admin, '/api/admin/grant', { playerId: player.id, item: { base: 'ring', tier: 'relic' } })).json().error).toBe('no_relics');
    const rolls = (await get(admin, '/api/admin/rolls?kind=admin-grant')).json().rolls;
    expect(rolls).toHaveLength(1);
  });

  it('runs due jobs once, and leaves future ones alone', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const pending = await prisma.job.count({ where: { doneAt: null } });
    expect(await runDueJobs()).toBe(0);
    expect(await prisma.job.count({ where: { doneAt: null } })).toBe(pending);
    await prisma.job.updateMany({ where: { kind: 'weaken' }, data: { runAt: new Date(Date.now() - 1000) } });
    expect(await runDueJobs()).toBe(4);
    expect(await prisma.job.count({ where: { kind: 'weaken', doneAt: null } })).toBe(0);
    // Each weakening queued a Broadcast, due on the next pass; then nothing is left.
    expect(await runDueJobs()).toBe(4);
    expect(await runDueJobs()).toBe(0);
  });
});
