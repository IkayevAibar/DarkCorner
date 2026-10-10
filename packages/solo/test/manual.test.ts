// Ported from apps/api/test/manual.test.ts: the same scenario, on the solo backend.
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth } from '@dark/engine';
import { type LabyrinthResult, labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;

/** A seed whose Floor 1 landing has a fight Room behind an ordinary Door. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const floor = generateLabyrinth(`test-${i}`).floors[0]!;
    if (doorsOf(floor, floor.landing).some(({ door, to }) => door.kind === 'open' && floor.rooms[to]!.type === 'fight')) return `test-${i}`;
  }
})();
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const fightRoom = doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')!.to;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
async function act(cookie: string, url: string, payload: object = {}) {
  const response = await post(cookie, url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return labyrinthResultSchema.parse(response.json());
}
const look = async (cookie: string) => labyrinthResultSchema.parse((await get(cookie, '/api/labyrinth')).json());
const choose = (cookie: string, action: object) => post(cookie, '/api/labyrinth/fight', { action });

async function makeHero(name: string, admin: boolean, cls = 'fighter') {
  const cookie = await devLogin(app, name, admin);
  if (!admin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: cls, talents: ['alert', 'tough'], portrait: `human-${cls}-1`, banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  await get(cookie, '/api/duo');
  return { cookie, hero: await prisma.hero.findFirstOrThrow({ where: { name } }) };
}
/** Heroes too sturdy to lose, with Stamina to spare. */
const sturdy = () => prisma.hero.updateMany({ data: { hp: 900, maxHp: 900, stamina: 20, staminaAt: new Date() } });

/**
 * Plays a fight to its end, each Player attacking on its own turns, and returns what the
 * end brought each of them (the one who made the last move gets it at once, the other on a look).
 */
async function playOut(...cookies: string[]): Promise<LabyrinthResult[]> {
  const ends = new Map<string, LabyrinthResult>();
  for (let i = 0; i < 400 && ends.size < cookies.length; i++) {
    for (const cookie of cookies) {
      if (ends.has(cookie)) continue;
      const seen = await look(cookie);
      if (seen.fight) {
        ends.set(cookie, seen);
        continue;
      }
      const live = seen.view.fight;
      if (!live?.mine) continue;
      const kind = live.turn.actions.includes('attack') ? 'attack' : live.turn.actions[0];
      const response = await choose(cookie, { kind, target: kind === 'attack' ? live.turn.targets[0] : undefined });
      if (response.statusCode !== 200) throw new Error(response.body);
      const r = labyrinthResultSchema.parse(response.json());
      if (r.fight) ends.set(cookie, r);
    }
  }
  return cookies.map((c) => {
    const end = ends.get(c);
    if (!end) throw new Error('the fight never ended');
    return end;
  });
}

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  await prisma.season.create({ data: { number: 0, seed: SEED, status: 'ACTIVE', startsAt: new Date() } });
});

/** Each fight here takes a request or two a turn: room for a busy machine. */
const SLOW = 30_000;

