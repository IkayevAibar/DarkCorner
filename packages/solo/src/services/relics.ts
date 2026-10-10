import type { Prisma, Season } from '@prisma/client';
import { createRng, pickRelic, rollGear } from '@dark/engine';
import { newSeed } from '../lib/seed.js';
import { broadcast } from './broadcast.js';
import { countDeeds } from './deeds.js';
import { feed } from './feed.js';
import type { Outcome } from './fights.js';
import { gearData, toItemView } from './items.js';
import type { HeroWithItems, Tx } from './ledger.js';

/** Serials and Hall of Fame names are handed out one at a time: the Season row is the lock. */
export async function lockSeason(tx: Tx, seasonId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Season" WHERE id = ${seasonId} FOR UPDATE`;
}

export async function playerName(tx: Tx, playerId: string): Promise<string> {
  const p = await tx.player.findUnique({ where: { id: playerId } });
  return p ? (p.globalName ?? p.username) : '?';
}

/** How many copies of each Relic design are out this Season. */
export async function relicsFound(tx: Tx | Prisma.TransactionClient, seasonId: string): Promise<Record<string, number>> {
  const rows = await tx.relicFind.groupBy({ by: ['uniqueId'], where: { seasonId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.uniqueId, r._count._all]));
}

/**
 * A Relic for the Hero, if any copy is left: numbered, identified on the spot,
 * with its first owner written in. It goes into the Bag even when the Bag is
 * full, because a Relic is never left behind. Recorded in the Hall of Fame and
 * Broadcast (docs/design.md → Relics).
 */
export async function grantRelic(tx: Tx, hero: HeroWithItems, season: Season, floor: number, source: string, out: Outcome): Promise<boolean> {
  await lockSeason(tx, season.id);
  const seed = newSeed();
  const rng = createRng(seed);
  const relic = pickRelic(rng, await relicsFound(tx, season.id));
  if (!relic) return false;
  const serial = ((await relicsFound(tx, season.id))[relic.id] ?? 0) + 1;
  const roll = rollGear(rng, { tier: 'relic', itemLevel: Math.max(1, floor), uniqueId: relic.id, identified: true });
  const item = await tx.item.create({
    data: {
      ...gearData(roll, seed), seasonId: season.id, heroId: hero.id, place: 'BAG', serial,
      owners: [hero.name] as Prisma.InputJsonValue,
    },
  });
  hero.items.push(item);
  await tx.relicFind.create({
    data: { seasonId: season.id, uniqueId: relic.id, serial, playerId: hero.playerId, heroName: hero.name, itemId: item.id, source },
  });
  const of = relic.copies ?? 1;
  await tx.hallEntry.create({
    data: {
      seasonNumber: season.number, kind: 'relic', playerId: hero.playerId, playerName: await playerName(tx, hero.playerId),
      heroName: hero.name, detail: { uniqueId: relic.id, serial, of } as Prisma.InputJsonValue,
    },
  });
  await feed(tx, season, hero, 'relic', { uniqueId: relic.id, serial, of, floor });
  await countDeeds(tx, hero, { legendary: 1 }, out);
  await broadcast(tx, {
    en: `✨ ${hero.name} found a Relic: ${relic.name.en} #${serial}/${of}!`,
    ru: `✨ Реликвия у героя ${hero.name}: ${relic.name.ru} №${serial}/${of}!`,
  });
  out.loot.push(toItemView(item));
  out.notices.push({ en: `A Relic! ${relic.name.en}, copy ${serial} of ${of}.`, ru: `Реликвия! ${relic.name.ru}, экземпляр ${serial} из ${of}.` });
  return true;
}
