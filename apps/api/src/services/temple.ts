import type { Player } from '@prisma/client';
import type { TempleView } from '@dark/shared';
import { BLESSING_IDS, BLESSING_MS, BLESSINGS, type BlessingId } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { lockHero, requireCity, spendGold } from './ledger.js';
import { currentSeason } from './seasons.js';

export async function templeView(player: Player): Promise<TempleView> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  return {
    blessings: BLESSING_IDS.map((id) => ({ id, name: BLESSINGS[id].name, description: BLESSINGS[id].description, price: BLESSINGS[id].price })),
    hero: toHeroView(hero),
  };
}

/** Buys a Blessing for 3 hours. A new Blessing replaces the one before. */
export async function buyBlessing(player: Player, blessing: BlessingId): Promise<TempleView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    await spendGold(tx, hero, BLESSINGS[blessing].price);
    await tx.hero.update({ where: { id: hero.id }, data: { blessing, blessingUntil: new Date(Date.now() + BLESSING_MS) } });
  });
  return templeView(player);
}
