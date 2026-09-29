import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth } from '@dark/engine';
import { heroResponseSchema, labyrinthResultSchema, myHeroResponseSchema, rankingsViewSchema, tavernViewSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let cookie: string;

/** A seed whose Floor 1 landing has a fight Room and an empty Room behind ordinary Doors. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const floor = generateLabyrinth(`deeds-${i}`).floors[0]!;
    const next = doorsOf(floor, floor.landing).filter(({ door }) => door.kind === 'open').map(({ to }) => floor.rooms[to]!.type);
    if (next.includes('fight') && next.includes('empty')) return `deeds-${i}`;
  }
})();
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const beside = (type: string) => doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === type)!.to;

const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
async function act(url: string, payload: object = {}) {
  const response = await post(url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return labyrinthResultSchema.parse(response.json());
}
const hero = () => prisma.hero.findFirstOrThrow({ where: { retiredAt: null } });
const myHero = async () => myHeroResponseSchema.parse((await get('/api/heroes/me')).json()).hero!;

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
  await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, str: 30, stamina: 20, staminaAt: new Date() } });
});

describe('Deeds and Titles', () => {
  it('counts new Rooms and kills, and shows every Deed with its progress', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await act('/api/labyrinth/move', { to: beside('empty') });
    await act('/api/labyrinth/move', { to: floor1.landing });
    const moved = await act('/api/labyrinth/move', { to: beside('fight') });
    const won = moved.view.room?.facing ? await act('/api/labyrinth/face', { action: 'fight' }) : moved;
    expect(won.fight?.outcome).toBe('victory');

    const view = await myHero();
    const byId = new Map(view.deeds.map((d) => [d.id, d]));
    expect(view.deeds.length).toBeGreaterThan(15);
    // The landing was known already; the empty Room and the fight Room were new.
    expect(byId.get('pathfinder')!.progress).toBe(2);
    const kills = ['goblin-bane', 'beast-hunter'].reduce((n, id) => n + byId.get(id)!.progress, 0);
    expect(kills).toBe(won.fight!.monsters.length);
    expect(view.deeds.every((d) => d.doneAt === null)).toBe(true);
    expect(view.title).toBeNull();
  });

  it('finishes a Deed: banks its gold, tells the Result and the Feed, and leaves a Title to wear', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { deedCounts: { rooms: 499 } } });
    const before = (await hero()).gold;
    const moved = await act('/api/labyrinth/move', { to: beside('empty') });
    expect(moved.notices.map((n) => n.en)).toContain('Deed done: Pathfinder. +500 gold, and a Title to wear.');
    expect((await hero()).gold).toBe(before + 500);
    const line = await prisma.feedEvent.findFirstOrThrow({ where: { kind: 'deed' } });
    expect(line.data).toMatchObject({ hero: 'Garrick', deed: 'pathfinder' });
    const tavern = tavernViewSchema.parse((await get('/api/tavern')).json());
    expect(tavern.entries[0]!.text.en).toBe('Garrick earned the Title “Pathfinder”');

    // Only a done Deed's Title can be worn.
    expect((await post('/api/heroes/title', { deed: 'dragonslayer' })).json().error).toBe('deed_not_done');
    const worn = heroResponseSchema.parse((await post('/api/heroes/title', { deed: 'pathfinder' })).json()).hero;
    expect(worn.title).toBe('pathfinder');
    expect(worn.deeds.find((d) => d.id === 'pathfinder')!.doneAt).not.toBeNull();

    // Others see it: in the Tavern and on the Rankings, where Deeds have a board of their own.
    const online = tavernViewSchema.parse((await get('/api/tavern')).json()).online;
    expect(online[0]!.title?.en).toBe('Pathfinder');
    const boards = rankingsViewSchema.parse((await get('/api/tavern/rankings')).json()).boards;
    const deeds = boards.find((b) => b.kind === 'deeds')!;
    expect(deeds.rows[0]).toMatchObject({ hero: 'Garrick', value: 1, title: { en: 'Pathfinder', ru: 'Следопыт' } });

    // And it can be taken off again; a Deed is only ever paid once.
    expect(heroResponseSchema.parse((await post('/api/heroes/title', { deed: null })).json()).hero.title).toBeNull();
    await act('/api/labyrinth/move', { to: floor1.landing });
    expect(await prisma.feedEvent.count({ where: { kind: 'deed' } })).toBe(1);
  });

  it('counts the deepest Floor from the Hero’s own record', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { bestFloor: 10 } });
    const moved = await act('/api/labyrinth/move', { to: beside('empty') });
    expect(moved.notices.map((n) => n.en)).toContain('Deed done: Deep delver. +1000 gold, and a Title to wear.');
    expect((await myHero()).deeds.find((d) => d.id === 'deep-delver')).toMatchObject({ progress: 10, target: 10 });
  });

  it('counts gold brought home', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { carriedGold: 120 } });
    await act('/api/labyrinth/leave');
    expect((await myHero()).deeds.find((d) => d.id === 'moneybags')!.progress).toBe(120);
  });
});
