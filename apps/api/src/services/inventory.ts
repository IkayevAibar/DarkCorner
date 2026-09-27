import type { Player } from '@prisma/client';
import type { HeroView, SlotId } from '@dark/shared';
import { BAG_SLOTS, type ClassId, type GearBase, STORAGE_SLOTS, baseById, canUse, isGear, slotsFor } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { lockHero, ownItem } from './ledger.js';
import { currentSeason } from './seasons.js';

const CAPACITY: Record<'BAG' | 'STORAGE', number> = { BAG: BAG_SLOTS, STORAGE: STORAGE_SLOTS };

async function heroView(heroId: string): Promise<HeroView> {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

/**
 * Wears a piece of gear. If the slot is taken, the two swap: the old piece goes
 * where the new one came from, so the Bag and Storage never overflow.
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
    const taken = new Map(hero.items.filter((w) => w.place === 'WORN').map((w) => [w.slot, w]));
    const slot = wanted ?? fits.find((s) => !taken.has(s)) ?? fits[0]!;

    const current = taken.get(slot);
    if (current) {
      // Out of the slot first: (heroId, slot) is unique.
      await tx.item.update({ where: { id: current.id }, data: { place: item.place, slot: null } });
    }
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
