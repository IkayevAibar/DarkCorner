import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, doorsOf, generateLabyrinth } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let cookie: string;

/** A seed whose Floor 1 landing has a fight Room behind an ordinary Door. */
const SEED = (() => {
  for (let i = 0; ; i++) {
    const floor = generateLabyrinth(`test-${i}`).floors[0]!;
    if (doorsOf(floor, floor.landing).some(({ door, to }) => door.kind === 'open' && floor.rooms[to]!.type === 'fight')) return `test-${i}`;
  }
})();
const floor1: Floor = generateLabyrinth(SEED).floors[0]!;
const fightNextToLanding = doorsOf(floor1, floor1.landing).find(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')!.to;

const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
async function act(url: string, payload: object = {}) {
  const response = await post(url, payload);
  if (response.statusCode !== 200) throw new Error(`${url} → ${response.statusCode} ${response.body}`);
  return labyrinthResultSchema.parse(response.json());
}
const hero = () => prisma.hero.findFirstOrThrow({ where: { retiredAt: null } });
/** Stamina never runs out in these tests unless a test wants it to. */
const refill = async () => prisma.hero.updateMany({ data: { stamina: 20, staminaAt: new Date() } });

/** Shortest path over ordinary Doors, for walking the test Hero somewhere. */
function path(floor: Floor, from: number, to: number): number[] {
  const prev = new Map<number, number>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const { door, to: next } of doorsOf(floor, cur)) {
      if (door.kind === 'open' && !prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  const steps: number[] = [];
  for (let cur = to; cur !== from; cur = prev.get(cur)!) steps.unshift(cur);
  return steps;
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
  await prisma.season.create({ data: { number: 0, seed: SEED } });
  cookie = await devLogin(app, 'Owner', true);
  await post('/api/heroes/draft');
  await post('/api/heroes', { name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
});

describe('the Labyrinth', () => {
  it('starts in the City and enters at the Floor 1 landing', async () => {
    const before = await act('/api/labyrinth/enter', { floor: 1 });
    expect(before.view).toMatchObject({ location: 'labyrinth', floor: { number: 1 }, room: { id: floor1.landing, type: 'landing' } });
    expect(before.view.exits.length).toBeGreaterThan(0);
    for (const exit of before.view.exits) expect(exit.clue.en.length).toBeGreaterThan(3);
    expect((await post('/api/labyrinth/enter', { floor: 1 })).json().error).toBe('already_inside');
  });

  it('refuses Waypoints not yet reached', async () => {
    expect((await post('/api/labyrinth/enter', { floor: 3 })).json().error).toBe('no_waypoint');
  });

  it('spends a Stamina per Move and fights what waits there', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const result = await act('/api/labyrinth/move', { to: fightNextToLanding });
    expect(result.view.hero.stamina).toBe(19);
    expect(result.fight).not.toBeNull();
    expect(result.fight!.events.at(-1)).toEqual({ type: 'end', outcome: result.fight!.outcome });
    expect(await prisma.rollLog.count({ where: { kind: 'fight' } })).toBe(1);
  });

  it('refuses to move without Stamina, or through a wall', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const blocked = floor1.rooms.find((r) => !doorsOf(floor1, floor1.landing).some((d) => d.to === r.id) && r.id !== floor1.landing)!;
    expect((await post('/api/labyrinth/move', { to: blocked.id })).json().error).toBe('no_door');
    await prisma.hero.updateMany({ data: { stamina: 0, staminaAt: new Date() } });
    expect((await post('/api/labyrinth/move', { to: fightNextToLanding })).json().error).toBe('no_stamina');
  });

  it('walks to the stairs, goes down a Floor, and back up', async () => {
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    await act('/api/labyrinth/enter', { floor: 1 });
    expect((await post('/api/labyrinth/ascend')).json().error).toBe('no_stairs_up');
    const stairs = floor1.rooms.find((r) => r.type === 'stairs')!;
    for (const step of path(floor1, floor1.landing, stairs.id)) {
      await refill();
      await act('/api/labyrinth/move', { to: step });
    }
    await refill();
    const below = await act('/api/labyrinth/descend');
    expect(below.view.floor?.number).toBe(2);
    expect(below.view.bestFloor).toBe(2);

    const above = await act('/api/labyrinth/ascend');
    expect(above.view.floor?.number).toBe(1);
    expect(above.view.room).toMatchObject({ id: stairs.id, type: 'stairs' });
    expect(above.view.hero.stamina).toBe(18);
  });

  it('dies, leaves a Grave, wakes at the Temple, and can loot the Grave back', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.item.deleteMany({ where: { base: 'potion' } });

    // Fights won along the way drop Items into the Bag, so count what is carried each time.
    let carried = 0;
    let died = false;
    for (let attempt = 0; attempt < 60 && !died; attempt++) {
      const h = await hero();
      if (h.room !== floor1.landing) {
        await refill();
        await act('/api/labyrinth/move', { to: floor1.landing });
      }
      await prisma.hero.updateMany({ data: { hp: 1, deathless: false } });
      await prisma.heroFloor.updateMany({ data: { cleared: {} } });
      await refill();
      carried = await prisma.item.count({ where: { place: { in: ['WORN', 'BAG'] } } });
      died = (await act('/api/labyrinth/move', { to: fightNextToLanding })).died;
    }
    expect(died).toBe(true);

    const h = await hero();
    expect(h).toMatchObject({ location: 'CITY', hp: h.maxHp, carriedGold: 0 });
    const grave = await prisma.grave.findFirstOrThrow({ include: { items: true } });
    expect(grave).toMatchObject({ floor: 1, room: fightNextToLanding, ownerName: 'Garrick' });
    expect(grave.items).toHaveLength(carried);
    // A fresh Starter kit: three pieces worn and potions in the Bag.
    expect(await prisma.item.count({ where: { heroId: h.id, place: 'WORN' } })).toBe(3);

    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    await act('/api/labyrinth/enter', { floor: 1 });
    await refill();
    const there = await act('/api/labyrinth/move', { to: fightNextToLanding });
    expect(there.view.graves).toHaveLength(1);
    const looted = await act(`/api/labyrinth/graves/${grave.id}/loot`);
    expect(looted.loot.length).toBeGreaterThan(0);
  });

  it('leaves from the entrance with the gold carried, fully healed', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { carriedGold: 37, hp: 3 } });
    const home = await act('/api/labyrinth/leave');
    expect(home.view.location).toBe('city');
    const h = await hero();
    expect(h.gold).toBe(100 + 37);
    expect(h.hp).toBe(h.maxHp);
  });

  it('keeps Storage in the City', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const potion = await prisma.item.findFirstOrThrow({ where: { base: 'potion' } });
    const response = await post(`/api/items/${potion.id}/move`, { to: 'storage' });
    expect(response.json().error).toBe('storage_in_city');
  });
});
