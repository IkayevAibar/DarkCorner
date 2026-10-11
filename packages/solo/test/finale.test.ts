// Ported from apps/api/test/finale.test.ts: the same scenario, on the solo backend.
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, doorsOf, generateLabyrinth } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { runDueJobs } from '../src/services/scheduler.js';
import { devLogin, resetDatabase } from './helpers.js';

// The end of a Season, rehearsed the way the live server will meet it (docs/plan-season-0.md →
// After launch): the gate and the Wipe on their own clock, a Champion from a fight played by hand,
// the podium full, a Duo at the lair, the Dragon weakening, and the next Season opening empty.

const SEED = 'finale-test';
const lab = generateLabyrinth(SEED);

/** The Boss's Room, and the Room before its plain Door. */
const boss = (() => {
  for (const floor of lab.floors) {
    for (const room of floor.rooms) {
      if (room.type !== 'boss') continue;
      const door = doorsOf(floor, room.id).find((d) => d.door.kind === 'open');
      if (door) return { floor: floor.number, room: room.id, from: door.to };
    }
  }
  throw new Error('no Boss Room');
})();

let app: FastifyInstance;
let admin: string;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
const result = (r: { json: () => unknown }) => labyrinthResultSchema.parse(r.json());

async function makeHero(name: string, asAdmin = false) {
  const cookie = await devLogin(app, name, asAdmin);
  if (!asAdmin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const r = await post(cookie, '/api/heroes', { name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
  if (r.statusCode !== 200) throw new Error(r.body);
  const hero = await prisma.hero.findFirstOrThrow({ where: { name, retiredAt: null }, orderBy: { createdAt: 'desc' } });
  if (asAdmin) admin = cookie;
  return { cookie, hero };
}

/** A Hero that can't lose to the Dragon, at the lair's doorstep. */
const atTheDoor = (heroId: string) => prisma.hero.update({
  where: { id: heroId },
  data: {
    location: 'LABYRINTH', floor: boss.floor, room: boss.from, prevRoom: boss.from, facing: false,
    level: 20, str: 30, maxHp: 99_999, hp: 99_999, stamina: 20, staminaAt: new Date(),
  },
});

/** Walks a Hero into the lair and fights the Dragon on Auto. */
async function slay(cookie: string, heroId: string) {
  await atTheDoor(heroId);
  const facing = result(await post(cookie, '/api/labyrinth/move', { to: boss.room }));
  expect(facing.view.room?.facing?.kind).toBe('boss');
  return result(await post(cookie, '/api/labyrinth/face', { action: 'fight', auto: true }));
}

const broadcasts = async () => (await prisma.job.findMany({ where: { kind: 'broadcast' }, orderBy: { runAt: 'asc' } }))
  .map((j) => (j.payload as { text: { en: string } }).text.en);

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

describe('the end of a Season, rehearsed', () => {
  it('keeps the lair sealed until the gate’s day, then opens it on the gate job’s own clock', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const hero = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await atTheDoor(hero.id);
    expect((await post(admin, '/api/labyrinth/move', { to: boss.room })).json().error).toBe('boss_gate_closed');

    // The gate's day comes: the Season's own job runs, not the admin's hurry button. (Moving the
    // marks to now stands in for the days passing; running the queue weeks ahead would also run every
    // daily Omen and Vault job in between.)
    const season = await prisma.season.findFirstOrThrow();
    const gate = await prisma.job.findFirstOrThrow({ where: { kind: 'boss-gate' } });
    expect(gate.runAt.getTime()).toBe(season.bossGateAt!.getTime());
    await prisma.season.update({ where: { id: season.id }, data: { bossGateAt: new Date(Date.now() - 1000) } });
    await prisma.job.update({ where: { id: gate.id }, data: { runAt: new Date(Date.now() - 1000) } });
    await runDueJobs();
    expect(await prisma.feedEvent.count({ where: { kind: 'gate-open' } })).toBe(1);
    expect(await broadcasts()).toContain('🔥 The Boss gate is open! The Ancient Dragon waits on Floor 10.');

    const facing = result(await post(admin, '/api/labyrinth/move', { to: boss.room }));
    expect(facing.view.room?.facing).toMatchObject({ kind: 'boss', sneak: null });
    // Solo counts the weakening from the gate, which can open early (docs/plan-solo-offline.md →
    // Chapters): its first tenth comes with the gate, as it does online on the gate's own day.
    expect(facing.view.room?.facing?.monsters.map((m) => [m.name.en, m.maxHp])).toEqual([['The Ancient Dragon', 1260]]);
  });

  it('opens the gate early the first time a Hero reaches Floor 10, and the weakening follows it', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    const hero = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    const stairs = lab.floors[8]!.rooms.find((r) => r.type === 'stairs')!;
    await prisma.hero.update({
      where: { id: hero.id },
      data: { location: 'LABYRINTH', floor: 9, room: stairs.id, prevRoom: stairs.id, bestFloor: 9, level: 20, maxHp: 99_999, hp: 99_999, stamina: 20, staminaAt: new Date() },
    });
    const down = result(await post(admin, '/api/labyrinth/descend', {}));
    expect(down.view.floor?.number).toBe(10);
    expect(down.notices.map((n) => n.en)).toContain('Floor 10, at last. Far below, the Boss gate grinds open: the Ancient Dragon waits.');
    const season = await prisma.season.findFirstOrThrow();
    expect(season.bossGateAt!.getTime()).toBeLessThanOrEqual(Date.now());
    const steps = await prisma.job.findMany({ where: { kind: 'weaken' }, orderBy: { runAt: 'asc' } });
    expect(steps.map((j) => Math.round((j.runAt.getTime() - season.bossGateAt!.getTime()) / DAY_MS))).toEqual([0, 7, 14, 21]);
    await runDueJobs();
    expect(await prisma.feedEvent.count({ where: { kind: 'gate-open' } })).toBe(1);
  });

  it('ends the Chapter when the Dragon falls to a fight played by hand, with no Finale and no Wipe', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const hero = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await atTheDoor(hero.id);
    await post(admin, '/api/labyrinth/move', { to: boss.room });

    // Played by hand: the fight waits for the Player's first choice, then the AI takes the rest.
    const started = result(await post(admin, '/api/labyrinth/face', { action: 'fight' }));
    expect(started.view.fight?.turn?.hero).toBe('hero');
    const won = result(await post(admin, '/api/labyrinth/fight', { action: { kind: 'auto' } }));
    expect(won.fight?.outcome).toBe('victory');
    expect(won.notices.map((n) => n.en)).toContainEqual(expect.stringMatching(
      /^The Ancient Dragon falls on Day \d+\. Chapter 0 is complete: Admira enters the Hall of Fame\. The world goes on/,
    ));
    expect(won.loot.length).toBeGreaterThanOrEqual(4);

    // Solo (docs/plan-solo-offline.md → Chapters): the Champion enters the Hall of Fame, and the
    // world goes on as it was: no Finale, no Wipe, and the Chapter keeps running.
    const season = await prisma.season.findFirstOrThrow();
    expect(season).toMatchObject({ status: 'ACTIVE', finaleAt: null });
    expect(await prisma.job.count({ where: { kind: 'wipe' } })).toBe(0);
    const tavern = (await get(admin, '/api/tavern')).json();
    expect(tavern.season).toMatchObject({ status: 'active', wipeAt: null, podium: [{ place: 1, hero: 'Admira' }] });
    // Its records join the Champion there: solo has no Wipe to cut them (a best drop too, if the hoard held one).
    expect((await prisma.hallEntry.findMany({ orderBy: { createdAt: 'asc' } })).map((e) => e.kind).filter((k) => k !== 'best-drop'))
      .toEqual(['champion', 'deepest', 'highest-level']);
    await runDueJobs();
    expect((await prisma.season.findFirstOrThrow()).status).toBe('ACTIVE');
  }, 20_000);

  it('fills the podium with three, pays a fourth only the hoard, and gives no Player two places', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const first = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await slay(admin, first.id);
    const places: [number, string][] = [[1, 'Admira']];
    for (const [i, name] of ['Bryn', 'Cato', 'Dace'].entries()) {
      const { cookie, hero } = await makeHero(name);
      const won = await slay(cookie, hero.id);
      expect(won.fight?.outcome).toBe('victory');
      expect(won.loot.length).toBeGreaterThanOrEqual(4);
      if (i < 2) places.push([i + 2, name]);
      else expect(won.notices.map((n) => n.en)).toContain('The Dragon falls again. Its hoard is yours.');
    }
    // The Champion comes back once its lair is no longer quiet: a hoard, no second place.
    await prisma.heroFloor.updateMany({ where: { heroId: first.id }, data: { cleared: {} } });
    const again = await slay(admin, first.id);
    expect(again.notices.map((n) => n.en)).toContain('The Dragon falls again. Its hoard is yours.');

    const podium = (await get(admin, '/api/tavern')).json().season.podium;
    expect(podium.map((p: { place: number; hero: string }) => [p.place, p.hero])).toEqual(places);
    expect((await prisma.hallEntry.findMany({ orderBy: { createdAt: 'asc' } })).filter((e) => e.kind !== 'best-drop').map((e) => [e.kind, e.heroName]))
      .toEqual([['champion', 'Admira'], ['deepest', 'Admira'], ['highest-level', 'Admira'], ['second', 'Bryn'], ['third', 'Cato']]);
    // Solo: no Wipe follows.
    expect(await prisma.job.count({ where: { kind: 'wipe', doneAt: null } })).toBe(0);
  });

  it('turns a Duo away at the lair: the Dragon is faced alone', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const a = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    const { cookie, hero: b } = await makeHero('Mira');
    await get(admin, '/api/duo');
    await post(admin, '/api/duo/invite', { heroId: b.id });
    const invite = (await get(cookie, '/api/duo')).json().incoming[0];
    expect((await post(cookie, '/api/duo/accept', { inviteId: invite.id })).statusCode).toBe(200);
    await atTheDoor(a.id);
    await atTheDoor(b.id);
    const r = await post(admin, '/api/labyrinth/move', { to: boss.room });
    expect(r.json()).toMatchObject({ error: 'duo_boss' });
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: a.id } })).room).toBe(boss.from);
  });

  it('weakens the Dragon by a tenth on the first weakening day, four weeks in', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const season = await prisma.season.findFirstOrThrow();
    const steps = await prisma.job.findMany({ where: { kind: 'weaken' }, orderBy: { runAt: 'asc' } });
    expect(steps.map((j) => Math.round((j.runAt.getTime() - season.startsAt!.getTime()) / DAY_MS))).toEqual([28, 35, 42, 49]);
    // Four weeks and a day later.
    await prisma.season.update({ where: { id: season.id }, data: { startsAt: new Date(Date.now() - 29 * DAY_MS) } });
    await prisma.job.update({ where: { id: steps[0]!.id }, data: { runAt: new Date(Date.now() - 1000) } });
    await runDueJobs();
    expect((await prisma.feedEvent.findFirstOrThrow({ where: { kind: 'weaken' } })).data).toEqual({ percent: 10 });
    expect(await broadcasts()).toContain('🩸 The Ancient Dragon weakens: −10% health and damage.');
    const hero = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await atTheDoor(hero.id);
    const facing = result(await post(admin, '/api/labyrinth/move', { to: boss.room }));
    expect(facing.view.room?.facing?.monsters[0]?.maxHp).toBe(1260);
  });

  it('opens the next Season empty: Heroes made ahead, the Labyrinth shut until an admin starts it, its gate four weeks out', async () => {
    await post(admin, '/api/admin/season', { action: 'start' });
    await post(admin, '/api/admin/season', { action: 'gate' });
    const first = await prisma.hero.findFirstOrThrow({ where: { name: 'Admira' } });
    await slay(admin, first.id);
    await post(admin, '/api/admin/season', { action: 'end' });

    const me = (await get(admin, '/api/heroes/me')).json();
    expect(me).toMatchObject({ season: 1, hero: null, canCreate: true });
    const { cookie } = await makeHero('Admira');
    expect((await get(cookie, '/api/heroes/me')).json()).toMatchObject({ season: 1, hero: { name: 'Admira', level: 1 } });
    expect((await post(cookie, '/api/labyrinth/enter', { floor: 1 })).json().error).toBe('season_not_started');
    // Season 0's glory stays in the Hall of Fame.
    expect((await get(cookie, '/api/hall')).json().entries.some((e: { kind: string; hero: string }) => e.kind === 'champion' && e.hero === 'Admira')).toBe(true);

    const started = (await post(cookie, '/api/admin/season', { action: 'start' })).json();
    expect(started.season).toMatchObject({ number: 1, status: 'active' });
    expect(new Date(started.season.bossGateAt).getTime() - new Date(started.season.startsAt).getTime()).toBe(28 * DAY_MS);
    expect((await post(cookie, '/api/labyrinth/enter', { floor: 1 })).statusCode).toBe(200);
  });
});
