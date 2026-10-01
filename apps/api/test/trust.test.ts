import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth, tierRank } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;

const SEED = 'trust-test';
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const stone = floor1.rooms.find((r) => r.type === 'oathstone')!.id;
/** A Treasure room, and an ordinary Room next to it to walk in from. */
const treasure = floor1.rooms.find((r) => r.type === 'treasure' && doorsOf(floor1, r.id).some(({ door }) => door.kind === 'open'))!.id;
const beside = doorsOf(floor1, treasure).find(({ door }) => door.kind === 'open')!.to;

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

/** Garrick and Mira, a Duo standing in `room` on Floor 1. */
async function duoAt(room: number) {
  const a = await makeHero('Garrick', true);
  const b = await makeHero('Mira', false, 'cleric');
  await post(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
  await post(b.cookie, '/api/duo/accept', { inviteId: (await prisma.duoInvite.findFirstOrThrow()).id });
  await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
  await prisma.hero.updateMany({ data: { room, prevRoom: room, facing: false, stamina: 20, staminaAt: new Date() } });
  return { a, b };
}
const bagGear = (heroId: string) => prisma.item.findMany({ where: { heroId, place: 'BAG', base: { notIn: ['potion', 'scroll-portal', 'scroll-identify', 'bomb-fire', 'bomb-smoke'] }, quantity: 1 } });
const swear = (cookie: string, choice: 'share' | 'take') => post(cookie, '/api/labyrinth/oath', { choice });

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

describe('Oathstones', () => {
  it('stay silent for a Hero alone', async () => {
    const { cookie } = await makeHero('Garrick', true);
    await act(cookie, '/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { room: stone, prevRoom: stone } });
    expect((await look(cookie)).view.room!.oath).toMatchObject({ state: 'silent' });
    expect((await swear(cookie, 'share')).json()).toMatchObject({ error: 'oath_alone' });
  });

  it('keep each oath secret until both are sworn; sharing gives each a good gift, and the stone rests for a week', async () => {
    const { a, b } = await duoAt(stone);
    const before = { a: (await bagGear(a.hero.id)).length, b: (await bagGear(b.hero.id)).length };
    expect((await look(a.cookie)).view.room!.oath).toEqual({ state: 'open', mine: null, partnerSwore: false, until: null });
    await act(a.cookie, '/api/labyrinth/oath', { choice: 'share' });
    expect((await look(a.cookie)).view.room!.oath).toMatchObject({ mine: 'share', partnerSwore: false });
    expect((await look(b.cookie)).view.room!.oath).toMatchObject({ mine: null, partnerSwore: true });
    expect((await swear(a.cookie, 'take')).json()).toMatchObject({ error: 'already_sworn' });

    const done = await act(b.cookie, '/api/labyrinth/oath', { choice: 'share' });
    expect(done.notices.map((n) => n.en).join(' ')).toContain('You both shared');
    for (const [h, n] of [[a.hero, before.a], [b.hero, before.b]] as const) {
      const gear = await bagGear(h.id);
      expect(gear).toHaveLength(n + 1);
      expect(tierRank(gear.at(-1)!.tier as never)).toBeGreaterThanOrEqual(tierRank('rare'));
    }
    expect(await prisma.feedEvent.count({ where: { kind: 'oath-kept' } })).toBe(1);
    expect(await prisma.oath.count()).toBe(0);
    const spent = (await look(a.cookie)).view.room!.oath!;
    expect(spent.state).toBe('spent');
    expect(new Date(spent.until!).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600_000);
    expect((await swear(b.cookie, 'take')).json()).toMatchObject({ error: 'oath_spent' });
  });

  it('give a lone taker both gifts, and tell the Feed', async () => {
    const { a, b } = await duoAt(stone);
    const before = { a: (await bagGear(a.hero.id)).length, b: (await bagGear(b.hero.id)).length };
    await act(a.cookie, '/api/labyrinth/oath', { choice: 'share' });
    const r = await act(b.cookie, '/api/labyrinth/oath', { choice: 'take' });
    expect(r.notices.map((n) => n.en).join(' ')).toContain('both gifts are yours');
    expect(await bagGear(a.hero.id)).toHaveLength(before.a);
    expect(await bagGear(b.hero.id)).toHaveLength(before.b + 2);
    const line = await prisma.feedEvent.findFirstOrThrow({ where: { kind: 'oath-broken' } });
    expect(line.data).toMatchObject({ hero: 'Mira', partner: 'Garrick' });
    expect((await look(a.cookie)).notices.map((n) => n.en).join(' ')).toContain('Mira took both gifts');
  });

  it('crack under two takers and curse them both', async () => {
    const { a, b } = await duoAt(stone);
    await act(a.cookie, '/api/labyrinth/oath', { choice: 'take' });
    await act(b.cookie, '/api/labyrinth/oath', { choice: 'take' });
    for (const h of await prisma.hero.findMany()) expect(h.blessing).toBe('oathbroken');
    const hero = (await get(a.cookie, '/api/heroes/me')).json().hero;
    expect(hero.luck.blessing).toMatchObject({ id: 'oathbroken', curse: true });
    expect(hero.luck.goldFind).toBe(-50);
    expect(await prisma.feedEvent.count({ where: { kind: 'oath-cracked' } })).toBe(1);
  });
});

describe('Duo Chests', () => {
  it('hold the Treasure a Duo finds together, split by picking in turns', async () => {
    const { a, b } = await duoAt(beside);
    await act(a.cookie, '/api/labyrinth/move', { to: treasure });
    const chest = (await look(a.cookie)).view.chest!;
    expect(chest.items.length).toBeGreaterThanOrEqual(2);
    expect(chest.items.every((i) => i.takenBy === null)).toBe(true);
    const [first, second] = chest.turn === 'me' ? [a, b] : [b, a];
    expect((await look(second.cookie)).view.chest!.turn).toBe('partner');
    expect((await post(second.cookie, '/api/labyrinth/chest', { index: 0 })).json()).toMatchObject({ error: 'not_your_pick' });

    const picked = await act(first.cookie, '/api/labyrinth/chest', { index: 0 });
    expect(picked.loot).toHaveLength(1);
    expect(picked.view.chest!.items[0]!.takenBy).toBe('me');
    expect(picked.view.chest!.turn).toBe('partner');
    expect((await post(first.cookie, '/api/labyrinth/chest', { index: 1 })).json()).toMatchObject({ error: 'not_your_pick' });
    expect((await post(second.cookie, '/api/labyrinth/chest', { index: 0 })).json()).toMatchObject({ error: 'already_taken' });

    // A pick left half a minute goes to the best Item left.
    await prisma.duoChest.updateMany({ data: { turnAt: new Date(Date.now() - 31_000) } });
    const after = await look(first.cookie);
    const taken = after.view.chest?.items.filter((i) => i.takenBy !== null).length ?? chest.items.length;
    expect(taken).toBeGreaterThanOrEqual(2);
  });

  it('pick the rest in turn when the Duo walks on', async () => {
    const { a } = await duoAt(beside);
    await act(a.cookie, '/api/labyrinth/move', { to: treasure });
    const size = (await look(a.cookie)).view.chest!.items.length;
    const heroes = await prisma.hero.findMany({ include: { items: true } });
    const before = heroes.reduce((n, h) => n + h.items.length, 0);
    await act(a.cookie, '/api/labyrinth/move', { to: beside });
    expect(await prisma.duoChest.count()).toBe(0);
    const now = await prisma.item.count({ where: { heroId: { in: heroes.map((h) => h.id) } } });
    expect(now - before).toBe(size);
  });
});
