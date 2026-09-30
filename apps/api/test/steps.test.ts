import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { STEPS } from '@dark/engine';
import { adminAnnounceResultSchema, stepClaimResultSchema, stepsViewSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let seasonId: string;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

async function makeHero(name: string, admin = true) {
  const cookie = await devLogin(app, name, admin);
  // A Player who isn't an admin waits at the gate until let in.
  if (!admin) await prisma.player.updateMany({ where: { username: name }, data: { approvedAt: new Date() } });
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  return { cookie, hero: await prisma.hero.findFirstOrThrow({ where: { name } }) };
}
const steps = async (cookie: string) => stepsViewSchema.parse((await get(cookie, '/api/steps')).json());
const count = async (heroId: string, base: string) =>
  (await prisma.item.aggregate({ where: { heroId, base }, _sum: { quantity: true } }))._sum.quantity ?? 0;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  seasonId = (await prisma.season.create({ data: { number: 0, seed: 'steps', status: 'ACTIVE', startsAt: new Date() } })).id;
});

describe('First steps', () => {
  it('start with nothing done, and read what the Hero has done since', async () => {
    const { cookie, hero } = await makeHero('Garrick');
    const fresh = await steps(cookie);
    expect(fresh.steps.map((s) => s.id)).toEqual(STEPS.map((s) => s.id));
    expect(fresh.steps.every((s) => !s.done && !s.claimed)).toBe(true);
    expect(fresh.ready).toBe(0);
    expect(fresh.steps[0]).toMatchObject({ reward: { en: 'Healing potion ×2', ru: 'Зелье лечения ×2' } });
    expect(fresh.steps.find((s) => s.id === 'waypoint')!.reward).toEqual({ en: '150 gold', ru: '150 золота' });

    await prisma.hero.update({
      where: { id: hero.id },
      data: { deedCounts: { 'kills-goblinoid': 2, banked: 40 }, level: 2, waypoints: [1], bestFloor: 3, path: 'champion' },
    });
    await prisma.delve.create({ data: { seasonId, playerId: hero.playerId, heroId: hero.id, day: 1, floor: 1, hp: 10, potions: 0, spellUses: 0, healUses: 0 } });
    const later = await steps(cookie);
    expect(later.steps.filter((s) => s.done).map((s) => s.id)).toEqual(['first-fight', 'bank-gold', 'level-2', 'waypoint', 'path', 'floor-3', 'delve']);
    expect(later.ready).toBe(7);
  });

  it('pay each reward once a Season, even to a new Hero after Retiring', async () => {
    const { cookie, hero } = await makeHero('Pip');
    expect((await post(cookie, '/api/steps/claim', { id: 'first-fight' })).json().error).toBe('step_not_done');
    await prisma.hero.update({ where: { id: hero.id }, data: { deedCounts: { 'kills-beast': 1 }, waypoints: [1] } });

    const potions = await count(hero.id, 'potion');
    const claimed = stepClaimResultSchema.parse((await post(cookie, '/api/steps/claim', { id: 'first-fight' })).json());
    expect(claimed.loot.map((i) => [i.base, i.quantity])).toEqual([['potion', 2]]);
    expect(await count(hero.id, 'potion')).toBe(potions + 2);
    expect(claimed.view.steps[0]).toMatchObject({ done: true, claimed: true });
    expect((await post(cookie, '/api/steps/claim', { id: 'first-fight' })).json().error).toBe('step_claimed');

    const gold = (await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold;
    expect(stepClaimResultSchema.parse((await post(cookie, '/api/steps/claim', { id: 'waypoint' })).json()).gold).toBe(150);
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).gold).toBe(gold + 150);
    expect((await post(cookie, '/api/steps/claim', { id: 'nonsense' })).json().error).toBe('no_step');

    // A new Hero in the same Season finds the claimed rewards already taken.
    expect((await post(cookie, '/api/heroes/retire')).statusCode).toBe(200);
    await post(cookie, '/api/heroes/draft');
    await post(cookie, '/api/heroes', { name: 'Pip Again', race: 'human', class: 'rogue', talents: ['alert', 'tough'], portrait: 'human-rogue-1', banner: '#9e2a2a', set: 0 });
    const second = await prisma.hero.findFirstOrThrow({ where: { name: 'Pip Again' } });
    await prisma.hero.update({ where: { id: second.id }, data: { deedCounts: { 'kills-beast': 1 } } });
    const view = await steps(cookie);
    expect(view.steps[0]).toMatchObject({ done: true, claimed: true });
    expect((await post(cookie, '/api/steps/claim', { id: 'first-fight' })).json().error).toBe('step_claimed');
  });
});

describe('announcements', () => {
  it('reach the Feed, Discord and the devices that want news, from an admin only', async () => {
    const owner = await makeHero('Owner');
    const friend = await makeHero('Friend', false);
    await prisma.pushSubscription.create({ data: { playerId: friend.hero.playerId, endpoint: 'https://push.example/f', p256dh: 'p', auth: 'a' } });
    await prisma.pushSubscription.create({ data: { playerId: owner.hero.playerId, endpoint: 'https://push.example/o', p256dh: 'p', auth: 'a' } });
    await prisma.player.updateMany({ where: { username: 'Owner' }, data: { pushOff: ['news'] } });

    const denied = await post(friend.cookie, '/api/admin/announce', { en: 'Hi', ru: 'Привет' });
    expect(denied.statusCode).toBe(403);

    const sent = adminAnnounceResultSchema.parse((await post(owner.cookie, '/api/admin/announce', { en: 'The Well is open!\nMore below.', ru: 'Колодец открыт!' })).json());
    expect(sent).toEqual({ discord: false, notified: 1 });
    const line = await prisma.feedEvent.findFirstOrThrow({ where: { kind: 'announcement' } });
    expect(line.data).toEqual({ en: 'The Well is open!\nMore below.', ru: 'Колодец открыт!' });
    const jobs = await prisma.job.findMany({ where: { kind: { in: ['push', 'broadcast'] } } });
    const posts = jobs.filter((j) => j.kind === 'broadcast').map((j) => (j.payload as { text: { en: string } }).text.en);
    expect(posts).toContain('📣 The Well is open!\nMore below.');
    const pushes = jobs.filter((j) => j.kind === 'push');
    expect(pushes).toHaveLength(1);
    expect((pushes[0]!.payload as { message: { body: { en: string } } }).message.body.en).toBe('The Well is open!');
    expect((await post(owner.cookie, '/api/admin/announce', { en: ' ', ru: 'x' })).statusCode).toBe(400);
  });
});
