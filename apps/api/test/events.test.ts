import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type EventKind, type Floor, RIDDLES, createRng, doorsOf, generateLabyrinth, rollGear } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { gearData } from '../src/services/items.js';
import { devLogin, resetDatabase } from './helpers.js';

const SEED = 'events';
const lab = generateLabyrinth(SEED);

/** The first Room holding an event of this kind, with a neighbor to walk in from. */
function roomWith(kind: EventKind): { floor: Floor; room: number; from: number } {
  for (const floor of lab.floors) {
    for (const room of floor.rooms) {
      if (room.type !== 'event' || room.event !== kind) continue;
      const quiet = (type: string) => ['empty', 'camp', 'landing', 'stairs', 'waypoint', 'treasure'].includes(type);
      const door = doorsOf(floor, room.id).find((d) => d.door.kind === 'open' && floor.rooms[d.to]!.type === 'empty')
        ?? doorsOf(floor, room.id).find((d) => d.door.kind === 'open' && quiet(floor.rooms[d.to]!.type));
      if (door) return { floor, room: room.id, from: door.to };
    }
  }
  throw new Error(`no ${kind} room`);
}

let app: FastifyInstance;
let cookie: string;
let heroId: string;
let seasonId: string;

const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
async function act(payload: object) {
  const r = await post('/api/labyrinth/event', payload);
  if (r.statusCode !== 200) throw new Error(`${r.statusCode} ${r.body}`);
  return labyrinthResultSchema.parse(r.json());
}
async function view() {
  return labyrinthResultSchema.parse((await app.inject({ method: 'GET', url: '/api/labyrinth', headers: { cookie } })).json()).view;
}
const placeAt = (floor: number, room: number, extra: object = {}) =>
  prisma.hero.update({ where: { id: heroId }, data: { location: 'LABYRINTH', floor, room, prevRoom: room, stamina: 20, staminaAt: new Date(), ...extra } });
const hero = () => prisma.hero.findUniqueOrThrow({ where: { id: heroId } });
const bagGear = (tier: 'common' | 'uncommon' | 'rare' | 'epic', identified = true) =>
  prisma.item.create({ data: { ...gearData(rollGear(createRng(`${tier}-${Math.random()}`), { tier, itemLevel: 2, identified }), 'test'), seasonId, heroId, place: 'BAG' } });