describe('Fights played turn by turn', () => {
  it('wait for the Player at each of the Hero\'s turns, and nothing else happens meanwhile', async () => {
    const { cookie } = await makeHero('Garrick', true);
    await act(cookie, '/api/labyrinth/enter', { floor: 1 });
    await sturdy();
    await act(cookie, '/api/labyrinth/move', { to: fightRoom });
    const started = await act(cookie, '/api/labyrinth/face', { action: 'fight' });
    expect(started.fight).toBeNull();
    const live = started.view.fight!;
    expect(live).toMatchObject({ mine: true, deadline: null, auto: false, ally: null });
    expect(live.turn.hero).toBe('hero');
    expect(live.turn.actions).toEqual(expect.arrayContaining(['attack', 'second-wind', 'escape', 'dodge']));
    expect(live.events[0]!.type).toBe('initiative');
    expect(started.view.room?.facing).toBeNull();

    // Nothing but the fight until it ends.
    expect((await post(cookie, '/api/labyrinth/move', { to: floor1.landing })).json()).toMatchObject({ error: 'in_fight' });
    expect((await post(cookie, '/api/labyrinth/short-rest')).json()).toMatchObject({ error: 'in_fight' });
    expect((await post(cookie, '/api/labyrinth/stance', { stance: 'bold' })).json()).toMatchObject({ error: 'in_fight' });
    // Only what the Hero can do.
    expect((await choose(cookie, { kind: 'burst' })).json()).toMatchObject({ error: 'bad_action' });
    expect((await choose(cookie, { kind: 'attack', target: 'm9' })).json()).toMatchObject({ error: 'bad_action' });

    // The Hero swings where it is told.
    const target = live.turn.targets.at(-1)!;
    const after = await choose(cookie, { kind: 'attack', target });
    const next = labyrinthResultSchema.parse(after.json());
    const events = next.view.fight?.events ?? next.fight!.events;
    expect(events.slice(0, live.events.length)).toEqual(live.events);
    expect(events.slice(live.events.length).find((e) => e.type === 'attack' && e.actor === 'hero')).toMatchObject({ target });

    // That swing may already have felled the last monster (the group is rolled anew for each test's Hero).
    const [end] = next.fight ? [next] : await playOut(cookie);
    expect(end!.fight?.outcome).toBe('victory');
    expect(end!.xp).toBeGreaterThan(0);
    expect(end!.view.fight).toBeNull();
    const h = await prisma.hero.findFirstOrThrow({ where: { name: 'Garrick' } });
    expect(h).toMatchObject({ facing: false, room: fightRoom, prevRoom: fightRoom });
    expect(await prisma.fight.count()).toBe(0);
    const log = await prisma.rollLog.findFirstOrThrow({ where: { kind: 'fight' } });
    expect(log.detail).toMatchObject({ outcome: 'victory', manual: ['hero'] });
  }, SLOW);

  it('let the Hero fight on its own from any turn, or from the start', async () => {
    const { cookie } = await makeHero('Garrick', true);
    await act(cookie, '/api/labyrinth/enter', { floor: 1 });
    await sturdy();
    await act(cookie, '/api/labyrinth/move', { to: fightRoom });
    await act(cookie, '/api/labyrinth/face', { action: 'fight' });
    const auto = labyrinthResultSchema.parse((await choose(cookie, { kind: 'auto' })).json());
    expect(auto.fight?.outcome).toBe('victory');
    expect(auto.view.fight).toBeNull();

    // Auto from the doorway: over at once, as fights always were.
    await prisma.heroFloor.updateMany({ data: { cleared: {} } });
    await act(cookie, '/api/labyrinth/move', { to: floor1.landing });
    await act(cookie, '/api/labyrinth/move', { to: fightRoom });
    const at = await act(cookie, '/api/labyrinth/face', { action: 'fight', auto: true });
    expect(at.fight?.outcome).toBe('victory');
    expect(await prisma.fight.count()).toBe(0);
  }, SLOW);

  it('play a Duo fight turn by turn, each Player on its own Hero\'s turns', async () => {
    const a = await makeHero('Garrick', true);
    const b = await makeHero('Mira', false, 'cleric');
    await post(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
    const invite = await prisma.duoInvite.findFirstOrThrow();
    await post(b.cookie, '/api/duo/accept', { inviteId: invite.id });
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    await sturdy();
    await act(a.cookie, '/api/labyrinth/move', { to: fightRoom });
    const started = await act(a.cookie, '/api/labyrinth/face', { action: 'fight' });
    const mine = started.view.fight!;
    expect(mine.ally?.name.en).toBe('Mira');
    expect(mine.deadline).not.toBeNull();
    // The clock starts once the opening moves can have played on screen.
    expect(new Date(mine.deadline!).getTime()).toBeGreaterThan(Date.now() + 31_000);
    const theirs = (await look(b.cookie)).view.fight!;
    expect(theirs.hero.name.en).toBe('Mira');
    expect(theirs.ally?.name.en).toBe('Garrick');
    // Whoever's turn it is, one Player sees it as theirs and the other waits.
    expect(mine.mine).not.toBe(theirs.mine);
    expect(theirs.turn.actions).toEqual(expect.arrayContaining(['help', 'guard']));
    // Out of turn: refused.
    const waiting = mine.mine ? b.cookie : a.cookie;
    expect((await choose(waiting, { kind: 'attack' })).json()).toMatchObject({ error: 'not_your_turn' });

    // A choice gives the next turn its 30 seconds after the moves it set off have played.
    const [who, view] = mine.mine ? [a.cookie, mine] : [b.cookie, theirs];
    const next = labyrinthResultSchema.parse((await choose(who, { kind: 'attack', target: view.turn.targets[0] })).json());
    if (next.view.fight) expect(new Date(next.view.fight.deadline!).getTime()).toBeGreaterThan(Date.now() + 31_000);

    const [endA, endB] = await playOut(a.cookie, b.cookie);
    expect(endA!.fight?.outcome).toBe('victory');
    expect(endB!.fight?.outcome).toBe('victory');
    expect(endB!.fight?.hero.name.en).toBe('Mira');
    expect(endA!.xp).toBeGreaterThan(0);
    expect(endA!.xp).toBe(endB!.xp);
    expect(await prisma.fight.count()).toBe(0);
    expect((await prisma.hero.findMany()).every((h) => !h.facing && h.room === fightRoom)).toBe(true);
  }, SLOW);

  it('give a Duo turn left for 30 seconds to the AI', async () => {
    const a = await makeHero('Garrick', true);
    const b = await makeHero('Mira', false, 'cleric');
    await post(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
    await post(b.cookie, '/api/duo/accept', { inviteId: (await prisma.duoInvite.findFirstOrThrow()).id });
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    await sturdy();
    await act(a.cookie, '/api/labyrinth/move', { to: fightRoom });
    await act(a.cookie, '/api/labyrinth/face', { action: 'fight' });
    const before = await prisma.fight.findFirstOrThrow();
    const choices = (before.choices as unknown[]).length;
    await prisma.fight.update({ where: { id: before.id }, data: { turnAt: new Date(Date.now() - 31_000) } });
    const seen = await look(a.cookie);
    const after = await prisma.fight.findFirst();
    // The waiting turn went to the AI: one more choice, and a fresh deadline (or the fight ran out).
    if (after) {
      expect((after.choices as { action: { kind: string } }[]).length).toBe(choices + 1);
      expect((after.choices as { action: { kind: string } }[]).at(-1)!.action.kind).toBe('ai');
      expect(new Date(seen.view.fight!.deadline!).getTime()).toBeGreaterThan(Date.now() + 25_000);
    } else {
      expect(seen.fight).not.toBeNull();
    }
  }, SLOW);
});
