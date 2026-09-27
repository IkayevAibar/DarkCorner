import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, MONSTERS, doorsOf, generateLabyrinth, huntTarget, weekOf } from '@dark/engine';
import { bountiesViewSchema, labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let cookie: string;

/** A seed whose Floor 1 landing has a fight Room behind an ordinary Door. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const floor = generateLabyrinth(`bounty-${i}`).floors[0]!;
    if (doorsOf(floor, floor.landing).some(({ door, to }) => door.kind === 'open' && floor.rooms[to]!.type === 'fight')) return `bounty-${i}`;
  }
})();
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const fightRoom = doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')!.to;

const get = (url: string) => app.inject({ url, headers: { cookie } });
const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
async function act(url: string, payload: object = {}) {
  const response = await post(url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return labyrinthResultSchema.parse(response.json());
}
const bounties = async () => bountiesViewSchema.parse((await get('/api/tavern/bounties')).json());
const hero = () => prisma.hero.findFirstOrThrow({ where: { retiredAt: null } });

/** Makes today's first daily bounty ask for exactly this. */
async function setFirst(kind: string, target: number, reward = { gold: 50, item: { base: 'potion', quantity: 2 } }) {
  const view = await bounties();
  await prisma.bounty.update({ where: { id: view.daily[0]!.id }, data: { kind, target, params: {}, reward, progress: 0, doneAt: null } });
  return view.daily[0]!.id;
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
  cookie = await devLogin(app, 'Owner', true);
  await post('/api/heroes/draft');
  await post('/api/heroes', { name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
});

describe('Tavern bounties', () => {
  it('offers three a day and one a week, the same each time the Tavern is opened', async () => {
    const first = await bounties();
    expect(first.daily).toHaveLength(3);
    expect(first.weekly).not.toBeNull();
    expect(first.weekly!.reward.item?.base).toBe('chest-silver');
    expect(await bounties()).toEqual(first);
    expect(await prisma.bounty.count()).toBe(4);
  });

  it('pays a finished bounty at once: gold banked, the Item in Storage', async () => {
    const id = await setFirst('slay', 1);
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, str: 30 } });
    const goldBefore = (await hero()).gold;
    await act('/api/labyrinth/move', { to: fightRoom });
    const won = await act('/api/labyrinth/face', { action: 'fight' });
    expect(won.fight?.outcome).toBe('victory');
    expect(won.notices.some((n) => n.en.startsWith('Bounty done'))).toBe(true);

    expect((await hero()).gold).toBe(goldBefore + 50);
    const stored = await prisma.item.findFirst({ where: { place: 'STORAGE', base: 'potion' } });
    expect(stored?.quantity).toBe(2);
    const done = (await bounties()).daily.find((b) => b.id === id)!;
    expect(done).toMatchObject({ done: true, progress: 1 });
  });

  it('counts Sneaking past and gold brought home', async () => {
    await setFirst('sneak', 1);
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.item.create({ data: { heroId: (await hero()).id, seasonId: (await hero()).seasonId, base: 'bomb-smoke', place: 'BAG', quantity: 1, tier: 'common' } });
    await act('/api/labyrinth/move', { to: fightRoom });
    const slipped = await act('/api/labyrinth/face', { action: 'sneak', smoke: true });
    expect(slipped.notices.some((n) => n.en.startsWith('Bounty done'))).toBe(true);

    const view = await bounties();
    await prisma.bounty.update({ where: { id: view.daily[1]!.id }, data: { kind: 'bank', target: 30, params: {}, progress: 0, doneAt: null } });
    await prisma.hero.updateMany({ data: { carriedGold: 37 } });
    await act('/api/labyrinth/move', { to: floor1.landing });
    const home = await act('/api/labyrinth/leave');
    expect(home.notices.some((n) => n.en.startsWith('Bounty done'))).toBe(true);
  });

  it('swaps one untouched daily bounty a day', async () => {
    const view = await bounties();
    const swapped = bountiesViewSchema.parse((await post(`/api/tavern/bounties/${view.daily[0]!.id}/swap`)).json());
    expect(swapped.daily[0]!.canSwap).toBe(false);
    expect(swapped.daily[1]!.canSwap).toBe(false);
    expect(new Set(swapped.daily.map((b) => b.title.en)).size).toBe(3);
    expect((await post(`/api/tavern/bounties/${view.daily[1]!.id}/swap`)).json().error).toBe('swap_used');
    expect((await post(`/api/tavern/bounties/${view.weekly!.id}/swap`)).json().error).toBe('no_bounty');
  });
});

describe('the Hunt', () => {
  it('posts a Hunt a week for the whole server and pays its hunters when the target falls', async () => {
    const posted = (await bounties()).hunt!;
    // One Hero seen this week; a Hunt posted mid-week asks only its share for the days left.
    const day = Math.floor(Date.now() / 86_400_000);
    expect(posted).toMatchObject({ total: 0, mine: 0, min: 10, done: false, target: huntTarget(1, weekOf(day) + 7 - day) });
    expect(await prisma.feedEvent.count({ where: { kind: 'hunt' } })).toBe(1);

    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, str: 30 } });
    const facing = (await act('/api/labyrinth/move', { to: fightRoom })).view.room!.facing!;
    // Make this Room's first monster the quarry, one kill short of the target.
    const kin = MONSTERS.find((m) => m.name.en === facing.monsters[0]!.name.en)!.kin;
    const h = await hero();
    const hunt = await prisma.hunt.findFirstOrThrow();
    await prisma.hunt.update({ where: { id: hunt.id }, data: { kin, total: hunt.target - 1 } });
    await prisma.huntHunter.create({ data: { huntId: hunt.id, heroId: h.id, heroName: h.name, count: 20 } });

    const won = await act('/api/labyrinth/face', { action: 'fight' });
    expect(won.fight?.outcome).toBe('victory');
    expect(won.notices.some((n) => n.en.includes('you led it'))).toBe(true);
    const after = (await bounties()).hunt!;
    expect(after.done).toBe(true);
    expect(after.mine).toBeGreaterThan(20);
    expect(after.top[0]).toMatchObject({ hero: 'Garrick' });
    expect(await prisma.item.count({ where: { base: 'chest-gold', place: 'STORAGE' } })).toBe(1);
    expect(await prisma.feedEvent.count({ where: { kind: 'hunt-done' } })).toBe(1);
  });
});
