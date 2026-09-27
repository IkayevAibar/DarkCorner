import type { Player } from '@prisma/client';
import type { HeroView, IdentifyResult, OpenChestResult } from '@dark/shared';
import {
  CHEST_ODDS, baseById, chestBase, chestGradeOf, createRng, isGear, keyBase, rollChestTier, rollDice, rollGear, sum, tierRank,
  uniqueById,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { broadcast } from './broadcast.js';
import { feed } from './feed.js';
import { toHeroView } from './heroes.js';
import { gearData, toItemView } from './items.js';
import { giveItem, lockHero, ownItem, takeStack } from './ledger.js';
import { currentSeason } from './seasons.js';

async function heroView(heroId: string): Promise<HeroView> {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

/** Reveals an Unidentified Item: a Scroll of Identify, or free for Wizards. Works anywhere. */
export async function identifyItem(player: Player, itemId: string): Promise<IdentifyResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const item = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    if (!isGear(baseById(item.base)) || item.identified) throw ApiError.conflict('already_identified', 'Nothing to identify');
    const free = hero.class === 'wizard';
    if (!free) await takeStack(tx, hero, 'scroll-identify', 1, 'no_identify_scroll');
    const updated = await tx.item.update({ where: { id: item.id }, data: { identified: true } });
    if (tierRank(item.tier as never) >= tierRank('legendary')) {
      await feed(tx, season, hero, 'identify', { tier: item.tier, uniqueId: item.uniqueId, radiant: item.radiant, serial: item.serial });
      if (item.radiant && item.uniqueId) {
        const name = uniqueById(item.uniqueId).name;
        await broadcast(tx, {
          en: `🌈 ${hero.name} identified a Radiant ${name.en}!`,
          ru: `🌈 Сияющий предмет у героя ${hero.name}: ${name.ru}!`,
        });
      }
    }
    return { heroId: hero.id, updated, free };
  });
  return { item: toItemView(r.updated), free: r.free, hero: await heroView(r.heroId) };
}

/** Opens a Chest with a Key of its grade. The prize lands in the Bag (or Storage in the City). */
export async function openChest(player: Player, itemId: string): Promise<OpenChestResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const chest = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    const grade = chestGradeOf(chest.base);
    if (!grade) throw ApiError.badRequest('not_a_chest', 'That is not a Chest');
    await takeStack(tx, hero, keyBase(grade), 1, 'no_key');
    await takeStack(tx, hero, chestBase(grade), 1);

    const seed = newSeed();
    const rng = createRng(seed);
    const tier = rollChestTier(rng, grade);
    const roll = rollGear(rng, { tier, itemLevel: Math.max(1, hero.bestFloor) });
    const prize = await giveItem(tx, hero, { ...gearData(roll, seed), seasonId: season.id });
    await tx.rollLog.create({ data: { playerId: player.id, kind: 'chest', seed, detail: { grade, tier, base: roll.base } } });
    if (tierRank(tier) >= tierRank('legendary')) {
      // A Legendary from a Chest ends a streak of bad luck just as a drop does.
      await tx.hero.update({ where: { id: hero.id }, data: { badLuck: 0 } });
      await feed(tx, season, hero, 'chest', { grade, tier, base: roll.base });
      if (tier === 'mythic') {
        await broadcast(tx, { en: `🔴 ${hero.name} opened a Chest and found a Mythic Item!`, ru: `🔴 Мифическая находка в сундуке у героя ${hero.name}!` });
      }
    }
    return { heroId: hero.id, grade, prize };
  });
  return {
    grade: r.grade,
    prize: toItemView(r.prize),
    odds: CHEST_ODDS[r.grade].map(([tier, percent]) => ({ tier, percent })),
    hero: await heroView(r.heroId),
  };
}

/** Drinks a Healing potion outside a fight (Field medics get 50% more). */
export async function drinkPotion(player: Player, itemId: string): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const potion = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    if (potion.base !== 'potion') throw ApiError.badRequest('not_a_potion', 'That is not a potion');
    if (hero.hp >= hero.maxHp) throw ApiError.conflict('full_health', 'You are already at full health');
    const healed = Math.round((sum(rollDice(createRng(newSeed()), 2, 4)) + 2) * (hero.talents.includes('field-medic') ? 1.5 : 1));
    await takeStack(tx, hero, 'potion', 1);
    await tx.hero.update({ where: { id: hero.id }, data: { hp: Math.min(hero.maxHp, hero.hp + healed) } });
    return hero.id;
  });
  return heroView(heroId);
}