async function makeHero(cls: 'fighter' | 'rogue') {
  cookie = await devLogin(app, cls, true);
  await post('/api/heroes/draft');
  const race = cls === 'rogue' ? 'halfling' : 'human';
  await post('/api/heroes', {
    name: cls === 'rogue' ? 'Pip' : 'Garrick', race, class: cls, talents: cls === 'rogue' ? ['alert'] : ['alert', 'tough'],
    portrait: cls === 'rogue' ? 'halfling-rogue-1' : 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
  heroId = (await prisma.hero.findFirstOrThrow({ where: { retiredAt: null, class: cls } })).id;
  await prisma.hero.update({ where: { id: heroId }, data: { maxHp: 500, hp: 500, level: 10 } });
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
  seasonId = (await prisma.season.create({ data: { number: 0, seed: SEED } })).id;
  await makeHero('fighter');
});

describe('Event rooms', () => {
  it('Three chests: hidden until one is picked, then all show, once a day', async () => {
    const { floor, room } = roomWith('three-chests');
    await placeAt(floor.number, room);
    const before = (await view()).room!.eventView!;
    expect(before).toMatchObject({ kind: 'three-chests', done: false });
    if (before.kind !== 'three-chests') throw new Error('kind');
    expect(before.chests.every((c) => c.content === null)).toBe(true);

    const r = await act({ action: 'pick', chest: 1 });
    const after = r.view.room?.eventView;
    if (after) {
      if (after.kind !== 'three-chests') throw new Error('kind');
      expect(after.chests.map((c) => c.picked)).toEqual([false, true, false]);
      expect(after.chests.every((c) => c.content !== null)).toBe(true);
      const content = after.chests[1]!.content!;
      if (content.kind === 'gold') expect(r.gold).toBeGreaterThanOrEqual(content.amount);
      if (content.kind === 'item') expect(r.loot).toHaveLength(1);
      if (content.kind === 'mimic') expect(r.fight?.monsters[0]?.name.en).toBe('Mimic');
    }
    expect((await post('/api/labyrinth/event', { action: 'pick', chest: 0 })).json().error).toBe('event_done');
  });

  it('the Shrine rolls a Check on screen and answers once', async () => {
    const { floor, room } = roomWith('shrine');
    await placeAt(floor.number, room);
    const r = await act({ action: 'pray' });
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0]!.dc).toBe(12);
    expect(r.notices).toHaveLength(1);
    expect((await post('/api/labyrinth/event', { action: 'pray' })).json().error).toBe('event_done');
    expect(await prisma.rollLog.count({ where: { kind: 'event' } })).toBe(1);
  });

  it('the Goblin gambler plays for carried gold, or an Item for one a Tier up', async () => {
    const { floor, room } = roomWith('gambler');
    await placeAt(floor.number, room, { carriedGold: 100 });
    expect((await post('/api/labyrinth/event', { action: 'bet-gold', amount: 500 })).json().error).toBe('not_enough_gold');
    const r = await act({ action: 'bet-gold', amount: 50 });
    expect(r.duel).not.toBeNull();
    expect((await hero()).carriedGold).toBe(r.duel!.win ? 150 : 50);
    expect((await post('/api/labyrinth/event', { action: 'bet-gold', amount: 10 })).json().error).toBe('event_done');

    await prisma.eventVisit.deleteMany();
    const item = await bagGear('uncommon');
    const bet = await act({ action: 'bet-item', itemId: item.id });
    expect(await prisma.item.findUnique({ where: { id: item.id } })).toBeNull();
    if (bet.duel!.win) expect(bet.loot[0]!.tier).toBe('rare');
    else expect(bet.loot).toHaveLength(0);
  });

  it('the Wandering merchant sells rare wares and pays double for yours', async () => {
    const { floor, room } = roomWith('merchant');
    await placeAt(floor.number, room, { carriedGold: 100_000 });
    const ev = (await view()).room!.eventView!;
    if (ev.kind !== 'merchant') throw new Error('kind');
    expect(ev.wares).toHaveLength(3);
    const bought = await act({ action: 'buy', ware: ev.wares[0]!.id });
    expect(bought.loot[0]!.name).toEqual(ev.wares[0]!.item.name);
    expect((await hero()).carriedGold).toBe(100_000 - ev.wares[0]!.price);
    expect((await post('/api/labyrinth/event', { action: 'buy', ware: ev.wares[0]!.id })).json().error).toBe('sold_out');

    const epic = await bagGear('epic');
    const sold = await act({ action: 'sell', itemId: epic.id });
    // A Radiant one (now and then) is worth half again as much.
    expect(sold.gold).toBe(Math.round(250 * 1.2 * (epic.radiant ? 1.5 : 1)) * 2);
  });

  it('the Trapped corridor springs once when walked into', async () => {
    const { floor, room, from } = roomWith('trapped-corridor');
    await placeAt(floor.number, from);
    const r = labyrinthResultSchema.parse((await post('/api/labyrinth/move', { to: room })).json());
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0]!.dc).toBeGreaterThan(11);
    expect((await hero()).hp).toBeLessThanOrEqual(500);
    await placeAt(floor.number, from);
    const again = labyrinthResultSchema.parse((await post('/api/labyrinth/move', { to: room })).json());
    expect(again.checks).toHaveLength(0);
  });

  it('the Cursed altar raises or destroys an offering, and refuses Epics', async () => {
    const { floor, room } = roomWith('cursed-altar');
    await placeAt(floor.number, room);
    const epic = await bagGear('epic');
    expect((await post('/api/labyrinth/event', { action: 'offer', itemId: epic.id })).json().error).toBe('too_precious');
    const item = await bagGear('uncommon');
    await act({ action: 'offer', itemId: item.id });
    const after = await prisma.item.findUnique({ where: { id: item.id } });
    if (after) {
      expect(after.tier).toBe('rare');
      expect(after.bonusStats).toHaveLength(2);
    }
  });

  it('the Locked cache needs a Key (or a Rogue) and holds two Items and gold', async () => {
    const { floor, room } = roomWith('locked-cache');
    await placeAt(floor.number, room);
    expect((await view()).room!.eventView).toMatchObject({ kind: 'locked-cache', canOpen: false, free: false });
    expect((await post('/api/labyrinth/event', { action: 'open' })).json().error).toBe('no_key');
    await prisma.item.create({ data: { seasonId, heroId, place: 'BAG', base: 'key-iron', tier: 'common', quantity: 1 } });
    const r = await act({ action: 'open' });
    expect(r.loot).toHaveLength(2);
    expect(r.gold).toBeGreaterThan(0);
    expect(await prisma.item.count({ where: { heroId, base: 'key-iron' } })).toBe(0);
  });

  it('Lockpicking is a Check that may give a Chest; Rogues get advantage', async () => {
    await resetDatabase();
    seasonId = (await prisma.season.create({ data: { number: 0, seed: SEED } })).id;
    await makeHero('rogue');
    const { floor, room } = roomWith('lockpicking');
    await placeAt(floor.number, room);
    const r = await act({ action: 'pick-lock' });
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0]!.dice.length).toBeGreaterThanOrEqual(2);
    if (r.checks[0]!.success) expect(r.loot[0]!.kind).toBe('chest');
    else expect(r.loot).toHaveLength(0);
  });

  it('only acts in the Event room the Hero stands in', async () => {
    const { floor, from } = roomWith('shrine');
    await placeAt(floor.number, from);
    expect((await post('/api/labyrinth/event', { action: 'pray' })).json().error).toBe('no_event');
  });

  it('the Fountain heals, rests, or sickens, once a day', async () => {
    const { floor, room } = roomWith('fountain');
    await placeAt(floor.number, room, { hp: 100 });
    const r = await act({ action: 'drink' });
    expect(r.checks).toHaveLength(1);
    const after = await hero();
    expect(after.hp === 100).toBe(false);
    expect((await post('/api/labyrinth/event', { action: 'drink' })).json().error).toBe('event_done');
  });

  it('the Prisoner wants a key, then thanks you or turns out to be a doppelganger', async () => {
    const { floor, room } = roomWith('prisoner');
    await placeAt(floor.number, room);
    expect((await view()).room!.eventView).toMatchObject({ kind: 'prisoner', canOpen: false, free: false });
    expect((await post('/api/labyrinth/event', { action: 'free' })).json().error).toBe('no_key');
    await prisma.item.create({ data: { heroId, seasonId, base: 'key-iron', place: 'BAG', quantity: 1, tier: 'common' } });
    const r = await act({ action: 'free' });
    expect(r.fight !== null || r.loot.length > 0).toBe(true);
    expect(await prisma.item.count({ where: { base: 'key-iron' } })).toBe(0);
  });

  it('the Library teaches or bites, with an INT Check on screen', async () => {
    const { floor, room } = roomWith('library');
    await placeAt(floor.number, room);
    const before = await hero();
    const r = await act({ action: 'read' });
    expect(r.checks).toHaveLength(1);
    const after = await hero();
    if (r.checks[0]!.success) expect(after.xp).toBeGreaterThan(before.xp);
    else expect(after.xp).toBe(before.xp);
  });

  it('the Riddling statue teaches a right answer and burns a wrong one, once a day', async () => {
    const { floor, room } = roomWith('riddle');
    await placeAt(floor.number, room);
    const asked = (await view()).room!.eventView!;
    if (asked.kind !== 'riddle') throw new Error('not a statue');
    expect(asked.answers).toHaveLength(3);
    expect(asked.right).toBeNull();
    const before = await hero();
    // Answer wrong on purpose: the true answer's text is the question's own riddle.
    const truth = RIDDLES.find((r) => r.question.en === asked.question.en)!.answer.en;
    const wrongChoice = asked.answers.findIndex((a) => a.en !== truth);
    const r = await act({ action: 'answer', choice: wrongChoice });
    expect((await hero()).hp).toBeLessThan(before.hp);
    const after = r.view.room!.eventView!;
    if (after.kind !== 'riddle') throw new Error('not a statue');
    expect(after).toMatchObject({ done: true, chosen: wrongChoice });
    expect(after.answers[after.right!]!.en).toBe(truth);
    expect((await post('/api/labyrinth/event', { action: 'answer', choice: 0 })).json().error).toBe('event_done');
  });

  it('the Bone pile pays an old adventurer’s purse, sometimes after a fight', async () => {
    const { floor, room } = roomWith('bone-pile');
    await placeAt(floor.number, room, { str: 30 });
    const r = await act({ action: 'search' });
    if (r.fight) expect(r.fight.events[1]).toEqual({ type: 'surprise', side: 'hero' });
    if (!r.fight || r.fight.outcome === 'victory') expect(r.gold).toBeGreaterThan(0);
  });

  it('the Goblin cookpot fills or sickens, with a CON Check on screen, once a day', async () => {
    const { floor, room } = roomWith('cookpot');
    expect(floor.number).toBeLessThanOrEqual(3);
    await placeAt(floor.number, room, { hp: 100, stamina: 5 });
    const r = await act({ action: 'eat' });
    expect(r.checks).toHaveLength(1);
    const after = await hero();
    if (r.checks[0]!.success) {
      expect(after.hp).toBeGreaterThan(100);
      expect(after.stamina).toBe(8);
    } else {
      expect(after.hp).toBeLessThan(100);
    }
    expect((await post('/api/labyrinth/event', { action: 'eat' })).json().error).toBe('event_done');
  });

  it('the Webbed body pays its purse, after a spider if the knife slips', async () => {
    const { floor, room } = roomWith('webbed-body');
    await placeAt(floor.number, room, { str: 30, dex: 30 });
    const r = await act({ action: 'cut' });
    expect(r.checks).toHaveLength(1);
    if (r.checks[0]!.success) expect(r.fight).toBeNull();
    else expect(r.fight!.monsters.map((m) => m.name.en)).toEqual(['Giant spider']);
    if (!r.fight || r.fight.outcome === 'victory') expect(r.gold).toBeGreaterThan(0);
  });

  it('the Sarcophagus gives up its grave goods, after its Mummy if the lid grinds', async () => {
    const { floor, room } = roomWith('sarcophagus');
    expect(floor.theme).toBe('crypts');
    await placeAt(floor.number, room, { str: 30, dex: 30 });
    const r = await act({ action: 'pry' });
    expect(r.checks).toHaveLength(1);
    if (r.checks[0]!.success) expect(r.fight).toBeNull();
    else expect(r.fight!.monsters.map((m) => m.name.en)).toEqual(['Mummy']);
    if (!r.fight || r.fight.outcome === 'victory') {
      expect(r.gold).toBeGreaterThan(0);
      expect(r.loot).toHaveLength(1);
    }
  });

  it('the Devil’s bargain takes the health it asked for, once a day, and never more than the Hero can spare', async () => {
    const { floor, room } = roomWith('bargain');
    expect(floor.theme).toBe('depths');
    await placeAt(floor.number, room, { hp: 400 });
    const offer = (await view()).room!.eventView!;
    if (offer.kind !== 'bargain') throw new Error('kind');
    expect(offer).toMatchObject({ done: false });
    expect(offer.itemPrice).toBeGreaterThan(offer.goldPrice);

    await placeAt(floor.number, room, { hp: offer.itemPrice });
    expect((await post('/api/labyrinth/event', { action: 'bargain', offer: 'item' })).json().error).toBe('too_weak');

    await placeAt(floor.number, room, { hp: 400 });
    const r = await act({ action: 'bargain', offer: 'gold' });
    expect(r.gold).toBe(offer.gold);
    expect((await hero()).hp).toBe(400 - offer.goldPrice);
    expect((await post('/api/labyrinth/event', { action: 'bargain', offer: 'item' })).json().error).toBe('event_done');
  });

  it('the Devil’s bargain: an Item of the Tier it showed', async () => {
    const { floor, room } = roomWith('bargain');
    await placeAt(floor.number, room, { hp: 400 });
    const offer = (await view()).room!.eventView!;
    if (offer.kind !== 'bargain') throw new Error('kind');
    const r = await act({ action: 'bargain', offer: 'item' });
    expect(r.loot).toHaveLength(1);
    expect(r.loot[0]!.tier).toBe(offer.tier);
    expect((await hero()).hp).toBe(400 - offer.itemPrice);
  });

  it('banishing the devil teaches XP, or it breaks the circle and fights', async () => {
    const { floor, room } = roomWith('bargain');
    await placeAt(floor.number, room, { wis: 30 });
    const r = await act({ action: 'banish' });
    expect(r.checks).toHaveLength(1);
    if (r.checks[0]!.success) {
      expect(r.fight).toBeNull();
      expect(r.xp).toBeGreaterThan(0);
    } else {
      expect(r.fight!.monsters.map((m) => m.name.en)).toEqual(['Chain devil']);
    }
  });
});

