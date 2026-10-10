// Ported from apps/api/test/labyrinth.test.ts: the same scenario, on the solo backend.
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Floor, abilityModifier, check, createRng, doorsOf, generateLabyrinth, instantiate, monsterById } from '@dark/engine';
import { labyrinthResultSchema, lodgingViewSchema } from '@dark/shared';
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
const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
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
  return moved.view.room?.facing ? act('/api/labyrinth/face', { action: 'fight', auto: true }) : moved;
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
    const fought = await act('/api/labyrinth/face', { action: 'fight', auto: true });
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

  it('heals a waiting Hero a little every hour, anywhere in the Labyrinth', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const full = (await hero()).maxHp;
    await prisma.hero.updateMany({ data: { hp: 1, hpAt: new Date(Date.now() - 10 * 60 * 60 * 1000 - 60_000), campSince: null } });
    const later = labyrinthResultSchema.parse((await app.inject({ url: '/api/labyrinth', headers: { cookie } })).json());
    expect(later.view.hero.hp).toBe(Math.min(full, 1 + Math.ceil(full * 0.05 * 10)));
    // Looking again straight away heals nothing more.
    const again = labyrinthResultSchema.parse((await app.inject({ url: '/api/labyrinth', headers: { cookie } })).json());
    expect(again.view.hero.hp).toBe(later.view.hero.hp);
  });

  it('starts a Camp’s rest when the Hero falls back into one', async () => {
    const camps = floor1.rooms.filter((r) => r.type === 'camp');
    const pair = camps.flatMap((c) => doorsOf(floor1, c.id)
      .filter(({ door, to }) => door.kind === 'open' && floor1.rooms[to]!.type === 'fight')
      .map(({ to }) => ({ camp: c.id, fight: to })))[0]!;
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { room: pair.camp, prevRoom: pair.camp, campSince: null } });
    await prisma.heroFloor.updateMany({ data: { seen: { push: pair.camp } } });
    await act('/api/labyrinth/move', { to: pair.fight });
    expect((await hero()).campSince).toBeNull();
    const back = await act('/api/labyrinth/face', { action: 'retreat' });
    expect(back.view.room).toMatchObject({ id: pair.camp, type: 'camp' });
    expect(back.view.room?.restedAt).not.toBeNull();
    expect((await hero()).campSince).not.toBeNull();
  });

  it('gives a full rest after four hours in a Camp: health, abilities, Stamina and both short rests', async () => {
    const camp = floor1.rooms.find((r) => r.type === 'camp')!.id;
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({
      data: {
        room: camp, prevRoom: camp, hp: 1, stamina: 0, staminaAt: new Date(), shortRests: 0, shortRestsAt: new Date(), spellUses: 0, healUses: 0,
        campSince: new Date(Date.now() - 3 * 3_600_000),
      },
    });
    // Three hours in: not yet, and the Camp says when.
    const waiting = labyrinthResultSchema.parse((await get('/api/labyrinth')).json());
    expect(waiting.view.hero.hp).toBe(1);
    expect(waiting.view.room?.restedAt).not.toBeNull();
    expect(waiting.notices).toHaveLength(0);

    await prisma.hero.updateMany({ data: { campSince: new Date(Date.now() - 4 * 3_600_000 - 1000) } });
    const rested = labyrinthResultSchema.parse((await get('/api/labyrinth')).json());
    expect(rested.view.hero.hp).toBe(rested.view.hero.maxHp);
    expect(rested.view.hero.stamina).toBe(20);
    expect(rested.view.hero.shortRests).toMatchObject({ left: 2, of: 2 });
    expect(rested.notices[0]?.en).toMatch(/^A full rest in the Camp/);
    // The next rest starts from now.
    expect(new Date(rested.view.room!.restedAt!).getTime()).toBeGreaterThan(Date.now() + 3.9 * 3_600_000);
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
      slipped = r.fight === null && r.view.fight === null;
      if (slipped) {
        expect(r.view.room).toMatchObject({ id: fightNextToLanding, facing: null, cleared: false });
        expect(r.checks[0]!.success).toBe(true);
      } else {
        // Spotted: the fight is on, played turn by turn; the Hero fights it out on its own.
        if (r.view.fight) await act('/api/labyrinth/fight', { action: { kind: 'auto' } });
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
      const fight = r.view.fight ?? r.fight;
      if (fight) {
        ambushed = true;
        expect(r.checks[0]!.success).toBe(false);
        expect(fight.events[1]).toEqual({ type: 'surprise', side: 'hero' });
        if (r.view.fight) await act('/api/labyrinth/fight', { action: { kind: 'auto' } });
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
    const bombed = await act('/api/labyrinth/face', { action: 'fight', bomb: true, auto: true });
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
    // Down to a new landing costs one; back up to stairs already known is free.
    expect(above.view.hero.stamina).toBe(19);
    // The Run remembers how deep it went, and every new Room on the way.
    expect((await hero()).run).toMatchObject({ deepest: 2, rooms: path(floor1, floor1.landing, stairs.id).length + 1 });
  });

  it('dies, leaves a Grave, wakes at the Temple, and can loot the Grave back', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.item.deleteMany({ where: { base: 'potion' } });
    // Bold never runs, so the dice decide.
    await act('/api/labyrinth/stance', { stance: 'bold' });

    // Fights won along the way drop Items into the Bag, so count what is carried each time.
    let carried = 0;
    let died = false;
    let last: Awaited<ReturnType<typeof walkIn>> | null = null;
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
      last = await walkIn(fightNextToLanding);
      died = last.died;
    }
    expect(died).toBe(true);
    expect(last!.run).toMatchObject({ died: true, deepest: 1 });
    expect(last!.run!.fights).toBeGreaterThan(last!.run!.won);

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
    await act('/api/labyrinth/face', { action: 'fight', auto: true });
    const looted = await act(`/api/labyrinth/graves/${grave.id}/loot`);
    expect(looted.loot.length).toBeGreaterThan(0);
    // Taking back your own things is no news.
    expect(await prisma.feedEvent.count({ where: { kind: 'grave-looted' } })).toBe(0);
  });

  it('tells the Feed when a Hero loots someone else’s Grave', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const h = await hero();
    const grave = await prisma.grave.create({
      data: { seasonId: h.seasonId, floor: 1, room: floor1.landing, ownerName: 'Pip', gold: 40, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await prisma.item.create({
      data: { graveId: grave.id, seasonId: h.seasonId, base: 'longsword', place: 'GRAVE', quantity: 1, tier: 'legendary', itemLevel: 3, identified: true },
    });

    const looted = await act(`/api/labyrinth/graves/${grave.id}/loot`);
    expect(looted.gold).toBe(40);
    const line = await prisma.feedEvent.findFirstOrThrow({ where: { kind: 'grave-looted' } });
    expect(line.data).toMatchObject({ hero: 'Garrick', owner: 'Pip', floor: 1, tier: 'legendary' });
    const tavern = (await app.inject({ url: '/api/tavern', headers: { cookie } })).json();
    expect(tavern.entries[0].text.en).toBe("Garrick looted Pip's Grave on Floor 1 (Legendary among the spoils)");
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

  it('leaves a Town Portal open for a day, to step back through once', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { room: fightNextToLanding, prevRoom: fightNextToLanding, facing: false } });
    const h = await hero();
    await prisma.item.create({ data: { heroId: h.id, seasonId: h.seasonId, base: 'scroll-portal', place: 'BAG', quantity: 1, tier: 'common' } });
    const home = await act('/api/labyrinth/portal');
    expect(home.view.location).toBe('city');
    expect(home.view.portal).toMatchObject({ floor: 1 });
    const back = await act('/api/labyrinth/enter', { portal: true });
    expect(back.view.room?.id).toBe(fightNextToLanding);
    expect(back.view.portal).toBeNull();
    await act('/api/labyrinth/leave').catch(() => null);
    await prisma.hero.updateMany({ data: { location: 'CITY', floor: null, room: null, portalFloor: 1, portalRoom: floor1.landing, portalUntil: new Date(Date.now() - 1000) } });
    expect((await post('/api/labyrinth/enter', { portal: true })).json().error).toBe('no_portal');
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

  it('shows a Warlock every secret Door (Devil’s sight)', async () => {
    const hidden = floor1.rooms.find((r) => r.type === 'hidden')!;
    const door = floor1.doors.find((d) => d.a === hidden.id || d.b === hidden.id)!;
    const outside = door.a === hidden.id ? door.b : door.a;
    await act('/api/labyrinth/enter', { floor: 1 });
    // Its WIS as low as it goes: no Check would spot the Door.
    await prisma.hero.updateMany({ data: { class: 'warlock', wis: 3, room: outside, prevRoom: outside, maxHp: 999, hp: 999 } });
    await prisma.heroFloor.updateMany({ data: { seen: { push: outside } } });
    const here = labyrinthResultSchema.parse((await app.inject({ url: '/api/labyrinth', headers: { cookie } })).json());
    expect(here.view.exits.some((e) => e.to === hidden.id)).toBe(true);
  });
});


describe('the Run summary', () => {
  it('sums up a Run on the way home: new Rooms, fights won, gold, Items, XP and the deepest Floor', async () => {
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999, str: 30, dex: 30 } });
    const entered = await act('/api/labyrinth/enter', { floor: 1 });
    expect(entered.run).toBeNull();
    await refill();
    const won = await walkIn(fightNextToLanding);
    expect(won.fight?.outcome).toBe('victory');
    expect(won.run).toBeNull();
    await refill();
    await act('/api/labyrinth/move', { to: floor1.landing });
    const carried = (await hero()).carriedGold;
    const home = await act('/api/labyrinth/leave');
    expect(home.run).toMatchObject({ rooms: 1, fights: 1, won: 1, gold: carried, items: won.loot.length, xp: won.xp, deepest: 1, died: false });
    expect(home.run!.levels.from).toBe(1);
    expect((await hero()).run).toBeNull();
  });

  it('ends a Run at a Town Portal, and starts a new one back through it', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const h = await hero();
    await prisma.item.create({ data: { heroId: h.id, seasonId: h.seasonId, base: 'scroll-portal', place: 'BAG', quantity: 1, tier: 'common' } });
    await prisma.hero.updateMany({ data: { carriedGold: 25 } });
    const home = await act('/api/labyrinth/portal');
    expect(home.run).toMatchObject({ rooms: 0, fights: 0, gold: 25, died: false });
    await act('/api/labyrinth/enter', { portal: true });
    expect((await hero()).run).toMatchObject({ rooms: 0, fights: 0, deepest: 1 });
  });
});

