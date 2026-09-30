import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type EventKind, type Floor, generateLabyrinth } from '@dark/engine';
import { labyrinthResultSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

/** A Labyrinth whose lair holds all three of its own events. */
const SEED = 'lair-4';
const lair: Floor = generateLabyrinth(SEED).floors[9]!;
const roomWith = (kind: EventKind) => lair.rooms.find((r) => r.type === 'event' && r.event === kind)!.id;
const boss = lair.rooms.find((r) => r.type === 'boss')!.id;

let app: FastifyInstance;
let cookie: string;
let heroId: string;

const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
async function act(payload: object) {
  const r = await post('/api/labyrinth/event', payload);
  if (r.statusCode !== 200) throw new Error(`${r.statusCode} ${r.body}`);
  return labyrinthResultSchema.parse(r.json());
}
async function view() {
  return labyrinthResultSchema.parse((await app.inject({ method: 'GET', url: '/api/labyrinth', headers: { cookie } })).json()).view;
}
const placeAt = (room: number, extra: object = {}) =>
  prisma.hero.update({ where: { id: heroId }, data: { location: 'LABYRINTH', floor: 10, room, prevRoom: room, stamina: 20, staminaAt: new Date(), ...extra } });
const hero = () => prisma.hero.findUniqueOrThrow({ where: { id: heroId } });

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
  heroId = (await prisma.hero.findFirstOrThrow({ where: { retiredAt: null } })).id;
  await prisma.hero.update({ where: { id: heroId }, data: { maxHp: 999, hp: 999, level: 16, str: 30, bestFloor: 10 } });
});

describe('the Dragon’s lair', () => {
  it('the Whispering skulls show the way to the Dragon’s chamber, or scream', async () => {
    await placeAt(roomWith('whispering-skulls'), { wis: 50 });
    const r = await act({ action: 'listen' });
    expect(r.checks).toHaveLength(1);
    const known = await prisma.heroFloor.findFirst({ where: { heroId, floor: 10 } });
    if (r.checks[0]!.success) {
      expect(r.xp).toBeGreaterThan(0);
      expect(known!.seen).toContain(boss);
    } else {
      expect((await hero()).hp).toBeLessThan(999);
      expect(known?.seen ?? []).not.toContain(boss);
    }
    expect((await post('/api/labyrinth/event', { action: 'listen' })).json().error).toBe('event_done');
  });

  it('the Spilled hoard shows its risks, and pays in gold, after the kin if they notice', async () => {
    await placeAt(roomWith('spilled-hoard'));
    const ev = (await view()).room!.eventView!;
    expect(ev).toMatchObject({ kind: 'spilled-hoard', done: false, risks: [{ handfuls: 1, percent: 20 }, { handfuls: 2, percent: 45 }, { handfuls: 3, percent: 70 }] });
    const r = await act({ action: 'grab', handfuls: 2 });
    if (r.fight) {
      expect(r.fight.monsters.map((m) => m.name.en)).toEqual(['Kobold', 'Kobold', 'Kobold']);
      expect(r.fight.events[1]).toEqual({ type: 'surprise', side: 'hero' });
    }
    if (!r.fight || r.fight.outcome === 'victory') expect(r.gold).toBeGreaterThanOrEqual(660);
  });

  it('the Fallen champion: buried, a Blessing; robbed, Epic gear or better, maybe after its bones', async () => {
    await placeAt(roomWith('fallen-champion'));
    const buried = await act({ action: 'bury' });
    expect(buried.notices.some((n) => n.en.startsWith('You lay the champion to rest'))).toBe(true);
    const blessed = await hero();
    expect(blessed.blessing).not.toBeNull();
    expect(blessed.blessingUntil!.getTime()).toBeGreaterThan(Date.now());

    await prisma.eventVisit.deleteMany();
    const taken = await act({ action: 'take' });
    if (taken.fight) expect(taken.fight.monsters.map((m) => m.name.en)).toEqual(['Bone knight']);
    if (!taken.fight || taken.fight.outcome === 'victory') {
      // The champion's gear comes last; a won fight may drop an Item of its own before it.
      expect(taken.loot.length).toBeGreaterThanOrEqual(1);
      expect(['epic', 'legendary', 'mythic']).toContain(taken.loot.at(-1)!.tier);
    }
  });
});
