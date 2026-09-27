import type { Season } from '@prisma/client';
import type { OmenView } from '@dark/shared';
import { DAY_MS, OMEN_DEFS, type OmenDef, omenFor } from '@dark/engine';
import { prisma } from '../db.js';
import { broadcast } from './broadcast.js';
import { dayNumber } from './ledger.js';
import { dayRecap } from './recap.js';
import { onJob, schedule } from './scheduler.js';

// The day's Omen (docs/design.md → Omens): one for the whole server, from the
// Season's seed and the UTC day, so every Player sees the same one all day.

/** Today's Omen for a Season that is running, or null (a plain day, or no Season yet). */
export function omenOf(season: Pick<Season, 'seed' | 'status'>, now = new Date()): OmenDef | null {
  if (season.status !== 'ACTIVE' && season.status !== 'FINALE') return null;
  const id = omenFor(season.seed, dayNumber(now));
  return id ? OMEN_DEFS[id] : null;
}

export function omenView(season: Pick<Season, 'seed' | 'status'>, now = new Date()): OmenView | null {
  const omen = omenOf(season, now);
  return omen ? { id: omen.id, name: omen.name, description: omen.description } : null;
}

/** The next midnight UTC, when the next Omen is known. */
export const nextOmenAt = (now: Date): Date => new Date((dayNumber(now) + 1) * 86_400_000 + 60_000);

/**
 * At each midnight UTC: retell the past day on Discord, say the new Omen in the Feed
 * and on Discord, then wait for the next. The recap and the Omen go as two messages,
 * the Omen a second later so it lands underneath.
 */
onJob('omen', async (payload) => {
  const season = await prisma.season.findUnique({ where: { id: String(payload.seasonId) } });
  if (!season || (season.status !== 'ACTIVE' && season.status !== 'FINALE')) return;
  const now = new Date();
  const omen = omenOf(season, now);
  const midnight = dayNumber(now) * DAY_MS;
  await prisma.$transaction(async (tx) => {
    const recap = await dayRecap(tx, season, new Date(midnight - DAY_MS), new Date(midnight));
    if (recap) await broadcast(tx, recap, now);
    if (omen) {
      await tx.feedEvent.create({ data: { seasonId: season.id, kind: 'omen', data: { omen: omen.id } } });
      await broadcast(tx, {
        en: `🌘 Today's Omen in the Labyrinth: ${omen.name.en}. ${omen.description.en}`,
        ru: `🌘 Знамение дня в лабиринте: ${omen.name.ru}. ${omen.description.ru}`,
      }, new Date(now.getTime() + 1000));
    }
    await schedule(tx, 'omen', nextOmenAt(now), { seasonId: season.id });
  });
});
