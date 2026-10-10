import type { Player } from '@prisma/client';
import type { AcademyView } from '@dark/shared';
import { ACADEMY, TALENTS, TALENT_DEFS, type TalentId, academyPrice } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { lockHero, requireCity, spendGold } from './ledger.js';
import { currentSeason } from './seasons.js';

// The Academy (docs/design.md → The City): from level 12 a Hero learns up to three more
// Talents for City gold, each dearer than the last.

export async function academyView(player: Player): Promise<AcademyView> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  return {
    minLevel: ACADEMY.minLevel,
    max: ACADEMY.prices.length,
    learned: hero.academy as TalentId[],
    price: academyPrice(hero.academy.length),
    talents: TALENTS.map((id) => ({ id, name: TALENT_DEFS[id].name, description: TALENT_DEFS[id].description, known: hero.talents.includes(id) })),
    hero: toHeroView(hero),
  };
}

/** Learns a Talent the Hero doesn't know yet, for the next price. */
export async function learnTalent(player: Player, talent: TalentId): Promise<AcademyView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    if (hero.level < ACADEMY.minLevel) throw ApiError.conflict('too_green', `The Academy takes Heroes from level ${ACADEMY.minLevel}`);
    if (hero.talents.includes(talent)) throw ApiError.conflict('talent_known', 'The Hero knows that Talent already');
    const price = academyPrice(hero.academy.length);
    if (price === null) throw ApiError.conflict('academy_done', 'The Academy has nothing more to teach this Hero');
    await spendGold(tx, hero, price);
    await tx.hero.update({ where: { id: hero.id }, data: { talents: [...hero.talents, talent], academy: [...hero.academy, talent] } });
  });
  return academyView(player);
}
