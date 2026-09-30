import webpush from 'web-push';
import type { Hero, Item, Player, PushSubscription } from '@prisma/client';
import type { Locale, LocalizedText, PushKind, PushView } from '@dark/shared';
import {
  CAMP_REST_MS, type ClassId, type PathId, SHORT_RESTS, STAMINA_MAX, STAMINA_REFILL_MS, currentStamina, recoveredHealth, restUses,
} from '@dark/engine';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { nextLocalHour } from '../lib/clock.js';
import { fullHealth } from './heroes.js';
import type { Tx } from './ledger.js';
import { onJob, schedule } from './scheduler.js';

// Push notifications to a Player's phone or browser (docs/design.md → Notifications).
// Two ways in: things that happen (a sale, the Boss gate) queue a 'push' job inside
// their transaction; things that come due with time (full Stamina, a Camp rest)
// are found by the 'push-sweep' job every few minutes.

/** One notification, in both languages; `tag` makes a newer one replace an older one on the device. */
export interface PushMessage {
  kind: PushKind;
  title: LocalizedText;
  body: LocalizedText;
  /** The screen tapping it opens. */
  url: string;
  tag: string;
}

// ─── Keys ─────────────────────────────────────────────────────────────────

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

/**
 * The server's VAPID key pair: from the environment when set there, otherwise
 * made once and kept in the Setting table, so a new deployment needs no setup.
 * Changing the keys stops every device's subscription working.
 */
export async function vapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cachedKeys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    return cachedKeys;
  }
  const made = webpush.generateVAPIDKeys();
  // Two first calls at once both make a pair; the first one stored wins.
  await prisma.setting.upsert({ where: { key: 'vapid' }, create: { key: 'vapid', value: { ...made } }, update: {} });
  const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'vapid' } });
  cachedKeys = row.value as unknown as VapidKeys;
  return cachedKeys;
}

/** Push services want a way to reach whoever runs the server: the game's own https address. */
const subject = (): string => (env.PUBLIC_WEB_URL.startsWith('https://') ? env.PUBLIC_WEB_URL : 'https://dark.ugolok.world');

// ─── Quiet hours ──────────────────────────────────────────────────────────

/** Nothing buzzes between 23:00 and 08:00 on the device's clock (v0). */
export const QUIET_FROM = 23;
export const QUIET_UNTIL = 8;

const zoneOf = (sub: Pick<PushSubscription, 'timeZone'>): string => sub.timeZone ?? env.SERVER_TIMEZONE;

function localHour(now: Date, zone: string): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', hour: '2-digit' }).format(now));
  } catch {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: env.SERVER_TIMEZONE, hourCycle: 'h23', hour: '2-digit' }).format(now));
  }
}

export function isQuiet(now: Date, zone: string): boolean {
  const hour = localHour(now, zone);
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}

// ─── Sending ──────────────────────────────────────────────────────────────

/**
 * How a message leaves the server: web-push encrypts it for the device and signs
 * it with the server's key, and fetch hands it to the device's push service.
 * Tests swap in their own. A refusal throws with the service's `statusCode`.
 */
export const pushSender = {
  async send(sub: Pick<PushSubscription, 'endpoint' | 'p256dh' | 'auth'>, payload: string): Promise<void> {
    const keys = await vapidKeys();
    const request = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
      // A notification that has waited half a day is no longer news.
      TTL: 12 * 60 * 60,
    });
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => name.toLowerCase() !== 'content-length').map(([name, value]) => [name, String(value)]));
    const response = await fetch(request.endpoint, { method: request.method, headers, body: request.body, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Object.assign(new Error(`the push service answered ${response.status}`), { statusCode: response.status });
  },
};

/** Sends one message to one device. A device that is gone (404, 410) is forgotten. */
async function deliver(sub: PushSubscription, locale: Locale, message: PushMessage): Promise<boolean> {
  const payload = JSON.stringify({ title: message.title[locale], body: message.body[locale], url: message.url, tag: message.tag });
  try {
    await pushSender.send(sub, payload);
    await prisma.pushSubscription.updateMany({ where: { id: sub.id }, data: { usedAt: new Date() } });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
    else console.error(`push to a device failed (${status ?? 'no status'})`, e instanceof Error ? e.message : e);
    return false;
  }
}

const localeOf = (player: Pick<Player, 'locale'>): Locale => (player.locale === 'ru' ? 'ru' : 'en');

/**
 * Queues a notification for one Player, inside the caller's transaction: it only
 * goes out if what it tells really happened, and a push service being down never
 * fails a Player's action.
 */
export async function notify(tx: Tx, playerId: string, message: PushMessage, at = new Date()): Promise<void> {
  const listening = await tx.player.count({ where: { id: playerId, pushSubs: { some: {} }, NOT: { pushOff: { has: message.kind } } } });
  if (listening > 0) await schedule(tx, 'push', at, { playerId, message: message as unknown as Record<string, unknown> });
}

