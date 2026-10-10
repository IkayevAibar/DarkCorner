import type { Season } from '@prisma/client';
import { BOSS_GATE_DAYS, DAY_MS } from '@dark/engine';
import type { Outcome } from './fights.js';
import type { Tx } from './ledger.js';

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
