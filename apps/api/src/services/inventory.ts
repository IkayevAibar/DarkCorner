import type { Player, Prisma } from '@prisma/client';
import type { HeroView, SlotId } from '@dark/shared';
import { BAG_SLOTS, type ClassId, type GearBase, STORAGE_SLOTS, baseById, canUse, isGear, slotsFor } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { currentSeason } from './seasons.js';

const CAPACITY: Record<'BAG' | 'STORAGE', number> = { BAG: BAG_SLOTS, STORAGE: STORAGE_SLOTS };

/** The Player's living Hero and one of its Items, or a 404/409 explaining why not. */
async function heroAndItem(tx: Prisma.TransactionClient, player: Player, itemId: string) {
  const season = await currentSeason();
  const hero = await tx.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  const item = await tx.item.findFirst({ where: { id: itemId, heroId: hero.id } });
  if (!item) throw ApiError.notFound('item_not_found', 'No such Item on your Hero');
  if (item.place === 'STORAGE' && hero.location !== 'CITY') {
    throw ApiError.conflict('storage_in_city', 'Storage is back in the City');
  }
  return { hero, item };
}

async function used(tx: Prisma.TransactionClient, heroId: string, place: 'BAG' | 'STORAGE'): Promise<number> {
  return tx.item.count({ where: { heroId, place } });
}

async function heroView(heroId: string): Promise<HeroView> {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

/**
 * Wears a piece of gear. If the slot is taken, the two swap: the old piece goes
 * where the new one came from, so the Bag and Storage never overflow.
 */
export async function equipItem(player: Player, itemId: string, wanted?: SlotId): Promise<HeroView> {
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, item } = await heroAndItem(tx, player, itemId);
    if (item.place === 'WORN') throw ApiError.conflict('already_worn', 'Already worn');
    const base = baseById(item.base);
    if (!isGear(base)) throw ApiError.badRequest('not_gear', 'Only gear can be worn');
    if (!item.identified) throw ApiError.conflict('identify_first', 'Identify it before wearing it');
    if (!canUse(hero.class as ClassId, base)) throw ApiError.conflict('not_proficient', 'Your Class cannot use this');

    const fits = slotsFor(base as GearBase);
    if (wanted && !fits.includes(wanted)) throw ApiError.badRequest('wrong_slot', 'It does not go there');
    const worn = await tx.item.findMany({ where: { heroId: hero.id, place: 'WORN' } });
    const taken = new Map(worn.map((w) => [w.slot, w]));
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
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, item } = await heroAndItem(tx, player, itemId);
    if (item.place !== 'WORN') throw ApiError.conflict('not_worn', 'Not worn');
    if ((await used(tx, hero.id, 'BAG')) >= BAG_SLOTS) throw ApiError.conflict('bag_full', 'Your Bag is full');
    await tx.item.update({ where: { id: item.id }, data: { place: 'BAG', slot: null } });
    return hero.id;
  });
  return heroView(heroId);
}

/** Moves an Item between the Bag and Storage, topping up a matching stack first. */
export async function moveItem(player: Player, itemId: string, to: 'bag' | 'storage'): Promise<HeroView> {
  const target: 'BAG' | 'STORAGE' = to === 'bag' ? 'BAG' : 'STORAGE';
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, item } = await heroAndItem(tx, player, itemId);
    if (item.place === 'WORN') throw ApiError.conflict('worn', 'Take it off first');
    if (item.place === target) return hero.id;
    if (target === 'STORAGE' && hero.location !== 'CITY') throw ApiError.conflict('storage_in_city', 'Storage is back in the City');

    const base = baseById(item.base);
    if (!isGear(base)) {
      const stack = await tx.item.findFirst({ where: { heroId: hero.id, place: target, base: item.base } });
      if (stack && stack.quantity + item.quantity <= base.maxStack) {
        await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity + item.quantity } });
        await tx.item.delete({ where: { id: item.id } });
        return hero.id;
      }
    }
    if ((await used(tx, hero.id, target)) >= CAPACITY[target]) {
      throw ApiError.conflict(target === 'BAG' ? 'bag_full' : 'storage_full', `Your ${to} is full`);
    }
    await tx.item.update({ where: { id: item.id }, data: { place: target } });
    return hero.id;
  });
  return heroView(heroId);
}