/** The same notification for every Player who has a device and wants this kind; returns how many. */
export async function notifyAll(tx: Tx, message: PushMessage, at = new Date()): Promise<number> {
  const players = await tx.player.findMany({
    where: { pushSubs: { some: {} }, NOT: { pushOff: { has: message.kind } } },
    select: { id: true },
  });
  for (const p of players) await schedule(tx, 'push', at, { playerId: p.id, message: message as unknown as Record<string, unknown> });
  return players.length;
}

onJob('push', async (payload) => {
  const message = payload.message as PushMessage;
  const only = Array.isArray(payload.endpoints) ? (payload.endpoints as string[]) : null;
  const player = await prisma.player.findUnique({ where: { id: String(payload.playerId) }, include: { pushSubs: true } });
  if (!player || player.pushOff.includes(message.kind)) return;
  const now = new Date();
  // A device in its night gets the message at its own 08:00.
  const later = new Map<number, string[]>();
  for (const sub of player.pushSubs) {
    if (only && !only.includes(sub.endpoint)) continue;
    const zone = zoneOf(sub);
    if (!isQuiet(now, zone)) await deliver(sub, localeOf(player), message);
    else {
      const at = nextLocalHour(now, QUIET_UNTIL, zone).getTime();
      later.set(at, [...(later.get(at) ?? []), sub.endpoint]);
    }
  }
  if (later.size === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const [at, endpoints] of later) {
      await schedule(tx, 'push', new Date(at), { playerId: player.id, message: message as unknown as Record<string, unknown>, endpoints });
    }
  });
});

// ─── What comes due with time ─────────────────────────────────────────────

/** How often the sweep looks for full Stamina and finished Camp rests. */
export const SWEEP_MS = 5 * 60_000;

type SweepHero = Hero & { items: Item[]; player: Player & { pushSubs: PushSubscription[] } };

/** When the Hero's Stamina bar is (or will be) full, or null if it was full when last saved. */
export function staminaFullAt(hero: Pick<Hero, 'stamina' | 'staminaAt'>): Date | null {
  if (hero.stamina >= STAMINA_MAX) return null;
  return new Date(hero.staminaAt.getTime() + (STAMINA_MAX - hero.stamina) * STAMINA_REFILL_MS);
}

/** A finished Camp rest only earns a notification if it gives something back. */
function restHelps(hero: SweepHero, now: Date): boolean {
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  const full = fullHealth(hero);
  return (
    currentStamina(hero.stamina, hero.staminaAt, now).stamina < STAMINA_MAX ||
    recoveredHealth(hero.hp, full, hero.hpAt, now).hp < full ||
    hero.spellUses < uses.spells || hero.healUses < uses.heals || hero.shortRests < SHORT_RESTS
  );
}

const staminaMessage = (hero: Hero): PushMessage => ({
  kind: 'stamina',
  title: { en: 'Stamina is full', ru: 'Выносливость восстановлена' },
  body: {
    en: `${hero.name}: ${STAMINA_MAX} of ${STAMINA_MAX} Stamina. The Labyrinth waits.`,
    ru: `${hero.name}: выносливость ${STAMINA_MAX} из ${STAMINA_MAX}. Лабиринт ждёт.`,
  },
  url: '/labyrinth',
  tag: `stamina-${hero.id}`,
});

const campMessage = (hero: Hero): PushMessage => ({
  kind: 'camp',
  title: { en: 'Rested', ru: 'Отдых окончен' },
  body: {
    en: `${hero.name} has rested four hours in the Camp on Floor ${hero.floor}: health, abilities and Stamina are back.`,
    ru: `${hero.name}: четыре часа в лагере на этаже ${hero.floor} позади — здоровье, способности и выносливость восстановлены.`,
  },
  url: '/labyrinth',
  tag: `camp-${hero.id}`,
});

/** Sends to the Player's devices that are awake; false when every one of them is in its night. */
async function sendAwake(hero: SweepHero, message: PushMessage, now: Date): Promise<boolean> {
  const awake = hero.player.pushSubs.filter((s) => !isQuiet(now, zoneOf(s)));
  if (awake.length === 0) return false;
  for (const sub of awake) await deliver(sub, localeOf(hero.player), message);
  return true;
}

/**
 * Finds Heroes whose Stamina came full or whose Camp rest is done, and tells their
 * Players once each. A Player who has been on the site since then already knows,
 * and a Player whose devices are all asleep hears on a later sweep, in the morning.
 */
