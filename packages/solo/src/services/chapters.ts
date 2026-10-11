import type { Item, Player, Prisma, Season } from '@prisma/client';
import type { HallEntry, LocalizedText } from '@dark/shared';
import { BOSS_GATE_DAYS, type ClassId, DAY_MS, type DeedCounts, type DeedMetric, type RaceId, type Tier, baseById, tierRank } from '@dark/engine';
import { prisma } from '../db.js';
import { gameNow, worldDay } from '../gameClock.js';
import { deedsDone, titleOf } from './deeds.js';
import type { Outcome } from './fights.js';
import { portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import type { Tx } from './ledger.js';
import { currentSeason } from './seasons.js';
import { hallView } from './tavern.js';

// Chapters (docs/plan-solo-offline.md → Chapters): a Labyrinth and its Boss. The
// server's Season, without its Finale and Wipe: the Boss gate opens on its day or
// when the Hero first reaches Floor 10, and the Dragon's fall ends the Chapter.

/** The Floor whose first visit opens the Boss gate, if its day hasn't come yet. */
export const GATE_FLOOR = 10;

const WEEK_MS = 7 * DAY_MS;

/**
 * When the Dragon's weakening counts from. The engine counts it from a Season's
 * start, four weeks before the gate; here the gate leads, since it can open early.
 */
export const weakeningFrom = (season: Pick<Season, 'startsAt' | 'bossGateAt'>): Date | null =>
  season.bossGateAt ? new Date(season.bossGateAt.getTime() - BOSS_GATE_DAYS * DAY_MS) : season.startsAt;

/**
 * The first time a Hero reaches Floor 10, the Boss gate opens if its day hasn't
 * come yet. The gate's job runs at once (for the Chronicle), and the steps of the
 * weakening move with the gate.
 */
export async function openGateEarly(tx: Tx, season: Season, now: Date, out: Outcome): Promise<void> {
  if (!season.bossGateAt || season.bossGateAt <= now) return;
  await tx.season.update({ where: { id: season.id }, data: { bossGateAt: now } });
  season.bossGateAt = now;
  for (const job of await tx.job.findMany({ where: { doneAt: null } })) {
    const payload = job.payload as { seasonId?: unknown; step?: unknown } | null;
    if (payload?.seasonId !== season.id) continue;
    if (job.kind === 'boss-gate') await tx.job.update({ where: { id: job.id }, data: { runAt: now } });
    if (job.kind === 'weaken') await tx.job.update({ where: { id: job.id }, data: { runAt: new Date(now.getTime() + (Number(payload.step) - 1) * WEEK_MS) } });
  }
  out.notices.push({
    en: 'Floor 10, at last. Far below, the Boss gate grinds open: the Ancient Dragon waits.',
    ru: 'Наконец 10-й этаж. Где-то внизу со скрежетом открываются врата босса: Древний дракон ждёт.',
  });
}

// ─── The Chapter's end ────────────────────────────────────────────────────

/**
 * The Chapter told whole, for its end screen: how it ended (once the Dragon has fallen),
 * what the Player's Heroes did in it, and its names in the Hall of Fame.
 */
export interface ChapterView {
  number: number;
  /** Today's Day. */
  day: number;
  /** The Dragon has fallen: the Chapter is complete. */
  complete: boolean;
  /** The Player has seen its end: it comes up once by itself, then waits in the Tavern. */
  seen: boolean;
  /** How it ended, once it has. */
  end: {
    /** The Day the Dragon fell. */
    day: number;
    /** The Champion, as it is now. */
    hero: { name: string; title: LocalizedText | null; class: ClassId; race: RaceId; portraitUrl: string; banner: string };
    /** The Champion's level when the Dragon fell. */
    level: number;
    /** Fights against the Dragon, the last one in. */
    tries: number;
    /** The Day the Boss gate opened. */
    gateDay: number | null;
  } | null;
  /** The Chapter in numbers: every Hero of the Player's together (a Companion's aside). */
  tally: {
    days: number;
    heroes: number;
    deepest: number;
    level: number;
    minibosses: number;
    rooms: number;
    banked: number;
    hoards: number;
    deaths: number;
    deeds: number;
    relics: number;
    legendary: number;
    finest: { name: LocalizedText; tier: Tier; upgrade: number } | null;
  };
  /** Its names in the Hall of Fame. */
  hall: HallEntry[];
}

/** Chapters whose end the Player has seen, in the World's Setting table. */
const SEEN = 'chapter-seen';

async function seenChapters(tx: Tx): Promise<number[]> {
  return ((await tx.setting.findUnique({ where: { key: SEEN } }))?.value as number[] | undefined) ?? [];
}

/** The finest Item the Heroes hold: the highest Tier, then the most Upgrades, then the deepest item level. */
function finestOf(items: Item[]): ChapterView['tally']['finest'] {
  const held = items.filter((i) => i.identified && ['WORN', 'BAG', 'STORAGE'].includes(i.place) && baseById(i.base).kind === 'gear');
  const score = (i: Item) => tierRank(i.tier as Tier) * 1_000_000 + i.upgrade * 1000 + i.itemLevel;
  const best = held.sort((a, b) => score(b) - score(a))[0];
  return best ? { name: toItemView(best).name, tier: best.tier as Tier, upgrade: best.upgrade } : null;
}

export async function chapterView(player: Player): Promise<ChapterView> {
  const season = await currentSeason();
  const now = gameNow();
  const heroes = await prisma.hero.findMany({ where: { seasonId: season.id, playerId: player.id }, include: { items: true }, orderBy: { createdAt: 'asc' } });
  const kill = await prisma.bossKill.findFirst({ where: { seasonId: season.id, place: 1 } });
  const champion = kill ? heroes.find((h) => h.id === kill.heroId) ?? await prisma.hero.findUnique({ where: { id: kill.heroId }, include: { items: true } }) : null;
  const entry = kill ? await prisma.hallEntry.findFirst({ where: { seasonNumber: season.number, kind: 'champion' } }) : null;
  const tries = kill
    ? await prisma.feedEvent.count({ where: { seasonId: season.id, playerId: kill.playerId, kind: 'boss-attempt', createdAt: { lte: kill.createdAt } } })
    : 0;
  const count = (metric: DeedMetric) => heroes.reduce((sum, h) => sum + ((h.deedCounts as DeedCounts | null)?.[metric] ?? 0), 0);
  const fell = kill ? worldDay(kill.createdAt.getTime()) : null;
  return {
    number: season.number,
    day: worldDay(now.getTime()),
    complete: kill !== null,
    seen: (await seenChapters(prisma)).includes(season.number),
    end: kill && champion ? {
      day: fell!,
      hero: {
        name: champion.name, title: titleOf(champion), class: champion.class as ClassId, race: champion.race as RaceId,
        portraitUrl: portraitUrlOf(champion), banner: champion.banner,
      },
      level: ((entry?.detail ?? {}) as { level?: number }).level ?? champion.level,
      tries: Math.max(1, tries),
      gateDay: season.bossGateAt && season.bossGateAt <= kill.createdAt ? Math.max(1, worldDay(season.bossGateAt.getTime())) : null,
    } : null,
    tally: {
      days: fell ?? worldDay(now.getTime()),
      heroes: heroes.length,
      deepest: Math.max(0, ...heroes.map((h) => h.bestFloor)),
      level: Math.max(0, ...heroes.map((h) => h.level)),
      minibosses: count('minibosses'),
      rooms: count('rooms'),
      banked: count('banked'),
      hoards: count('hidden'),
      deaths: await prisma.feedEvent.count({ where: { seasonId: season.id, playerId: player.id, kind: 'death' } }),
      deeds: heroes.reduce((sum, h) => sum + deedsDone(h), 0),
      relics: await prisma.relicFind.count({ where: { seasonId: season.id, playerId: player.id } }),
      legendary: count('legendary'),
      finest: finestOf(heroes.flatMap((h) => h.items)),
    },
    hall: (await hallView()).entries.filter((e) => e.season === season.number),
  };
}

/** The Player has seen this Chapter's end: it no longer comes up by itself. */
export async function chapterSeen(player: Player): Promise<ChapterView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const seen = await seenChapters(tx);
    if (seen.includes(season.number)) return;
    const value = [...seen, season.number] as unknown as Prisma.InputJsonValue;
    await tx.setting.upsert({ where: { key: SEEN }, create: { key: SEEN, value }, update: { value } });
  });
  return chapterView(player);
}
