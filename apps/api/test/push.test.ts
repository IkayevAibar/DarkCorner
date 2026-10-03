import { createECDH, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CAMP_REST_MS, STAMINA_MAX, STAMINA_REFILL_MS } from '@dark/engine';
import { pushViewSchema } from '@dark/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { pushSender, pushSweep } from '../src/services/push.js';
import { runDueJobs } from '../src/services/scheduler.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
/** The real sender, kept before the tests swap in a fake one. */
const realSend = pushSender.send;
let seasonId: string;
let sent: { endpoint: string; payload: { title: string; body: string; url: string; tag: string } }[];
/** Endpoints the fake push service says are gone for good. */
let gone: Set<string>;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const put = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'PUT', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

async function makeHero(name: string) {
  const cookie = await devLogin(app, name, true);
  await post(cookie, '/api/heroes/draft');
  const created = await post(cookie, '/api/heroes', { name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  const hero = await prisma.hero.findFirstOrThrow({ where: { name } });
  return { cookie, hero };
}

/** Turns notifications on for a device whose clock is in `timeZone`. */
async function device(cookie: string, endpoint: string, timeZone = 'UTC', locale: 'en' | 'ru' = 'en') {
  const response = await post(cookie, '/api/push/subscribe', { endpoint, keys: { p256dh: 'key', auth: 'auth' }, timeZone, locale });
  expect(response.statusCode).toBe(200);
  return pushViewSchema.parse(response.json());
}

/** Noon UTC on a fixed day: daytime for a device on UTC. */
const NOON = new Date('2026-10-02T12:00:00Z');

/** The push service, faked: it keeps what it is sent, and turns away the devices in `gone`. */
const fakeSend: typeof pushSender.send = async (sub, payload) => {
  if (gone.has(sub.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
  sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
};

beforeAll(async () => {
  app = await buildApp();
  pushSender.send = fakeSend;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  seasonId = (await prisma.season.create({ data: { number: 0, seed: 'push', status: 'ACTIVE', startsAt: new Date() } })).id;
  sent = [];
  gone = new Set();
});

describe('push notifications', () => {
  it('turn on and off per device, and keep the kinds a Player turned off', async () => {
    const { cookie } = await makeHero('Pip');
    const first = pushViewSchema.parse((await get(cookie, '/api/push')).json());
    expect(first.key.length).toBeGreaterThan(40);
    expect(first).toMatchObject({ off: [], devices: 0 });

    expect((await device(cookie, 'https://push.example/a')).devices).toBe(1);
    expect((await device(cookie, 'https://push.example/a')).devices).toBe(1);
    expect((await device(cookie, 'https://push.example/b', 'Asia/Almaty', 'ru')).devices).toBe(2);
    // A Player who never picked a language gets the one on screen.
    expect((await prisma.player.findFirstOrThrow()).locale).toBe('en');

    const prefs = pushViewSchema.parse((await put(cookie, '/api/push/prefs', { off: ['stamina', 'stamina', 'market'] })).json());
    expect(prefs.off).toEqual(['stamina', 'market']);
    expect((await put(cookie, '/api/push/prefs', { off: ['nonsense'] })).statusCode).toBe(400);

    const off = pushViewSchema.parse((await post(cookie, '/api/push/unsubscribe', { endpoint: 'https://push.example/a' })).json());
    expect(off.devices).toBe(1);

    expect((await post(cookie, '/api/push/test', { endpoint: 'https://push.example/b' })).json()).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.title).toBe('Dark Corner');
  });

  it('tell once when Stamina comes full, and not a Player who has been on since', async () => {
    const { cookie, hero } = await makeHero('Garrick');
    await device(cookie, 'https://push.example/a');
    // 5 Stamina short, spent long enough ago to be full by noon.
    const spentAt = new Date(NOON.getTime() - 6 * STAMINA_REFILL_MS);
    await prisma.hero.update({ where: { id: hero.id }, data: { stamina: STAMINA_MAX - 5, staminaAt: spentAt } });
    await prisma.player.updateMany({ data: { lastSeenAt: spentAt } });

    expect(await pushSweep(new Date(NOON.getTime() - 2 * STAMINA_REFILL_MS))).toBe(0);
    expect(await pushSweep(NOON)).toBe(1);
    expect(sent[0]!.payload).toMatchObject({ title: 'Stamina is full', url: '/labyrinth', tag: `stamina-${hero.id}` });
    expect(await pushSweep(new Date(NOON.getTime() + 60_000))).toBe(0);

    // Spent again: a new bar to fill, but the Player has been looking at the game since.
    await prisma.hero.update({ where: { id: hero.id }, data: { stamina: STAMINA_MAX - 1, staminaAt: NOON } });
    await prisma.player.updateMany({ data: { lastSeenAt: new Date(NOON.getTime() + 2 * STAMINA_REFILL_MS) } });
    expect(await pushSweep(new Date(NOON.getTime() + 3 * STAMINA_REFILL_MS))).toBe(0);
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).staminaPushAt).toEqual(new Date(NOON.getTime() + STAMINA_REFILL_MS));
  });

  it('wait out the night on the device, and skip a kind the Player turned off', async () => {
    const { cookie, hero } = await makeHero('Borin');
    await device(cookie, 'https://push.example/tokyo', 'Asia/Tokyo');
    await prisma.hero.update({ where: { id: hero.id }, data: { stamina: 0, staminaAt: new Date(NOON.getTime() - 9 * 60 * 60_000) } });
    // Last seen before the bar filled, whatever today's date: a Player seen since needs no word.
    await prisma.player.updateMany({ data: { lastSeenAt: new Date(NOON.getTime() - 9 * 60 * 60_000) } });
    const night = new Date('2026-10-02T17:00:00Z'); // 02:00 in Tokyo
    expect(await pushSweep(night)).toBe(0);
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).staminaPushAt).toBeNull();
    const morning = new Date('2026-10-02T23:30:00Z'); // 08:30 in Tokyo
    expect(await pushSweep(morning)).toBe(1);

    await prisma.hero.update({ where: { id: hero.id }, data: { stamina: 0, staminaAt: morning } });
    await put(cookie, '/api/push/prefs', { off: ['stamina'] });
    expect(await pushSweep(new Date(morning.getTime() + 9 * 60 * 60_000))).toBe(0);
    expect((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).staminaPushAt).not.toBeNull();
  });

  it('tell when a Camp rest is done and it gives something back, in the Player’s language', async () => {
    const { cookie, hero } = await makeHero('Ilyra');
    await device(cookie, 'https://push.example/a', 'UTC', 'ru');
    const campSince = new Date(NOON.getTime() - CAMP_REST_MS - 60_000);
    await prisma.hero.update({
      where: { id: hero.id },
      data: { location: 'LABYRINTH', floor: 3, room: 5, campSince, hp: 3, hpAt: campSince, stamina: 2, staminaAt: campSince },
    });
    await prisma.player.updateMany({ data: { lastSeenAt: campSince } });
    expect(await pushSweep(NOON)).toBe(1);
    expect(sent[0]!.payload.title).toBe('Отдых окончен');
    expect(sent[0]!.payload.body).toContain('этаже 3');
    // The same rest never twice, and the Stamina it filled is not news either.
    expect(await pushSweep(new Date(NOON.getTime() + 10 * 60 * 60_000))).toBe(0);

    // A rest that gives nothing back (all full already) passes quietly.
    const again = new Date(NOON.getTime() + 60_000);
    await prisma.hero.update({
      where: { id: hero.id },
      data: { campSince: again, hp: 9999, hpAt: again, stamina: STAMINA_MAX, staminaAt: again },
    });
    expect(await pushSweep(new Date(again.getTime() + CAMP_REST_MS + 60_000))).toBe(0);
  });

  it('encrypt and sign each message the way push services expect', async () => {
    const { cookie } = await makeHero('Pip');
    // A pretend push service on localhost that keeps what it receives.
    const received: { headers: Record<string, string | string[] | undefined>; body: Buffer }[] = [];
    const service = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks) });
        res.writeHead(201).end();
      });
    });
    await new Promise<void>((resolve) => service.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${(service.address() as AddressInfo).port}/send/device-1`;
    // The browser's side of the encryption: its key pair and auth secret.
    const browser = createECDH('prime256v1');
    browser.generateKeys();
    const authSecret = randomBytes(16);
    await post(cookie, '/api/push/subscribe', {
      endpoint, keys: { p256dh: browser.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') }, timeZone: 'UTC', locale: 'en',
    });

    pushSender.send = realSend;
    try {
      expect((await post(cookie, '/api/push/test', { endpoint })).json()).toEqual({ sent: true });
    } finally {
      pushSender.send = fakeSend;
      service.close();
    }
    const [message] = received;
    expect(String(message!.headers.authorization)).toMatch(/^vapid t=.+, k=.+$/);
    expect(message!.headers['content-encoding']).toBe('aes128gcm');
    expect(message!.headers.ttl).toBe(String(12 * 60 * 60));
    const ece = createRequire(import.meta.url)('http_ece') as { decrypt(body: Buffer, params: object): Buffer };
    const plain = ece.decrypt(message!.body, { version: 'aes128gcm', privateKey: browser, authSecret: authSecret.toString('base64url') });
    expect(JSON.parse(plain.toString('utf8'))).toMatchObject({ title: 'Dark Corner', url: '/city', tag: 'test' });
  });

  it('tell a seller about a Market sale, and forget a device the push service says is gone', async () => {
    const seller = await makeHero('Seller');
    const buyer = await makeHero('Buyer');
    await device(seller.cookie, 'https://push.example/seller');
    await device(seller.cookie, 'https://push.example/old-phone');
    gone.add('https://push.example/old-phone');
    const item = await prisma.item.create({ data: { seasonId, heroId: seller.hero.id, place: 'BAG', base: 'longsword', tier: 'rare', quantity: 1 } });
    const listed = (await post(seller.cookie, '/api/market/list', { itemId: item.id, price: 200 })).json();
    await prisma.hero.update({ where: { id: buyer.hero.id }, data: { gold: 1000 } });
    expect((await post(buyer.cookie, `/api/market/${listed.mine[0].id}/buy`)).statusCode).toBe(200);

    // Sent by a job, so only once the sale really happened; UTC devices are awake at any test hour but the night.
    await prisma.pushSubscription.updateMany({ data: { timeZone: awakeZone() } });
    await runDueJobs(new Date(Date.now() + 1000));
    expect(sent.map((s) => s.endpoint)).toEqual(['https://push.example/seller']);
    expect(sent[0]!.payload.body).toMatch(/^Buyer bought your .+ longsword for 200 gold\. \d+ gold is yours\.$/);
    expect(await prisma.pushSubscription.count()).toBe(1);
  });
});

/** A time zone where it is midday right now, so a test run at any hour finds the device awake. */
function awakeZone(): string {
  const hour = new Date().getUTCHours();
  const zones: [number, string][] = [
    [0, 'UTC'], [3, 'Europe/Moscow'], [5, 'Asia/Karachi'], [8, 'Asia/Shanghai'], [9, 'Asia/Tokyo'], [10, 'Australia/Brisbane'],
    [-5, 'America/Bogota'], [-8, 'Pacific/Pitcairn'], [-10, 'Pacific/Honolulu'], [12, 'Pacific/Auckland'], [-3, 'America/Sao_Paulo'],
  ];
  const [, zone] = zones.map(([offset, z]) => [Math.abs(((hour + offset + 24) % 24) - 13), z] as const).sort((a, b) => a[0] - b[0])[0]!;
  return zone;
}
