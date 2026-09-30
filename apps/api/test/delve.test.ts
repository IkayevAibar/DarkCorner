import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DELVE_POTIONS, DELVE_ROOMS, delveGold, delveOffer, delveSeed } from '@dark/engine';
import { delveResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeDelves } from '../src/services/delve.js';
import { dayNumber } from '../src/services/ledger.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let seasonId: string;
const SEED = 'delve-test';

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
async function act(cookie: string, url: string, payload: object = {}) {
  const response = await post(cookie, url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return delveResultSchema.parse(response.json());
}

async function makeHero(name: string, strong = true) {
  const cookie = await devLogin(app, name, true);
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  const hero = await prisma.hero.findFirstOrThrow({ where: { name } });
  if (strong) await prisma.hero.update({ where: { id: hero.id }, data: { maxHp: 999, hp: 999, str: 30, con: 30 } });
  return { cookie, hero };
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
  seasonId = (await prisma.season.create({ data: { number: 0, seed: SEED, status: 'ACTIVE', startsAt: new Date() } })).id;
});

describe('the Daily Delve', () => {
  it('goes Room by Room with a Boon between, then banks the score and the gold', async () => {
    const { cookie, hero } = await makeHero('Garrick');
    const first = delveResultSchema.parse((await get(cookie, '/api/delve')).json());
    expect(first.view).toMatchObject({ rooms: DELVE_ROOMS, floor: 1, run: null, board: [], prize: null });

    const started = await act(cookie, '/api/delve/start');
    const run = started.view.run!;
    expect(run).toMatchObject({ floor: 1, rooms: 0, potions: DELVE_POTIONS, end: null, offer: null, score: 0 });
    expect(run.hp).toBe(run.maxHp);
    expect(run.next!.room).toBe(1);
    expect(run.next!.facing.monsters.length).toBeGreaterThan(0);
    expect(run.next!.facing.sneak).toBeNull();
    expect((await post(cookie, '/api/delve/start')).json().error).toBe('delve_taken');

    const won = await act(cookie, '/api/delve/fight');
    expect(won.fight!.outcome).toBe('victory');
    expect(won.view.run!.rooms).toBe(1);
    const offer = won.view.run!.offer!.map((b) => b.id);
    expect(offer).toEqual(delveOffer(delveSeed(SEED, dayNumber(new Date())), 1));
    // After a win, a Boon must be chosen, and only one on offer.
    expect((await post(cookie, '/api/delve/fight')).json().error).toBe('pick_boon');
    const other = (['mend', 'draught', 'breath', 'whetstone', 'ward', 'keen', 'leech'] as const).find((b) => !offer.includes(b))!;
    expect((await post(cookie, '/api/delve/fight', { boon: other })).json().error).toBe('pick_boon');

    const again = await act(cookie, '/api/delve/fight', { boon: offer[0] });
    expect(again.view.run!.rooms).toBe(2);
    expect(again.view.run!.boons.map((b) => b.id)).toEqual([offer[0]]);
    expect(again.view.run!.next!.room).toBe(3);

    const gold = (await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold;
    const stopped = await act(cookie, '/api/delve/stop');
    const done = stopped.view.run!;
    expect(done.end).toBe('stopped');
    expect(done.score).toBe(200 + Math.round((100 * done.hp) / done.maxHp));
    expect(done.gold).toBe(delveGold(1, 2));
    expect(done.next).toBeNull();
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold).toBe(gold + delveGold(1, 2));
    expect(stopped.view.board).toMatchObject([{ place: 1, hero: 'Garrick', score: done.score, mine: true, end: 'stopped' }]);
    expect((await post(cookie, '/api/delve/fight', { boon: offer[0] })).json().error).toBe('delve_over');
    // The Hero's own health and Bag were never touched.
    const after = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });
    expect(after.hp).toBe(999);
  });

  it('keeps half the points for a Hero that falls', async () => {
    const { cookie, hero } = await makeHero('Pip', false);
    await prisma.hero.update({ where: { id: hero.id }, data: { maxHp: 1, hp: 1, str: 3, dex: 3, con: 3 } });
    await act(cookie, '/api/delve/start');
    // One Room won by hand, then a fight the Hero can't survive: 1 health against the depths.
    await prisma.delve.updateMany({ data: { rooms: 1, potions: 0, floor: 9 } });
    const run = await prisma.delve.findFirstOrThrow();
    const boon = delveOffer(delveSeed(SEED, run.day), 1)[0];
    const fell = await act(cookie, '/api/delve/fight', { boon });
    expect(['fell', 'fled']).toContain(fell.view.run!.end);
    expect(fell.view.run!.score).toBe(fell.view.run!.end === 'fell' ? 50 : 100);
  });

  it('closes the day at midnight: the first three win Chests, hear about it, and take them from the Well', async () => {
    const today = dayNumber(new Date());
    const players = await Promise.all(['Ann', 'Bo', 'Cy', 'Di'].map((n) => makeHero(n)));
    for (const [i, { hero }] of players.entries()) {
      await prisma.delve.create({
        data: {
          seasonId, playerId: hero.playerId, heroId: hero.id, day: today - 1, floor: 1, rooms: 3 + i, hp: 10, potions: 0, spellUses: 0, healUses: 0,
          // Di never stopped: midnight banks it.
          ...(i < 3 ? { end: 'stopped', score: 300 + 100 * i, endedAt: new Date(Date.now() - 3_600_000) } : {}),
        },
      });
    }
    await prisma.pushSubscription.create({ data: { playerId: players[3]!.hero.playerId, endpoint: 'https://push.example/di', p256dh: 'p', auth: 'a' } });
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    await prisma.$transaction((tx) => closeDelves(tx, season, new Date()));

    const rows = await prisma.delve.findMany({ orderBy: { place: 'asc' }, include: { hero: true } });
    const placed = rows.filter((r) => r.place !== null).map((r) => [r.hero.name, r.place]);
    // Di's six Rooms, banked at midnight, top the board.
    expect(placed).toEqual([['Di', 1], ['Cy', 2], ['Bo', 3]]);
    expect(rows.find((r) => r.hero.name === 'Di')!.end).toBe('stopped');
    expect(await prisma.job.count({ where: { kind: 'push' } })).toBe(1);
    expect(await prisma.feedEvent.count({ where: { kind: 'delve-podium' } })).toBe(1);

    // Twice is the same as once.
    await prisma.$transaction((tx) => closeDelves(tx, season, new Date()));
    expect(await prisma.feedEvent.count({ where: { kind: 'delve-podium' } })).toBe(1);

    const di = players[3]!;
    const view = delveResultSchema.parse((await get(di.cookie, '/api/delve')).json()).view;
    expect(view.prize).toEqual({ day: today - 1, place: 1, chest: 'gold' });
    expect(view.yesterday.map((r) => r.hero)).toEqual(['Di', 'Cy', 'Bo']);
    const claimed = await act(di.cookie, '/api/delve/claim');
    expect(claimed.loot.map((i) => i.base)).toEqual(['chest-gold']);
    expect(claimed.view.prize).toBeNull();
    expect((await post(di.cookie, '/api/delve/claim')).json().error).toBe('no_prize');
    expect((await post(players[0]!.cookie, '/api/delve/claim')).json().error).toBe('no_prize');
  });
});
