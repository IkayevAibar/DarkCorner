import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth } from '@dark/engine';
import { type LabyrinthResult, labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { combatOf } from '../src/services/fights.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;

const SEED = 'twins-test';
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const twinRoom = floor1.rooms.find((r) => r.type === 'twin')!.id;
/** The Room outside the Twin door. */
const outside = doorsOf(floor1, twinRoom)[0]!.to;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
async function act(cookie: string, url: string, payload: object = {}) {
  const response = await post(cookie, url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return labyrinthResultSchema.parse(response.json());
}
const look = async (cookie: string) => labyrinthResultSchema.parse((await get(cookie, '/api/labyrinth')).json());

async function makeHero(name: string, admin: boolean, cls = 'fighter') {
  const cookie = await devLogin(app, name, admin);
  if (!admin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: cls, talents: ['alert', 'tough'], portrait: `human-${cls}-1`, banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  await get(cookie, '/api/duo');
  return { cookie, hero: await prisma.hero.findFirstOrThrow({ where: { name } }) };
}

/** Garrick and Mira, a Duo, standing outside the Twin door on Floor 1. */
async function pairAtTheDoor() {
  const a = await makeHero('Garrick', true);
  const b = await makeHero('Mira', false, 'cleric');
  await post(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
  await post(b.cookie, '/api/duo/accept', { inviteId: (await prisma.duoInvite.findFirstOrThrow()).id });
  await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
  await prisma.hero.updateMany({ data: { room: outside, prevRoom: outside, facing: false } });
  // Whatever waits outside was dealt with today, so the Duo can step back out to it.
  for (const hero of [a.hero, b.hero]) {
    await prisma.heroFloor.update({ where: { heroId_floor: { heroId: hero.id, floor: 1 } }, data: { cleared: { [String(outside)]: new Date().toISOString() } } });
  }
  return { a, b };
}

/** Heroes that can't lose and fell a Warden with every hit, so a fight's end can be checked. */
const mighty = () => prisma.hero.updateMany({ data: { hp: 900, maxHp: 900, str: 30, wis: 30, stamina: 20, staminaAt: new Date() } });

/** Both Players hand their Heroes to the AI, and the fight runs to its end. */
async function autoOut(...cookies: string[]): Promise<LabyrinthResult[]> {
  const ends = new Map<string, LabyrinthResult>();
  for (let i = 0; i < 40 && ends.size < cookies.length; i++) {
    for (const cookie of cookies) {
      if (ends.has(cookie)) continue;
      const seen = await look(cookie);
      if (seen.fight) ends.set(cookie, seen);
      else if (seen.view.fight?.mine) {
        const r = labyrinthResultSchema.parse((await post(cookie, '/api/labyrinth/fight', { action: { kind: 'auto' } })).json());
        if (r.fight) ends.set(cookie, r);
      }
    }
  }
  return cookies.map((c) => ends.get(c) ?? (() => { throw new Error('the fight never ended'); })());
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

const SLOW = 30_000;

describe('Twin doors', () => {
  it('open only for a Duo, and the Twin Wardens wait behind them', async () => {
    const { cookie } = await makeHero('Garrick', true);
    await act(cookie, '/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { room: outside, prevRoom: outside } });
    const alone = await look(cookie);
    expect(alone.view.exits.find((e) => e.to === twinRoom)).toMatchObject({ kind: 'twin', passable: false });
    expect((await post(cookie, '/api/labyrinth/move', { to: twinRoom })).json()).toMatchObject({ error: 'twin_door' });
  });

  it('let a Duo in to face the Wardens, with no sneaking past them', async () => {
    const { a, b } = await pairAtTheDoor();
    expect((await look(a.cookie)).view.exits.find((e) => e.to === twinRoom)).toMatchObject({ kind: 'twin', passable: true });
    const inside = await act(a.cookie, '/api/labyrinth/move', { to: twinRoom });
    const facing = inside.view.room!.facing!;
    expect(facing.kind).toBe('twin');
    expect(facing.monsters.map((m) => m.name.en)).toEqual(['Dawn Warden', 'Dusk Warden']);
    expect(facing.foes.every((f) => f.role === 'warden')).toBe(true);
    expect(facing.sneak).toBeNull();
    expect((await post(a.cookie, '/api/labyrinth/face', { action: 'sneak', smoke: false })).json()).toMatchObject({ error: 'no_sneaking' });
    // Alone after the Duo ends, a Hero steps back out: the Wardens face only a Duo.
    await post(b.cookie, '/api/duo/leave');
    const stepped = await look(a.cookie);
    expect(stepped.view.room!.id).toBe(outside);
    expect(stepped.view.room!.facing).toBeNull();
    expect(stepped.notices.map((n) => n.en).join(' ')).toContain('face only a Duo');
  });

  it('give a Duo that breaks the Wardens a pair of Bond rings, joined while both wear them, and wake again a week later', async () => {
    const { a, b } = await pairAtTheDoor();
    await mighty();
    await act(a.cookie, '/api/labyrinth/move', { to: twinRoom });
    await act(a.cookie, '/api/labyrinth/face', { action: 'fight', bomb: false, auto: true });
    const [endA, endB] = await autoOut(a.cookie, b.cookie);
    expect(endA!.fight?.outcome).toBe('victory');
    expect(endB!.fight?.outcome).toBe('victory');
    const rings = await prisma.item.findMany({ where: { base: 'bond-ring' }, include: { hero: true } });
    expect(rings).toHaveLength(2);
    expect(rings[0]!.bond).toBe(rings[1]!.bond);
    expect(new Set(rings.map((r) => `${r.hero!.name}→${r.bondWith}`))).toEqual(new Set(['Garrick→Mira', 'Mira→Garrick']));
    expect(endA!.loot.some((l) => l.base === 'bond-ring' && l.power?.en.includes('Mira'))).toBe(true);
    expect(endB!.loot.some((l) => l.base === 'bond-ring')).toBe(true);
    expect(await prisma.feedEvent.count({ where: { kind: 'twin' } })).toBe(1);

    // Worn by both, the halves are joined: twice their Bonus stats in a fight together.
    for (const ring of rings) await prisma.item.update({ where: { id: ring.id }, data: { place: 'WORN', slot: 'ring1' } });
    expect((await look(a.cookie)).view.duo?.bonded).toBe(true);
    const [garrick, mira] = await Promise.all(['Garrick', 'Mira'].map((name) => prisma.hero.findFirstOrThrow({ where: { name }, include: { items: true } })));
    const ring = garrick!.items.find((i) => i.base === 'bond-ring')!;
    const stats = ring.bonusStats as { stat: string; value: number }[];
    const alone = combatOf(garrick!);
    const together = combatOf(garrick!, mira!);
    const sum = (stat: string) => stats.filter((s) => s.stat === stat).reduce((n, s) => n + s.value, 0);
    expect(together.damagePct - alone.damagePct).toBe(sum('damage'));
    expect(together.scores.str - alone.scores.str).toBe(sum('str'));

    // Beaten this week: the Room is quiet, and walking back in costs nothing new.
    await act(a.cookie, '/api/labyrinth/move', { to: outside });
    const back = await act(a.cookie, '/api/labyrinth/move', { to: twinRoom });
    expect(back.view.room!.facing).toBeNull();
    expect(back.notices.map((n) => n.en).join(' ')).toContain('stand still as stone');
    // A week on, they wake again.
    await act(a.cookie, '/api/labyrinth/move', { to: outside });
    const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    for (const hf of await prisma.heroFloor.findMany()) {
      await prisma.heroFloor.update({ where: { id: hf.id }, data: { cleared: { ...(hf.cleared as object), [String(twinRoom)]: weekAgo } } });
    }
    expect((await act(a.cookie, '/api/labyrinth/move', { to: twinRoom })).view.room!.facing?.kind).toBe('twin');
  }, SLOW);
});
