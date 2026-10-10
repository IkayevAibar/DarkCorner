import type { Prisma, Season } from '@prisma/client';
import type { SeasonView } from '@dark/shared';
import {
  BOSS_GATE_DAYS, FINALE_MS, RELICS, VAULT_ANNOUNCE_CHANCE, VAULT_MIN_HEROES, VAULT_OPEN_HOUR, bossGateAt, createRng, weakeningAt,
  weakeningDates,
} from '@dark/engine';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { atLocalHour, nextLocalHour } from '../lib/clock.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { broadcast } from './broadcast.js';
import { labyrinthFor } from './labyrinth.js';
import type { Tx } from './ledger.js';
import { lockSeason, relicsFound } from './relics.js';
import { onJob, schedule } from './scheduler.js';
import { nextOmenAt, omenView } from './omens.js';
import { notifyAll } from './push.js';
import { currentSeason } from './seasons.js';
import { gameNow } from '../gameClock.js';

// The Season's life (docs/design.md → Seasons): an admin starts it, jobs open the
// Boss gate, weaken the Boss and announce Vaults, the first Boss kill starts the
// Finale, and the Wipe ends it.

const VAULT_PLAN_HOUR = 12;

/**
 * Solo: the server's raw `UPDATE "Job" … WHERE payload->>'seasonId' = …`, over the
 * in-memory Job table: changes the Season's jobs that are not done yet.
 */
async function updateSeasonJobs(tx: Tx, seasonId: string, which: (kind: string) => boolean, data: Prisma.JobUpdateManyMutationInput): Promise<void> {
  const open = await tx.job.findMany({ where: { doneAt: null } });
  const ids = open.filter((j) => (j.payload as { seasonId?: unknown } | null)?.seasonId === seasonId && which(j.kind)).map((j) => j.id);
  if (ids.length > 0) await tx.job.updateMany({ where: { id: { in: ids } }, data });
}

export async function seasonView(season: Season, now = gameNow()): Promise<SeasonView> {
  const [kills, found] = await Promise.all([
    prisma.bossKill.findMany({ where: { seasonId: season.id }, orderBy: { place: 'asc' } }),
    relicsFound(prisma, season.id),
  ]);
  const players = await prisma.player.findMany({ where: { id: { in: kills.map((k) => k.playerId) } } });
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? (p.globalName ?? p.username) : '?';
  };
  const copies = RELICS.reduce((s, r) => s + (r.copies ?? 1), 0);
  return {
    number: season.number,
    status: season.status.toLowerCase() as SeasonView['status'],
    startsAt: season.startsAt?.toISOString() ?? null,
    bossGateAt: season.bossGateAt?.toISOString() ?? null,
    wipeAt: season.finaleAt ? new Date(season.finaleAt.getTime() + FINALE_MS).toISOString() : null,
    weakening: weakeningAt(season.startsAt, now),
    podium: kills.map((k) => ({ place: k.place, hero: k.heroName, player: nameOf(k.playerId), at: k.createdAt.toISOString() })),
    relicsLeft: copies - Object.values(found).reduce((s, n) => s + n, 0),
    omen: omenView(season, now),
  };
}

/** Starts the planned Season: the clock begins, and its jobs are scheduled. */
export async function startSeason(now = gameNow()): Promise<Season> {
  const season = await currentSeason();
  return prisma.$transaction(async (tx) => {
    await lockSeason(tx, season.id);
    const fresh = await tx.season.findUniqueOrThrow({ where: { id: season.id } });
    if (fresh.status !== 'PLANNED') throw ApiError.conflict('season_running', 'This Season has already started');
    const gate = bossGateAt(now);
    const started = await tx.season.update({ where: { id: season.id }, data: { status: 'ACTIVE', startsAt: now, bossGateAt: gate } });
    await schedule(tx, 'boss-gate', gate, { seasonId: season.id });
    for (const [i, at] of weakeningDates(now).entries()) await schedule(tx, 'weaken', at, { seasonId: season.id, step: i + 1 });
    await schedule(tx, 'vault-plan', nextLocalHour(now, VAULT_PLAN_HOUR, env.SERVER_TIMEZONE), { seasonId: season.id });
    await schedule(tx, 'omen', nextOmenAt(now), { seasonId: season.id });
    await broadcast(tx, {
      en: `🕯️ Season ${season.number} of Dark Corner begins! The Labyrinth is open. The Boss gate opens on day ${BOSS_GATE_DAYS}.`,
      ru: `🕯️ Начинается сезон ${season.number} «Тёмного уголка»! Лабиринт открыт. Врата босса откроются на ${BOSS_GATE_DAYS}-й день.`,
    });
    return started;
  });
}