describe('walking back and resting', () => {
  it('walks back through known Rooms for free, unless something new waits there today', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.hero.updateMany({ data: { maxHp: 999, hp: 999 } });
    // A new Room costs one; Retreating out of it is free.
    expect((await act('/api/labyrinth/move', { to: fightNextToLanding })).view.hero.stamina).toBe(19);
    const back = await act('/api/labyrinth/face', { action: 'retreat' });
    expect(back.view.exits.find((e) => e.to === fightNextToLanding)).toMatchObject({ visited: true, free: false });
    // The monsters are still in there, so walking back in costs one again.
    expect((await walkIn(fightNextToLanding)).view.hero.stamina).toBe(18);
    expect((await act('/api/labyrinth/move', { to: floor1.landing })).view.hero.stamina).toBe(18);
    // Cleared today: free, even with no Stamina left; a new Room is not.
    await prisma.hero.updateMany({ data: { stamina: 0, staminaAt: new Date() } });
    expect((await act('/api/labyrinth/move', { to: fightNextToLanding })).view.room?.id).toBe(fightNextToLanding);
    const fresh = doorsOf(floor1, fightNextToLanding).find(({ door, to }) => door.kind === 'open' && to !== floor1.landing);
    if (fresh) expect((await post('/api/labyrinth/move', { to: fresh.to })).json().error).toBe('no_stamina');
  });

  it('shows each monster’s card: what it is and how hard it hits here', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    const facing = (await act('/api/labyrinth/move', { to: fightNextToLanding })).view.room!.facing!;
    expect(facing.foes.map((f) => f.key)).toEqual(facing.monsters.map((m) => m.key));
    for (const foe of facing.foes) {
      expect(foe.about.en.length).toBeGreaterThan(10);
      expect(foe.about.ru.length).toBeGreaterThan(10);
      expect(foe.attacks).toBeGreaterThanOrEqual(1);
      expect(foe.damage[0]).toBeGreaterThanOrEqual(1);
    }
  });

  it('rests twice a Run for half of full health and Stamina, and gets them back no sooner than 8 hours later', async () => {
    const entered = await act('/api/labyrinth/enter', { floor: 1 });
    expect(entered.view.hero.shortRests).toEqual({ left: 2, of: 2, backAt: null });
    expect((await post('/api/labyrinth/short-rest')).json().error).toBe('rested');
    await act('/api/labyrinth/move', { to: fightNextToLanding });
    expect((await post('/api/labyrinth/short-rest')).json().error).toBe('facing');
    await act('/api/labyrinth/face', { action: 'retreat' });

    await prisma.hero.updateMany({ data: { hp: 1, stamina: 3, staminaAt: new Date() } });
    const rested = await act('/api/labyrinth/short-rest');
    const full = rested.view.hero.maxHp;
    expect(rested.view.hero.hp).toBe(Math.min(full, 1 + Math.ceil(full / 2)));
    expect(rested.view.hero.stamina).toBe(13);
    expect(rested.view.hero.shortRests.left).toBe(1);
    expect(rested.notices[0]?.en).toMatch(/^A short rest: \+\d+ health, \+10 Stamina\.$/);
    await act('/api/labyrinth/short-rest');
    expect((await post('/api/labyrinth/short-rest')).json().error).toBe('no_short_rests');

    // Out at the gate and straight back in: they stay used.
    await act('/api/labyrinth/leave');
    const again = await act('/api/labyrinth/enter', { floor: 1 });
    expect(again.view.hero.shortRests.left).toBe(0);
    expect(again.view.hero.shortRests.backAt).not.toBeNull();
    // Eight hours after they last came back, the next Run brings them back.
    await prisma.hero.updateMany({ data: { shortRestsAt: new Date(Date.now() - 8 * 3_600_000) } });
    await act('/api/labyrinth/leave');
    expect((await act('/api/labyrinth/enter', { floor: 1 })).view.hero.shortRests).toEqual({ left: 2, of: 2, backAt: null });
  });

  it('sells one night a day at the Tavern for City gold, dearer each time', async () => {
    const lodging = (r: { json(): unknown }) => lodgingViewSchema.parse(r.json());
    const DAY = 86_400_000;
    await prisma.hero.updateMany({ data: { gold: 1000, stamina: 2, staminaAt: new Date(), shortRests: 0 } });
    expect(lodging(await get('/api/tavern/lodging'))).toMatchObject({ price: 50, nights: 0, stamina: 2, inCity: true, availableAt: null });
    const first = lodging(await post('/api/tavern/lodging'));
    expect(first).toMatchObject({ price: 80, nights: 1, gold: 950, stamina: 20, shortRests: { left: 2 } });
    // One night a day: the next from midnight UTC.
    expect(first.availableAt).toBe(new Date((Math.floor(Date.now() / DAY) + 1) * DAY).toISOString());
    await prisma.hero.updateMany({ data: { stamina: 0, staminaAt: new Date() } });
    expect((await post('/api/tavern/lodging')).json().error).toBe('lodged_today');

    // The next day the night costs more. Solo, a fully rested Hero may still take
    // it: a night is how the Day passes (the server refuses it as 'rested').
    await prisma.hero.updateMany({ data: { lodgedAt: new Date(Date.now() - DAY), stamina: 20, staminaAt: new Date() } });
    expect(lodging(await post('/api/tavern/lodging'))).toMatchObject({ price: 110, nights: 2, gold: 870 });

    // Only in the City, and only with the gold.
    await prisma.hero.updateMany({ data: { lodgedAt: null } });
    await act('/api/labyrinth/enter', { floor: 1 });
    expect((await post('/api/tavern/lodging')).json().error).toBe('not_in_city');
    await act('/api/labyrinth/leave');
    await prisma.hero.updateMany({ data: { gold: 10, stamina: 0, staminaAt: new Date() } });
    expect((await post('/api/tavern/lodging')).json().error).toBe('not_enough_gold');
  });

});

