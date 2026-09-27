import type { Hero, Prisma, Season } from '@prisma/client';
import type { Tx } from './ledger.js';

/**
 * A line for the Tavern's Feed: notable drops, deaths, Market sales, +10s. The
 * Feed screen and the Discord Broadcasts read these (docs/design.md → Feed and broadcasts).
 */
export async function feed(tx: Tx, season: Pick<Season, 'id'>, hero: Pick<Hero, 'playerId' | 'name'>, kind: string, data: Record<string, unknown>): Promise<void> {
  await tx.feedEvent.create({
    data: { seasonId: season.id, playerId: hero.playerId, kind, data: { hero: hero.name, ...data } as Prisma.InputJsonValue },
  });
}
