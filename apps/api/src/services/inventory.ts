import type { Player } from '@prisma/client';
import type { HeroView, SlotId } from '@dark/shared';
import { BAG_SLOTS, type ClassId, type GearBase, STORAGE_SLOTS, baseById, canUse, isGear, slotsFor, wearPlan } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { destroyItem, lockHero, ownItem } from './ledger.js';
import { currentSeason } from './seasons.js';

const CAPACITY: Record<'BAG' | 'STORAGE', number> = { BAG: BAG_SLOTS, STORAGE: STORAGE_SLOTS };

async function heroView(heroId: string): Promise<HeroView> {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

/**
 * Wears a piece of gear. If the slot is taken, the two swap: the old piece goes
 * where the new one came from, so the Bag and Storage never overflow. A two-handed
 * weapon takes the off-hand item off too, and an off-hand item a two-handed weapon
 * (docs/design.md → Hands); when two pieces come off, the second needs room there.
 */
export async function equipItem(player: Player, itemId: string, wanted?: SlotId): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const item = ownItem(hero, itemId);
    if (item.place === 'WORN') throw ApiError.conflict('already_worn', 'Already worn');
    const base = baseById(item.base);
    if (!isGear(base)) throw ApiError.badRequest('not_gear', 'Only gear can be worn');
    if (!item.identified) throw ApiError.conflict('identify_first', 'Identify it before wearing it');
    if (!canUse(hero.class as ClassId, base)) throw ApiError.conflict('not_proficient', 'Your Class cannot use this');

    const fits = slotsFor(base as GearBase);
    if (wanted && !fits.includes(wanted)) throw ApiError.badRequest('wrong_slot', 'It does not go there');
    const on = hero.items.filter((w) => w.place === 'WORN' && w.slot);
    const { slot, vacate } = wearPlan(base as GearBase, new Map(on.map((w) => [w.slot!, w.base])), wanted);
    const off = on.filter((w) => (vacate as string[]).includes(w.slot!));
    const from = item.place as 'BAG' | 'STORAGE';
    if (off.length > 1 && hero.items.filter((i) => i.place === from).length - 1 + off.length > CAPACITY[from]) {
      throw ApiError.conflict('hands_full', 'No room to put away what the two-handed weapon replaces');
    }
    // Out of the slots first: (heroId, slot) is unique.
    for (const w of off) await tx.item.update({ where: { id: w.id }, data: { place: from, slot: null } });
    await tx.item.update({ where: { id: item.id }, data: { place: 'WORN', slot } });
    return hero.id;
  });
  return heroView(heroId);
}

export async function unequipItem(player: Player, itemId: string): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const item = ownItem(hero, itemId);
    if (item.place !== 'WORN') throw ApiError.conflict('not_worn', 'Not worn');
    if (hero.items.filter((i) => i.place === 'BAG').length >= BAG_SLOTS) throw ApiError.conflict('bag_full', 'Your Bag is full');
    await tx.item.update({ where: { id: item.id }, data: { place: 'BAG', slot: null } });
    return hero.id;
  });
  return heroView(heroId);
}

/** Throws an Item (a whole stack) out of the Bag for good, to make room for better loot. Relics are too rare to throw away. */
export async function dropItem(player: Player, itemId: string): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const item = ownItem(hero, itemId);
    if (item.place !== 'BAG') throw ApiError.conflict('not_in_bag', 'Only Items in the Bag can be dropped');
    if (item.tier === 'relic') throw ApiError.conflict('relic_kept', 'A Relic is too rare to throw away');
    await destroyItem(tx, hero, item);
    return hero.id;
  });
  return heroView(heroId);
}

/** Moves an Item between the Bag and Storage, topping up a matching stack first. */
export async function moveItem(player: Player, itemId: string, to: 'bag' | 'storage'): Promise<HeroView> {
  const target: 'BAG' | 'STORAGE' = to === 'bag' ? 'BAG' : 'STORAGE';
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const item = ownItem(hero, itemId);
    if (item.place === 'WORN') throw ApiError.conflict('worn', 'Take it off first');
    if (item.place === target) return hero.id;
    if (target === 'STORAGE' && hero.location !== 'CITY') throw ApiError.conflict('storage_in_city', 'Storage is back in the City');

    const base = baseById(item.base);
    if (!isGear(base)) {
      const stack = hero.items.find((i) => i.place === target && i.base === item.base);
      if (stack && stack.quantity + item.quantity <= base.maxStack) {
        await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity + item.quantity } });
        await tx.item.delete({ where: { id: item.id } });
        return hero.id;
      }
    }
    if (hero.items.filter((i) => i.place === target).length >= CAPACITY[target]) {
      throw ApiError.conflict(target === 'BAG' ? 'bag_full' : 'storage_full', `Your ${to} is full`);
    }
    await tx.item.update({ where: { id: item.id }, data: { place: target } });
    return hero.id;
  });
  return heroView(heroId);
}
