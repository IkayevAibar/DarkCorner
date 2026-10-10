// Ported from apps/api/test/season.test.ts: the same scenario, on the solo backend.
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, RELICS, doorsOf, generateLabyrinth, omenFor } from '@dark/engine';
import { labyrinthResultSchema, rankingsViewSchema } from '@dark/shared';
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
  data: { location: 'LABYRINTH', floor, room, prevRoom: room, facing: false, level: 20, str: 30, maxHp: 99_999, hp: 99_999, stamina: 20, staminaAt: new Date() },
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
  it('leaves the Grave of a Hero who falls to the Boss on the lair’s doorstep', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const boss = roomOfType('boss');
    const hero = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    // Level 1, one health and Bold: the Dragon wins, though a lucky death save can put that off a try or two.
    let died = false;
    for (let i = 0; i < 30 && !died; i++) {
      await prisma.hero.update({
        where: { id: hero.id },
        data: { location: 'LABYRINTH', floor: boss.floor, room: boss.from, prevRoom: boss.from, facing: false, hp: 1, stance: 'bold', stamina: 20, staminaAt: new Date() },
      });
      await post(admin, '/api/labyrinth/move', { to: boss.room });
      died = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/face', { action: 'fight', auto: true })).json()).died;
    }
    expect(died).toBe(true);
    const grave = await prisma.grave.findFirstOrThrow();
    expect({ floor: grave.floor, room: grave.room }).toEqual({ floor: boss.floor, room: boss.from });
  });

  it('starts, schedules its jobs, and refuses to start twice', async () => {
    const r = await post(admin, '/api/admin/season', { action: 'start' });
    expect(r.statusCode).toBe(200);
    const view = r.json();
    expect(view.season.status).toBe('active');
    expect(new Date(view.season.bossGateAt).getTime() - new Date(view.season.startsAt).getTime()).toBe(28 * DAY_MS);
    const kinds = (await prisma.job.findMany()).map((j) => j.kind).sort();
    expect(kinds).toEqual(['boss-gate', 'broadcast', 'omen', 'vault-plan', 'weaken', 'weaken', 'weaken', 'weaken']);
    expect((await prisma.job.findFirstOrThrow({ where: { kind: 'broadcast' } })).doneAt).not.toBeNull();
    expect((await post(admin, '/api/admin/season', { action: 'start' })).json().error).toBe('season_running');
  });

  it('says the day’s Omen at midnight and waits for the next', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const job = await prisma.job.findFirstOrThrow({ where: { kind: 'omen' } });
    expect(job.runAt.getTime() % DAY_MS).toBe(60_000);
    await prisma.job.update({ where: { id: job.id }, data: { runAt: new Date(Date.now() - 1000) } });
    await runDueJobs();
    const today = omenFor(SEED, Math.floor(Date.now() / DAY_MS));
    expect(await prisma.feedEvent.count({ where: { kind: 'omen' } })).toBe(today ? 1 : 0);
    expect(await prisma.job.count({ where: { kind: 'omen', doneAt: null } })).toBe(1);
    const tavern = (await get(admin, '/api/tavern')).json();
    expect(tavern.season.omen?.id ?? null).toBe(today);
  });

  it('retells the past day before the Omen: its best moments, then who fell', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const season = await prisma.season.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const midnight = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const line = (kind: string, data: Record<string, unknown>, hoursBeforeMidnight = 6) => prisma.feedEvent.create({
      data: { seasonId: season.id, kind, data: data as object, createdAt: new Date(midnight - hoursBeforeMidnight * 3_600_000) },
    });
    await line('depth', { hero: 'Pip', floor: 2 });
    await line('depth', { hero: 'Pip', floor: 3 });
    await line('market-sale', { hero: 'Garrick', seller: 'Pip', price: 50, tier: 'rare', base: 'dagger' });
    await line('drop', { hero: 'Pip', tier: 'mythic', base: 'longsword', floor: 3 });
    await line('death', { hero: 'Garrick', floor: 3 });
    await line('death', { hero: 'Old', floor: 1 }, 30);

    const job = await prisma.job.findFirstOrThrow({ where: { kind: 'omen' } });
    await prisma.job.update({ where: { id: job.id }, data: { runAt: new Date(Date.now() - 1000) } });
    await runDueJobs();

    const said = (await prisma.job.findMany({ where: { kind: 'broadcast' }, orderBy: { runAt: 'asc' } }))
      .map((j) => (j.payload as { text: { en: string } }).text.en);
    // The best moment first; a Hero's deepest new Floor only; nothing from before the past day.
    expect(said.find((text) => text.startsWith('📜'))?.split('\n')).toEqual([
      '📜 The past day in the Labyrinth:',
      '• Pip found a Mythic longsword on Floor 3',
      '• Pip reached Floor 3 for the first time',
      '• Garrick bought from Pip for 50 gold: Rare dagger',
      '☠ Fallen: Garrick (Floor 3)',
    ]);
    const omen = omenFor(SEED, Math.floor(Date.now() / DAY_MS));
    if (omen) expect(said.findIndex((text) => text.startsWith('🌘'))).toBeGreaterThan(said.findIndex((text) => text.startsWith('📜')));
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

  it('crowns a Champion and ends the Chapter with no Finale, fills the podium, and ends when told', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const boss = roomOfType('boss');
    const first = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await champion(first.id, boss.floor, boss.from);
    const facing = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/move', { to: boss.room })).json());
    expect(facing.view.room?.facing).toMatchObject({ kind: 'boss', sneak: null });
    expect((await post(admin, '/api/labyrinth/face', { action: 'sneak' })).json().error).toBe('no_sneaking');
    const won = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/face', { action: 'fight', auto: true })).json());
    expect(won.fight?.outcome).toBe('victory');
    expect(won.loot.length).toBeGreaterThanOrEqual(3);

    // Solo, the Dragon's fall ends the Chapter (docs/plan-solo-offline.md → Chapters): no Finale, no Wipe.
    let season = await prisma.season.findFirstOrThrow();
    expect(season.status).toBe('ACTIVE');
    expect(await prisma.job.count({ where: { kind: 'wipe', doneAt: null } })).toBe(0);

    // Coming back the same day: a quiet lair, no second podium place.
    await champion(first.id, boss.floor, boss.from);
    const again = labyrinthResultSchema.parse((await post(admin, '/api/labyrinth/move', { to: boss.room })).json());
    expect(again.fight).toBeNull();
    expect(again.view.room?.facing ?? null).toBeNull();

    const { cookie, hero } = await makeHero('Second');
    await champion(hero.id, boss.floor, boss.from);
    await post(cookie, '/api/labyrinth/move', { to: boss.room });
    await post(cookie, '/api/labyrinth/face', { action: 'fight', auto: true });
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

describe('the Tavern’s Rankings', () => {
  it('ranks the Season’s records, ties sharing a place, and leaves out what nobody has done', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const { cookie: bea, hero: b } = await makeHero('Bea');
    const { hero: c } = await makeHero('Cid');
    const a = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await prisma.hero.update({ where: { id: a.id }, data: { bestFloor: 3, level: 4, xp: 2700, gold: 500, carriedGold: 0 } });
    await prisma.hero.update({ where: { id: b.id }, data: { bestFloor: 5, level: 4, xp: 2800, gold: 120, carriedGold: 30 } });
    await prisma.hero.update({ where: { id: c.id }, data: { bestFloor: 5, level: 2, xp: 400, gold: 0, carriedGold: 0 } });
    const season = await prisma.season.findFirstOrThrow();
    await prisma.feedEvent.createMany({
      data: [
        { seasonId: season.id, playerId: c.playerId, kind: 'death', data: {} },
        { seasonId: season.id, playerId: c.playerId, kind: 'death', data: {} },
        { seasonId: season.id, playerId: b.playerId, kind: 'grave-looted', data: {} },
      ],
    });
    await prisma.rollLog.createMany({
      data: [
        { playerId: a.playerId, kind: 'fight', seed: 'a', detail: { outcome: 'victory' } },
        { playerId: a.playerId, kind: 'fight', seed: 'b', detail: { outcome: 'fled' } },
      ],
    });
    await prisma.item.create({ data: { seasonId: season.id, heroId: b.id, place: 'BAG', base: 'longsword', tier: 'legendary' } });

    const view = rankingsViewSchema.parse((await get(bea, '/api/tavern/rankings')).json());
    const board = (kind: string) => view.boards.find((x) => x.kind === kind)!;
    // Bea and Cid share the deepest Floor; Bea's XP puts it first in the row.
    expect(board('deepest').rows.map((r) => [r.rank, r.hero, r.value])).toEqual([[1, 'Bea', 5], [1, 'Cid', 5], [3, 'Admira', 3]]);
    expect(board('level').rows.map((r) => [r.rank, r.hero, r.me])).toEqual([[1, 'Bea', true], [1, 'Admira', false], [3, 'Cid', false]]);
    // Gold in the City and gold carried both count; nothing at all is no record.
    expect(board('richest').rows.map((r) => [r.hero, r.value])).toEqual([['Admira', 500], ['Bea', 150]]);
    expect(board('victories').rows.map((r) => [r.hero, r.value])).toEqual([['Admira', 1]]);
    expect(board('finest').rows[0]).toMatchObject({ hero: 'Bea', item: { tier: 'legendary', name: { en: 'Longsword' } } });
    expect(board('graves').rows.map((r) => r.hero)).toEqual(['Bea']);
    expect(board('deaths').rows.map((r) => [r.hero, r.value])).toEqual([['Cid', 2]]);
    expect(board('vaults').rows).toEqual([]);
    expect(board('dragon').rows).toEqual([]);
  });
});
