import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, abilityModifier, check, createRng, doorsOf, generateLabyrinth, instantiate, monsterById } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { emptyOutcome, fight } from '../src/services/fights.js';
import { lockHero } from '../src/services/ledger.js';
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
/** A Move, and a fight with whatever stops the Hero in the doorway. */
async function walkIn(to: number) {
  const moved = await act('/api/labyrinth/move', { to });
  return moved.view.room?.facing ? act('/api/labyrinth/face', { action: 'fight' }) : moved;
}
/** Puts the test Hero's Bag in order: `base` × `quantity`. */
async function give(base: string, quantity: number) {
  const h = await hero();
  await prisma.item.create({ data: { heroId: h.id, seasonId: h.seasonId, base, place: 'BAG', quantity, tier: 'common', itemLevel: 1, identified: true } });
}

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
  await prisma.season.create({ data: { number: 0, seed: SEED, status: 'ACTIVE', startsAt: new Date() } });
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

  it('spends a Stamina per Move, stops at the monsters, and fights them when told', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const result = await act('/api/labyrinth/move', { to: fightNextToLanding });
    expect(result.view.hero.stamina).toBe(19);
    expect(result.fight).toBeNull();
    const facing = result.view.room!.facing!;
    expect(facing.kind).toBe('fight');
    expect(facing.monsters.length).toBeGreaterThan(0);
    expect(Object.keys(facing.threat).sort()).toEqual(['bold', 'steady', 'wary']);
    expect(facing.sneak).toMatchObject({ dc: 10 + 2 * (facing.monsters.length - 1), edge: 'disadvantage' });
    expect((await post('/api/labyrinth/move', { to: floor1.landing })).json().error).toBe('facing');

    // Sturdy enough that the fight can't end the test in the City.
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    const fought = await act('/api/labyrinth/face', { action: 'fight' });
    expect(fought.fight).not.toBeNull();
    expect(fought.fight!.monsters.map((m) => m.key)).toEqual(facing.monsters.map((m) => m.key));
    expect(fought.fight!.events.at(-1)).toEqual({ type: 'end', outcome: fought.fight!.outcome });
    expect(fought.view.room?.facing ?? null).toBeNull();
    expect(await prisma.rollLog.count({ where: { kind: 'fight' } })).toBe(1);
    expect((await post('/api/labyrinth/face', { action: 'fight' })).json().error).toBe('not_facing');
  });

  it('retreats for free to the last safe Room', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await act('/api/labyrinth/move', { to: fightNextToLanding });
    const back = await act('/api/labyrinth/face', { action: 'retreat' });
    expect(back.fight).toBeNull();
    expect(back.view.room).toMatchObject({ id: floor1.landing, facing: null });
    expect(back.view.hero.stamina).toBe(19);
    // The monsters are still there next time.
    expect((await act('/api/labyrinth/move', { to: fightNextToLanding })).view.room?.facing).not.toBeNull();
  });

  it('sneaks past on a good roll, and is ambushed on a bad one', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    // Nimble, light-footed and lucky with 1s: all but sure to get by.
    await prisma.item.deleteMany({ where: { base: 'chainmail' } });
    await prisma.hero.updateMany({ data: { dex: 30, race: 'halfling', maxHp: 999, hp: 999 } });
    let slipped = false;
    for (let i = 0; i < 5 && !slipped; i++) {
      await act('/api/labyrinth/move', { to: fightNextToLanding });
      const r = await act('/api/labyrinth/face', { action: 'sneak' });
      expect(r.checks).toHaveLength(1);
      slipped = r.fight === null;
      if (slipped) {
        expect(r.view.room).toMatchObject({ id: fightNextToLanding, facing: null, cleared: false });
        expect(r.checks[0]!.success).toBe(true);
      } else {
        await refill();
        await act('/api/labyrinth/move', { to: floor1.landing });
      }
    }
    expect(slipped).toBe(true);
    // Past them, the other Doors are open again.
    await refill();
    expect((await post('/api/labyrinth/move', { to: floor1.landing })).statusCode).toBe(200);

    // Clumsy: the monsters notice and strike first.
    await prisma.hero.updateMany({ data: { dex: 1, race: 'human' } });
    let ambushed = false;
    for (let i = 0; i < 10 && !ambushed; i++) {
      await refill();
      const h = await hero();
      if (h.room !== floor1.landing) await act('/api/labyrinth/move', { to: floor1.landing });
      await prisma.heroFloor.updateMany({ data: { cleared: {} } });
      await act('/api/labyrinth/move', { to: fightNextToLanding });
      const r = await act('/api/labyrinth/face', { action: 'sneak' });
      if (r.fight) {
        ambushed = true;
        expect(r.checks[0]!.success).toBe(false);
        expect(r.fight.events[1]).toEqual({ type: 'surprise', side: 'hero' });
      }
    }
    expect(ambushed).toBe(true);
    expect(await prisma.rollLog.count({ where: { kind: 'sneak' } })).toBeGreaterThan(1);
  });

  it('throws a Fire bomb before the fight, and a Smoke bomb makes sneaking sure', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    await act('/api/labyrinth/move', { to: fightNextToLanding });
    expect((await post('/api/labyrinth/face', { action: 'fight', bomb: true })).json().error).toBe('no_bomb');
    await give('bomb-fire', 2);
    await give('bomb-smoke', 1);
    const bombed = await act('/api/labyrinth/face', { action: 'fight', bomb: true });
    expect(bombed.fight!.events[1]).toMatchObject({ type: 'burst', actor: 'hero', source: 'bomb' });
    expect(bombed.view.hero.bombs).toEqual({ fire: 1, smoke: 1 });

    await prisma.heroFloor.updateMany({ data: { cleared: {} } });
    await refill();
    await act('/api/labyrinth/move', { to: floor1.landing });
    await act('/api/labyrinth/move', { to: fightNextToLanding });
    const smoked = await act('/api/labyrinth/face', { action: 'sneak', smoke: true });
    expect(smoked.fight).toBeNull();
    expect(smoked.checks).toHaveLength(0);
    expect(smoked.view.room?.facing ?? null).toBeNull();
    expect(smoked.view.hero.bombs).toEqual({ fire: 1, smoke: 0 });
  });

  it('loses carried gold for good to a thief that gets away', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    const player = await prisma.player.findFirstOrThrow();
    const season = await prisma.season.findFirstOrThrow();
    let stolen = 0;
    for (let i = 0; i < 40 && stolen === 0; i++) {
      await prisma.hero.updateMany({ data: { carriedGold: 100 } });
      const out = emptyOutcome();
      await prisma.$transaction(async (tx) => {
        const h = await lockHero(tx, player, season.id);
        await fight(tx, h, season, floor1, fightNextToLanding, 'fight', out, { monsters: [instantiate(monsterById('goblin-cutpurse'), 1, 'm0')], clears: false });
      });
      const fled = out.fight!.events.some((e) => e.type === 'fled');
      if (fled) {
        stolen = out.fight!.events.flatMap((e) => (e.type === 'power' && e.power === 'thief' ? [e.amount ?? 0] : []))[0]!;
        expect(out.notices.some((n) => n.en.includes(`${stolen}`))).toBe(true);
      }
    }
    expect(stolen).toBeGreaterThan(0);
    expect((await hero()).carriedGold).toBe(100 - stolen);
  });

  it('keeps the Stance the Player picks, and rates the Threat for each', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await act('/api/labyrinth/move', { to: fightNextToLanding });
    const wary = await act('/api/labyrinth/stance', { stance: 'wary' });
    expect(wary.view.hero.stance).toBe('wary');
    expect((await hero()).stance).toBe('wary');
    expect(wary.view.room?.facing?.threat.wary).toMatch(/^(trivial|easy|risky|dangerous|deadly)$/);
    expect((await post('/api/labyrinth/stance', { stance: 'reckless' })).statusCode).toBe(400);
  });

  it('refuses to move without Stamina, or through a wall', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const blocked = floor1.rooms.find((r) => !doorsOf(floor1, floor1.landing).some((d) => d.to === r.id) && r.id !== floor1.landing)!;
    expect((await post('/api/labyrinth/move', { to: blocked.id })).json().error).toBe('no_door');
    await prisma.hero.updateMany({ data: { stamina: 0, staminaAt: new Date() } });
    expect((await post('/api/labyrinth/move', { to: fightNextToLanding })).json().error).toBe('no_stamina');
  });

  it('walks to the stairs, goes down a Floor, and back up', async () => {
    // Strong as well as sturdy: a Mini-boss on the way must fall well inside the round limit.
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, str: 30, level: 10 } });
    await act('/api/labyrinth/enter', { floor: 1 });
    expect((await post('/api/labyrinth/ascend')).json().error).toBe('no_stairs_up');
    const stairs = floor1.rooms.find((r) => r.type === 'stairs')!;
    for (const step of path(floor1, floor1.landing, stairs.id)) {
      await refill();
      await walkIn(step);
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
    // Bold never runs, so the dice decide.
    await act('/api/labyrinth/stance', { stance: 'bold' });

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
      died = (await walkIn(fightNextToLanding)).died;
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
    // The monsters that killed the Hero guard its Grave.
    expect((await post(`/api/labyrinth/graves/${grave.id}/loot`)).json().error).toBe('facing');
    await act('/api/labyrinth/face', { action: 'fight' });
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

  it('shows a secret Door only to a Hero who spots it, and pays a hoard behind it once a week', async () => {
    const hidden = floor1.rooms.find((r) => r.type === 'hidden')!;
    const door = floor1.doors.find((d) => d.a === hidden.id || d.b === hidden.id)!;
    const outside = door.a === hidden.id ? door.b : door.a;
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { room: outside, prevRoom: outside, maxHp: 999, hp: 999 } });
    await prisma.heroFloor.updateMany({ data: { seen: { push: outside } } });
    const h = await hero();
    // The same daily WIS Check the server rolls (a human Fighter: no advantage).
    const day = Math.floor(Date.now() / 86_400_000);
    const spotted = check(createRng(`${h.id}:secret:1:${door.a}-${door.b}:${day}`), {
      modifier: abilityModifier(h.wis), dc: 14, edge: 'normal', rerollOnes: false,
    }).success;
    const here = labyrinthResultSchema.parse((await app.inject({ url: '/api/labyrinth', headers: { cookie } })).json());
    expect(here.view.exits.some((e) => e.to === hidden.id)).toBe(spotted);
    if (!spotted) expect((await post('/api/labyrinth/move', { to: hidden.id })).json().error).toBe('no_door');

    // Once the room has been found, the way stays open.
    await prisma.heroFloor.updateMany({ data: { seen: { push: hidden.id } } });
    await refill();
    const hoard = await act('/api/labyrinth/move', { to: hidden.id });
    expect(hoard.view.room?.type).toBe('hidden');
    expect(hoard.loot.length).toBeGreaterThanOrEqual(2);
    expect(await prisma.feedEvent.count({ where: { kind: 'hidden' } })).toBe(1);
    await refill();
    await act('/api/labyrinth/move', { to: outside }).catch(() => null);
    await prisma.hero.updateMany({ data: { room: outside, facing: false } });
    const again = await act('/api/labyrinth/move', { to: hidden.id });
    expect(again.loot).toHaveLength(0);
    expect(again.notices.some((n) => n.en.includes('fills again'))).toBe(true);
  });
});