/** Opens the Boss gate now (for testing, or to hurry a slow Season). */
export async function openGateNow(now = gameNow()): Promise<void> {
  const season = await currentSeason();
  if (season.status === 'PLANNED' || season.status === 'ENDED') throw ApiError.conflict('season_not_running', 'The Season is not running');
  await prisma.$transaction(async (tx) => {
    await tx.season.update({ where: { id: season.id }, data: { bossGateAt: now } });
    await updateSeasonJobs(tx, season.id, (kind) => kind === 'boss-gate', { runAt: now });
  });
}

/**
 * The Wipe: the podium and records go to the Hall of Fame and the Season ends.
 * Heroes and Items stay in the database with their old Season, which nothing
 * reads any more; the next Season starts empty. Safe to run twice.
 */
export async function endSeason(seasonId: string, now = gameNow()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.status === 'ENDED') return;
    await recordRecords(tx, season);
    await tx.season.update({ where: { id: seasonId }, data: { status: 'ENDED', endedAt: now } });
    await updateSeasonJobs(tx, seasonId, (kind) => kind !== 'broadcast', { doneAt: now });
    await broadcast(tx, {
      en: `🌑 Season ${season.number} is over. Everything is wiped; only Glory remains. A new Season begins soon.`,
      ru: `🌑 Сезон ${season.number} окончен. Всё стёрто — остаётся только слава. Скоро новый сезон.`,
    });
  });
}

/**
 * Ends a test Season and forgets it: no Hall of Fame entries, and its number
 * moves below zero, so the next Season takes the number it had (docs/plan-season-0.md,
 * week 6: the test season is wiped before Season 0 starts).
 */
export async function discardSeason(seasonId: string, now = gameNow()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.status === 'PLANNED') throw ApiError.conflict('season_not_running', 'Only a started Season can be discarded');
    const lowest = await tx.season.findFirst({ orderBy: { number: 'asc' } });
    const number = Math.min(-1, (lowest?.number ?? 0) - 1);
    await tx.hallEntry.deleteMany({ where: { seasonNumber: season.number } });
    await tx.season.update({ where: { id: seasonId }, data: { status: 'ENDED', endedAt: season.endedAt ?? now, number } });
    await updateSeasonJobs(tx, seasonId, (kind) => kind !== 'broadcast', { doneAt: now });
  });
}

/** Records for the Hall of Fame at the Wipe: the deepest Floor and the highest level. */
async function recordRecords(tx: Tx, season: Season): Promise<void> {
  const heroes = await tx.hero.findMany({ where: { seasonId: season.id }, include: { player: true } });
  if (heroes.length === 0) return;
  const deepest = [...heroes].sort((a, b) => b.bestFloor - a.bestFloor || a.createdAt.getTime() - b.createdAt.getTime())[0]!;
  const highest = [...heroes].sort((a, b) => b.level - a.level || b.xp - a.xp)[0]!;
  const entry = (kind: string, h: (typeof heroes)[number], detail: Record<string, unknown>) => tx.hallEntry.create({
    data: {
      seasonNumber: season.number, kind, playerId: h.playerId, playerName: h.player.globalName ?? h.player.username,
      heroName: h.name, detail: detail as Prisma.InputJsonValue,
    },
  });
  await entry('deepest', deepest, { floor: deepest.bestFloor });
  await entry('highest-level', highest, { level: highest.level });

  // The best drop: the highest Tier anyone found (Relics have their own entries).
  const finds = await tx.feedEvent.findMany({ where: { seasonId: season.id, kind: { in: ['drop', 'chest'] } }, orderBy: { id: 'asc' } });
  const rank = (d: unknown) => ['legendary', 'mythic'].indexOf(String((d as { tier?: string }).tier));
  const best = finds.filter((f) => rank(f.data) >= 0).sort((a, b) => rank(b.data) - rank(a.data))[0];
  const finder = best && heroes.find((h) => h.playerId === best.playerId);
  if (best && finder) {
    const d = best.data as { tier: string; base: string };
    await entry('best-drop', finder, { tier: d.tier, base: d.base });
  }
}

