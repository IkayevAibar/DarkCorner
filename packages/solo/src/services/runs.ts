import type { Prisma } from '@prisma/client';
import type { RunSummary } from '@dark/shared';
import { prisma } from '../db.js';
import type { Outcome } from './fights.js';
import { DbNull } from '../db.js';

// A Run's tally (CONTEXT.md → Run): kept on the Hero while it is in the Labyrinth,
// and summed up for the Player once the Run ends, back in the City or dead.

interface RunTally {
  startedAt: string;
  /** The Hero's level on the way in. */
  level: number;
  rooms: number;
  fights: number;
  won: number;
  items: number;
  xp: number;
  deepest: number;
}

/** A fresh tally, written as the Hero steps into the Labyrinth. */
export function newRun(level: number, floor: number, now: Date): Prisma.InputJsonObject {
  const run: RunTally = { startedAt: now.toISOString(), level, rooms: 0, fights: 0, won: 0, items: 0, xp: 0, deepest: floor };
  return { ...run };
}

/**
 * Adds what one action brought to the Hero's Run. When the action ended the Run
 * (home through a Waypoint or a portal, or a death), returns the summary and clears
 * the tally. A Hero who went in before tallies existed has none, and gets no summary.
 */
export async function tallyRun(heroId: string, out: Outcome, now: Date): Promise<RunSummary | null> {
  if (quiet(out)) return null;
  return prisma.$transaction(async (tx) => tallyRunIn(tx, heroId, out, now));
}

const quiet = (out: Outcome) => !out.fight && out.explored === 0 && out.depth === 0 && out.loot.length === 0 && out.xp === 0 && !out.runEnd;

/** The same, inside a transaction that may already hold the Hero (a Duo partner's side of an action). */
export async function tallyRunIn(tx: Prisma.TransactionClient, heroId: string, out: Outcome, now: Date): Promise<RunSummary | null> {
  if (quiet(out)) return null;
  await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${heroId} FOR UPDATE`;
  const hero = await tx.hero.findUniqueOrThrow({ where: { id: heroId }, select: { run: true, level: true } });
  const run = hero.run as RunTally | null;
  if (!run) return null;
  const next: RunTally = {
    ...run,
    rooms: run.rooms + out.explored,
    fights: run.fights + (out.fight ? 1 : 0),
    won: run.won + (out.fight?.outcome === 'victory' ? 1 : 0),
    items: run.items + out.loot.length,
    xp: run.xp + out.xp,
    deepest: Math.max(run.deepest, out.depth),
  };
  if (!out.runEnd) {
    await tx.hero.update({ where: { id: heroId }, data: { run: { ...next } } });
    return null;
  }
  await tx.hero.update({ where: { id: heroId }, data: { run: DbNull } });
  return {
    minutes: Math.max(0, Math.round((now.getTime() - Date.parse(run.startedAt)) / 60_000)),
    rooms: next.rooms,
    fights: next.fights,
    won: next.won,
    gold: out.runEnd.gold,
    items: next.items,
    xp: next.xp,
    levels: { from: run.level, to: hero.level },
    deepest: next.deepest,
    died: out.died,
  };
}