export async function pushSweep(now = new Date()): Promise<number> {
  const heroes: SweepHero[] = await prisma.hero.findMany({
    where: { retiredAt: null, season: { status: { in: ['ACTIVE', 'FINALE'] } }, player: { pushSubs: { some: {} } } },
    include: { items: true, player: { include: { pushSubs: true } } },
  });
  let sent = 0;
  for (const hero of heroes) {
    const seen = hero.player.lastSeenAt?.getTime() ?? 0;
    const wants = (kind: PushKind) => !hero.player.pushOff.includes(kind);

    // A finished Camp rest also fills Stamina, so it answers for both.
    const campSince = hero.location === 'LABYRINTH' ? hero.campSince : null;
    const restedAt = campSince ? campSince.getTime() + CAMP_REST_MS : null;
    if (campSince && restedAt! <= now.getTime() && hero.campPushAt?.getTime() !== campSince.getTime()) {
      const tell = wants('camp') && seen < restedAt! && restHelps(hero, now);
      if (tell && !(await sendAwake(hero, campMessage(hero), now))) continue;
      if (tell) sent++;
      await prisma.hero.update({ where: { id: hero.id }, data: { campPushAt: campSince, staminaPushAt: staminaFullAt(hero) } });
      continue;
    }

    const fullAt = staminaFullAt(hero);
    if (fullAt && fullAt <= now && hero.staminaPushAt?.getTime() !== fullAt.getTime()) {
      const tell = wants('stamina') && seen < fullAt.getTime();
      if (tell && !(await sendAwake(hero, staminaMessage(hero), now))) continue;
      if (tell) sent++;
      await prisma.hero.update({ where: { id: hero.id }, data: { staminaPushAt: fullAt } });
    }
  }
  return sent;
}

onJob('push-sweep', async (_payload, job) => {
  // The next sweep is queued first, so one that fails still leaves the chain running.
  await prisma.$transaction(async (tx) => {
    const others = await tx.job.count({ where: { kind: 'push-sweep', doneAt: null, attempts: { lt: 5 }, id: { not: job.id } } });
    if (others === 0) await schedule(tx, 'push-sweep', new Date(Date.now() + SWEEP_MS));
  });
  try {
    await pushSweep();
  } catch (e) {
    console.error('push sweep failed', e);
  }
});

/** Called as the API starts: makes sure exactly one sweep is waiting. */
export async function startPushSweep(): Promise<void> {
  const waiting = await prisma.job.findMany({
    where: { kind: 'push-sweep', doneAt: null, attempts: { lt: 5 } }, orderBy: { runAt: 'asc' }, select: { id: true },
  });
  if (waiting.length === 0) await prisma.job.create({ data: { kind: 'push-sweep', runAt: new Date() } });
  else if (waiting.length > 1) await prisma.job.deleteMany({ where: { id: { in: waiting.slice(1).map((j) => j.id) } } });
}

// ─── The Player's side ────────────────────────────────────────────────────

export async function pushView(player: Player): Promise<PushView> {
  const [keys, devices, fresh] = await Promise.all([
    vapidKeys(),
    prisma.pushSubscription.count({ where: { playerId: player.id } }),
    prisma.player.findUniqueOrThrow({ where: { id: player.id }, select: { pushOff: true } }),
  ]);
  return { key: keys.publicKey, off: fresh.pushOff as PushKind[], devices };
}

export async function subscribe(
  player: Player,
  body: { endpoint: string; keys: { p256dh: string; auth: string }; timeZone: string | null; locale: Locale },
): Promise<PushView> {
  const timeZone = body.timeZone && isZone(body.timeZone) ? body.timeZone : null;
  const data = { playerId: player.id, p256dh: body.keys.p256dh, auth: body.keys.auth, timeZone };
  // A device that changes hands (a shared tablet) follows whoever turned it on last.
  await prisma.pushSubscription.upsert({ where: { endpoint: body.endpoint }, create: { endpoint: body.endpoint, ...data }, update: data });
  // Notifications speak the language on screen, until the Player picks one.
  if (!player.locale) await prisma.player.update({ where: { id: player.id }, data: { locale: body.locale } });
  return pushView(player);
}

export async function unsubscribe(player: Player, endpoint: string): Promise<PushView> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, playerId: player.id } });
  return pushView(player);
}

export async function setPushPrefs(player: Player, off: PushKind[]): Promise<PushView> {
  await prisma.player.update({ where: { id: player.id }, data: { pushOff: [...new Set(off)] } });
  return pushView(player);
}

/** A notification right away to the device that asks, night or not: proof that it works. */
export async function testPush(player: Player, endpoint: string): Promise<{ sent: boolean }> {
  const sub = await prisma.pushSubscription.findFirst({ where: { endpoint, playerId: player.id } });
  if (!sub) return { sent: false };
  const fresh = await prisma.player.findUniqueOrThrow({ where: { id: player.id } });
  const sent = await deliver(sub, localeOf(fresh), {
    kind: 'stamina',
    title: { en: 'Dark Corner', ru: 'Тёмный уголок' },
    body: { en: 'Notifications are on. This is how they look.', ru: 'Уведомления включены. Вот так они выглядят.' },
    url: '/city',
    tag: 'test',
  });
  return { sent };
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