/**
 * Announces a Vault on a Floor at least two Heroes have reached, opening at 21:00
 * game time today (or in `minutes`, for testing). Returns null when no Floor qualifies.
 */
export async function announceVault(season: Season, now = gameNow(), minutes?: number): Promise<{ floor: number; opensAt: Date } | null> {
  const heroes = await prisma.hero.findMany({ where: { seasonId: season.id, retiredAt: null }, select: { bestFloor: true } });
  // With fewer Heroes than that (a test server), one is enough.
  const need = Math.max(1, Math.min(VAULT_MIN_HEROES, heroes.length));
  const floors: number[] = [];
  for (let f = 1; f <= 10; f++) if (heroes.filter((h) => h.bestFloor >= f).length >= need) floors.push(f);
  if (floors.length === 0) return null;
  const rng = createRng(newSeed());
  const floorNumber = rng.pick(floors);
  const floor = labyrinthFor(season).floors[floorNumber - 1]!;
  const vaults = floor.rooms.filter((r) => r.type === 'vault');
  if (vaults.length === 0) return null;
  const room = rng.pick(vaults);
  const opensAt = minutes !== undefined ? new Date(now.getTime() + minutes * 60_000) : atLocalHour(now, VAULT_OPEN_HOUR, env.SERVER_TIMEZONE);
  if (opensAt <= now && minutes === undefined) return null;
  const at = opensAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: env.SERVER_TIMEZONE });
  await prisma.$transaction(async (tx) => {
    await tx.vaultOpening.create({ data: { seasonId: season.id, floor: floorNumber, room: room.id, opensAt } });
    await tx.feedEvent.create({ data: { seasonId: season.id, kind: 'vault-announced', data: { floor: floorNumber, opensAt: opensAt.toISOString() } } });
    await broadcast(tx, {
      en: `🗝️ A sealed Vault on Floor ${floorNumber} opens today at ${at} (game time). The first Hero in takes everything.`,
      ru: `🗝️ Запечатанная сокровищница на этаже ${floorNumber} откроется сегодня в ${at} по игровому времени. Всё достанется первому.`,
    });
  });
  return { floor: floorNumber, opensAt };
}

// ─── Jobs ─────────────────────────────────────────────────────────────────

async function liveSeason(seasonId: unknown): Promise<Season | null> {
  const season = await prisma.season.findUnique({ where: { id: String(seasonId) } });
  return season && (season.status === 'ACTIVE' || season.status === 'FINALE') ? season : null;
}

onJob('boss-gate', async (payload) => {
  const season = await liveSeason(payload.seasonId);
  if (!season) return;
  await prisma.$transaction(async (tx) => {
    await tx.feedEvent.create({ data: { seasonId: season.id, kind: 'gate-open', data: {} } });
    await broadcast(tx, {
      en: '🔥 The Boss gate is open! The Ancient Dragon waits on Floor 10.',
      ru: '🔥 Врата босса открыты! Древний дракон ждёт на 10-м этаже.',
    });
    await notifyAll(tx, {
      kind: 'gate',
      title: { en: 'The Boss gate is open', ru: 'Врата босса открыты' },
      body: { en: 'The Ancient Dragon waits on Floor 10.', ru: 'Древний дракон ждёт на 10-м этаже.' },
      url: '/labyrinth',
      tag: 'gate',
    });
  });
});

onJob('weaken', async (payload) => {
  const season = await liveSeason(payload.seasonId);
  if (!season) return;
  const percent = Math.round(weakeningAt(season.startsAt, gameNow()) * 100);
  await prisma.$transaction(async (tx) => {
    await tx.feedEvent.create({ data: { seasonId: season.id, kind: 'weaken', data: { percent } } });
    await broadcast(tx, {
      en: `🩸 The Ancient Dragon weakens: −${percent}% health and damage.`,
      ru: `🩸 Древний дракон слабеет: −${percent}% здоровья и урона.`,
    });
  });
});

onJob('wipe', async (payload) => {
  await endSeason(String(payload.seasonId));
});

onJob('vault-plan', async (payload) => {
  const season = await liveSeason(payload.seasonId);
  if (!season) return;
  const now = gameNow();
  if (createRng(newSeed()).chance(VAULT_ANNOUNCE_CHANCE)) await announceVault(season, now);
  await prisma.$transaction((tx) => schedule(tx, 'vault-plan', nextLocalHour(now, VAULT_PLAN_HOUR, env.SERVER_TIMEZONE), { seasonId: season.id }));
});
