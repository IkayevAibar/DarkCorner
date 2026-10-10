// Ported from apps/api/test/duo.test.ts: the same scenario, on the solo backend.
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth } from '@dark/engine';
import { duoStateSchema, labyrinthResultSchema } from '@dark/shared';
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
const duo = async (cookie: string, url = '/api/duo', payload?: object) => {
  const response = payload ? await post(cookie, url, payload) : url === '/api/duo' ? await get(cookie, url) : await post(cookie, url);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return duoStateSchema.parse(response.json());
};

async function makeHero(name: string, admin: boolean, cls = 'fighter') {
  const cookie = await devLogin(app, name, admin);
  if (!admin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: cls, talents: ['alert', 'tough'], portrait: `human-${cls}-1`, banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  // Seen just now: online.
  await get(cookie, '/api/duo');
  return { cookie, hero: await prisma.hero.findFirstOrThrow({ where: { name } }) };
}

/** Garrick and Mira, a Duo in the City. */
async function pair() {
  const a = await makeHero('Garrick', true);
  const b = await makeHero('Mira', false, 'cleric');
  const sent = await duo(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
  expect(sent.outgoing?.to.heroId).toBe(b.hero.id);
  const got = await duo(b.cookie);
  expect(got.incoming).toHaveLength(1);
  const joined = await duo(b.cookie, '/api/duo/accept', { inviteId: got.incoming[0]!.id });
  expect(joined.partner?.heroId).toBe(a.hero.id);
  return { a, b };
}
/** Heroes too sturdy to lose, so a fight's rewards can be checked. */
const sturdy = () => prisma.hero.updateMany({ data: { hp: 900, maxHp: 900, stamina: 20, staminaAt: new Date() } });

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

describe('Duos', () => {
  it('form from an invite to a Hero whose Player is online in the City', async () => {
    const a = await makeHero('Garrick', true);
    const b = await makeHero('Mira', false, 'cleric');
    const view = await duo(a.cookie);
    expect(view.candidates.map((c) => c.heroId)).toEqual([b.hero.id]);
    // Someone long gone can't be invited.
    await prisma.player.updateMany({ where: { username: 'Mira' }, data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
    expect((await post(a.cookie, '/api/duo/invite', { heroId: b.hero.id })).json()).toMatchObject({ error: 'they_are_away' });
    await get(b.cookie, '/api/duo');
    await duo(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
    const got = await duo(b.cookie);
    await duo(b.cookie, '/api/duo/accept', { inviteId: got.incoming[0]!.id });
    const [ha, hb] = await Promise.all([prisma.hero.findUniqueOrThrow({ where: { id: a.hero.id } }), prisma.hero.findUniqueOrThrow({ where: { id: b.hero.id } })]);
    expect(ha.partnerId).toBe(hb.id);
    expect(hb.partnerId).toBe(ha.id);
    expect(await prisma.duoInvite.count()).toBe(0);
    const seen = await look(a.cookie);
    expect(seen.view.duo).toMatchObject({ heroId: hb.id, name: 'Mira', class: 'cleric', online: true });
    expect(seen.notices.map((n) => n.en)).toContain('Mira joined you: you are a Duo now.');
  });

  it('enter and walk together, each Hero paying its own Stamina', async () => {
    const { a, b } = await pair();
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    const theirs = await look(b.cookie);
    expect(theirs.view.location).toBe('labyrinth');
    expect(theirs.view.room?.id).toBe(floor1.landing);
    expect(theirs.notices.map((n) => n.en)).toContain('Garrick leads the Duo into the Labyrinth.');

    const before = await prisma.hero.findMany({ orderBy: { name: 'asc' } });
    const moved = await act(a.cookie, '/api/labyrinth/move', { to: fightRoom });
    const after = await prisma.hero.findMany({ orderBy: { name: 'asc' } });
    for (const [i, h] of after.entries()) {
      expect(h.room).toBe(fightRoom);
      expect(h.facing).toBe(true);
      expect(h.stamina).toBe(before[i]!.stamina - 1);
    }
    // Both Players see the same monsters, rated with the partner alongside.
    expect(moved.view.room?.facing?.monsters.length).toBeGreaterThan(1);
    expect((await look(b.cookie)).view.room?.facing?.monsters.map((m) => m.key)).toEqual(moved.view.room?.facing?.monsters.map((m) => m.key));
  });

  it('wait for a partner who stepped away, and end by itself after half an hour', async () => {
    const { a, b } = await pair();
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    await sturdy();
    await prisma.player.updateMany({ where: { username: 'Mira' }, data: { lastSeenAt: new Date(Date.now() - 5 * 60_000) } });
    const refused = await post(a.cookie, '/api/labyrinth/move', { to: fightRoom });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'partner_away' });
    // Looking around never waits.
    expect((await look(a.cookie)).view.duo?.online).toBe(false);

    await prisma.player.updateMany({ where: { username: 'Mira' }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
    const alone = await act(a.cookie, '/api/labyrinth/move', { to: fightRoom });
    expect(alone.notices.map((n) => n.en)).toContain('Mira has been away too long: the Duo is over.');
    expect(alone.view.duo).toBeNull();
    const left = await prisma.hero.findUniqueOrThrow({ where: { id: b.hero.id } });
    expect(left.partnerId).toBeNull();
    expect(left.room).toBe(floor1.landing);
    expect((await look(b.cookie)).notices.map((n) => n.en)).toContain('You were away too long: the Duo with Garrick is over.');
  });

  it('go home together through the entrance, each with its own Run', async () => {
    const { a, b } = await pair();
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { carriedGold: 30 } });
    const home = await act(a.cookie, '/api/labyrinth/leave');
    expect(home.view.location).toBe('city');
    expect(home.run?.gold).toBe(30);
    const theirs = await look(b.cookie);
    expect(theirs.view.location).toBe('city');
    expect(theirs.run?.gold).toBe(30);
    expect(theirs.view.duo?.name).toBe('Garrick');
    const heroes = await prisma.hero.findMany();
    expect(heroes.map((h) => h.gold).every((g) => g >= 30)).toBe(true);
  });

  it('end when either Player leaves it, or reads a Town Portal', async () => {
    const { a, b } = await pair();
    await duo(b.cookie, '/api/duo/leave');
    expect((await look(a.cookie)).notices.map((n) => n.en)).toContain('Mira left the Duo: you go on alone.');
    expect(await prisma.hero.count({ where: { partnerId: { not: null } } })).toBe(0);

    const again = await duo(a.cookie, '/api/duo/invite', { heroId: b.hero.id });
    expect(again.outgoing).not.toBeNull();
    await duo(b.cookie, '/api/duo/accept', { inviteId: again.outgoing!.id });
    await act(a.cookie, '/api/labyrinth/enter', { floor: 1 });
    const h = await prisma.hero.findUniqueOrThrow({ where: { id: a.hero.id } });
    await prisma.item.create({ data: { heroId: h.id, seasonId: h.seasonId, base: 'scroll-portal', place: 'BAG', quantity: 1, tier: 'common', itemLevel: 1, identified: true } });
    await act(a.cookie, '/api/labyrinth/portal');
    const theirs = await look(b.cookie);
    expect(theirs.view.location).toBe('labyrinth');
    expect(theirs.view.duo).toBeNull();
    expect(theirs.notices.map((n) => n.en)).toContain('Garrick reads a Town Portal and steps home: the Duo is over, you go on alone.');
    // Alone again, the reader steps back through its portal.
    expect((await act(a.cookie, '/api/labyrinth/enter', { floor: 1, portal: true })).view.location).toBe('labyrinth');
  });
});