describe('Routes on the Map', () => {
  /** Rooms a Route can pass without anything stopping it once they are done for the day. */
  const QUIET = new Set(['landing', 'empty', 'fight', 'treasure', 'camp', 'waypoint', 'stairs']);
  /** The farthest Room from the landing over ordinary Doors and quiet Rooms, and the way there. */
  const far = (() => {
    const prev = new Map<number, number>([[floor1.landing, floor1.landing]]);
    const queue = [floor1.landing];
    for (let i = 0; i < queue.length; i++) {
      for (const { door, to } of doorsOf(floor1, queue[i]!)) {
        if (door.kind !== 'open' || prev.has(to) || !QUIET.has(floor1.rooms[to]!.type)) continue;
        prev.set(to, queue[i]!);
        queue.push(to);
      }
    }
    const goal = queue[queue.length - 1]!;
    const route: number[] = [];
    for (let cur = goal; cur !== floor1.landing; cur = prev.get(cur)!) route.unshift(cur);
    return route;
  })();
  /** The Hero has walked the Route before and done everything in it today. */
  async function known(rooms: number[], cleared = rooms) {
    const now = new Date().toISOString();
    await prisma.heroFloor.updateMany({
      data: { seen: [floor1.landing, ...rooms], cleared: Object.fromEntries(cleared.map((r) => [String(r), now])) },
    });
  }

  it('marks done Rooms with when they fill again, and walks a known Route for free', async () => {
    expect(far.length).toBeGreaterThanOrEqual(3);
    await act('/api/labyrinth/enter', { floor: 1 });
    await known(far);
    await refill();
    await prisma.hero.updateMany({ data: { stamina: 5, staminaAt: new Date() } });
    const look = labyrinthResultSchema.parse((await get('/api/labyrinth')).json()).view.map!;
    for (const id of far) {
      const room = look.rooms.find((r) => r.id === id)!;
      expect(room).toMatchObject({ visited: true, free: true });
      const lasts = ['fight', 'treasure'].includes(floor1.rooms[id]!.type);
      expect(room.cleared).toBe(lasts);
      if (lasts) expect(new Date(room.back!).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
      else expect(room.back).toBeNull();
    }
    expect(look.doors.every((d) => d.kind !== 'open' || (d.passable && !d.key))).toBe(true);

    const walked = await act('/api/labyrinth/walk', { route: far });
    expect(walked.view.room!.id).toBe(far[far.length - 1]);
    expect(walked.view.hero.stamina).toBe(5);
    // Only the goal speaks: a Camp passed on the way keeps quiet.
    const camps = far.slice(0, -1).filter((r) => floor1.rooms[r]!.type === 'camp').length;
    if (camps > 0) expect(walked.notices.length).toBeLessThanOrEqual(1);
  });

  it('stops where monsters are back, paying the Stamina that Room costs', async () => {
    const fightAt = far.findIndex((r) => floor1.rooms[r]!.type === 'fight');
    const route = fightAt >= 0 && fightAt < far.length - 1 ? far : [...path(floor1, floor1.landing, fightNextToLanding), floor1.landing];
    const stop = route.findIndex((r) => floor1.rooms[r]!.type === 'fight');
    await act('/api/labyrinth/enter', { floor: 1 });
    // Everything done but that fight Room: its monsters are back today.
    await known(route.filter((r) => r !== floor1.landing), route.filter((_, i) => i !== stop));
    await prisma.hero.updateMany({ data: { stamina: 5, staminaAt: new Date() } });
    const walked = await act('/api/labyrinth/walk', { route });
    expect(walked.view.room!.id).toBe(route[stop]);
    expect(walked.view.room!.facing).not.toBeNull();
    expect(walked.view.hero.stamina).toBe(4);
  });

  it('answers a first Door that leads nowhere as a move would, and stops before a later one', async () => {
    await act('/api/labyrinth/enter', { floor: 1 });
    await known(far);
    const nowhere = floor1.rooms.find((r) => !doorsOf(floor1, floor1.landing).some((d) => d.to === r.id) && r.id !== floor1.landing)!.id;
    expect((await post('/api/labyrinth/walk', { route: [nowhere] })).json().error).toBe('no_door');
    const unreachable = floor1.rooms.find((r) => !doorsOf(floor1, far[0]!).some((d) => d.to === r.id) && r.id !== far[0])!.id;
    const walked = await act('/api/labyrinth/walk', { route: [far[0]!, unreachable] });
    expect(walked.view.room!.id).toBe(far[0]);
    expect(walked.notices.map((n) => n.en)).toContain('The way on is shut: the walk stops here.');
    expect((await post('/api/labyrinth/walk', { route: [] })).statusCode).toBe(400);
  });

  it('tells which Doors this Hero gets through, and which cost an Iron key', async () => {
    // A known Room with a locked Door: a Fighter needs a key for it.
    const locked = floor1.rooms.find((r) => doorsOf(floor1, r.id).some(({ door }) => door.kind === 'locked'))!.id;
    await act('/api/labyrinth/enter', { floor: 1 });
    await prisma.heroFloor.updateMany({ data: { seen: [floor1.landing, locked] } });
    const lock = async () => labyrinthResultSchema.parse((await get('/api/labyrinth')).json()).view.map!.doors.find((d) => d.kind === 'locked')!;
    expect(await lock()).toMatchObject({ passable: false, key: true });
    await give('key-iron', 1);
    expect(await lock()).toMatchObject({ passable: true, key: true });
  });
});
