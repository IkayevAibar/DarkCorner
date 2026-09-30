import type { Hero, Item, Player, Prisma } from '@prisma/client';
import { BAG_SLOTS, STORAGE_SLOTS, type StackBase, baseById, isGear } from '@dark/engine';
import { ApiError } from '../lib/errors.js';

// Every change to gold or Items goes through here, inside one transaction that
// starts with lockHero(). The row lock makes two requests from the same Player run
// one after the other, so neither can spend gold or an Item the other already spent
// (docs/architecture.md → Items can't be duplicated).

export type Tx = Prisma.TransactionClient;
export type HeroWithItems = Hero & { items: Item[] };
type Place = 'BAG' | 'STORAGE';

/**
 * The Player's living Hero, locked until the transaction ends, with its Items. A Hero in
 * a fight played turn by turn can do nothing else until it ends (its Items and health are
 * the fight's).
 */
export async function lockHero(tx: Tx, player: Pick<Player, 'id'>, seasonId: string): Promise<HeroWithItems> {
  const row = await tx.hero.findFirst({ where: { playerId: player.id, seasonId, retiredAt: null }, select: { id: true } });
  if (!row) throw ApiError.conflict('no_hero', 'Create a Hero first');
  await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${row.id} FOR UPDATE`;
  const hero = await tx.hero.findUniqueOrThrow({ where: { id: row.id }, include: { items: true } });
  // Retired between the lookup and the lock.
  if (hero.retiredAt) throw ApiError.conflict('no_hero', 'Create a Hero first');
  await noFight(tx, hero.id);
  return hero;
}

/** Refuses anything but the fight while one is being played turn by turn. */
export async function noFight(tx: Tx, heroId: string): Promise<void> {
  if (await tx.fight.count({ where: { OR: [{ heroId }, { partnerId: heroId }] } }) > 0) {
    throw ApiError.conflict('in_fight', 'Finish the fight first');
  }
}

export function requireCity(hero: Hero): void {
  if (hero.location !== 'CITY') throw ApiError.conflict('not_in_city', 'Only in the City');
}

/** Places whose Items the Hero can reach right now: Storage only in the City. */
export const reachable = (hero: Hero): Place[] => (hero.location === 'CITY' ? ['BAG', 'STORAGE'] : ['BAG']);

const used = (hero: HeroWithItems, place: Place) => hero.items.filter((i) => i.place === place).length;
const capacity = (place: Place) => (place === 'BAG' ? BAG_SLOTS : STORAGE_SLOTS);

/** A free slot for a new Item: the Bag first, then Storage in the City. */
export function freePlace(hero: HeroWithItems): Place | null {
  return reachable(hero).find((p) => used(hero, p) < capacity(p)) ?? null;
}

/** One of the Hero's Items that it can reach, from the given places. */
export function ownItem(hero: HeroWithItems, itemId: string, places: Item['place'][] = ['WORN', 'BAG', 'STORAGE']): Item {
  const item = hero.items.find((i) => i.id === itemId && places.includes(i.place));
  if (!item) throw ApiError.notFound('item_not_found', 'No such Item on your Hero');
  if (item.place === 'STORAGE' && hero.location !== 'CITY') throw ApiError.conflict('storage_in_city', 'Storage is back in the City');
  return item;
}

/** How many of a stackable the Hero can reach. */
export function stackTotal(hero: HeroWithItems, base: string): number {
  const places = reachable(hero);
  return hero.items.filter((i) => i.base === base && places.includes(i.place as Place)).reduce((s, i) => s + i.quantity, 0);
}

/** Uses up `quantity` of a stackable, from the Bag first. Throws `code` when there aren't enough. */
export async function takeStack(tx: Tx, hero: HeroWithItems, base: string, quantity: number, code = 'missing_items'): Promise<void> {
  if (stackTotal(hero, base) < quantity) throw ApiError.conflict(code, `Not enough ${base}`);
  const places = reachable(hero);
  const stacks = hero.items
    .filter((i) => i.base === base && places.includes(i.place as Place))
    .sort((a, b) => places.indexOf(a.place as Place) - places.indexOf(b.place as Place) || a.quantity - b.quantity);
  let left = quantity;
  for (const stack of stacks) {
    if (left <= 0) break;
    const take = Math.min(left, stack.quantity);
    left -= take;
    if (take === stack.quantity) {
      await tx.item.delete({ where: { id: stack.id } });
      hero.items.splice(hero.items.indexOf(stack), 1);
    } else {
      await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity - take } });
      stack.quantity -= take;
    }
  }
}

/**
 * Adds `quantity` of a stackable: tops up existing stacks, then starts new ones in
 * the Bag (and Storage, in the City). Throws `bag_full` if it can't all fit.
 */
export async function giveStack(tx: Tx, hero: HeroWithItems, seasonId: string, base: string, quantity: number): Promise<void> {
  const def = baseById(base);
  if (isGear(def)) throw new Error(`${base} is gear, not a stackable`);
  const max = (def as StackBase).maxStack;
  let left = quantity;
  for (const place of reachable(hero)) {
    for (const stack of hero.items.filter((i) => i.place === place && i.base === base)) {
      const add = Math.min(left, max - stack.quantity);
      if (add <= 0) continue;
      await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity + add } });
      stack.quantity += add;
      left -= add;
    }
  }
  while (left > 0) {
    const place = freePlace(hero);
    if (!place) throw ApiError.conflict('bag_full', 'Your Bag is full');
    const add = Math.min(left, max);
    const item = await tx.item.create({ data: { seasonId, heroId: hero.id, place, base, tier: 'common', quantity: add } });
    hero.items.push(item);
    left -= add;
  }
}

/** Puts a new single Item on the Hero (the Bag, or Storage in the City). Throws `bag_full`. */
export async function giveItem(tx: Tx, hero: HeroWithItems, data: Omit<Prisma.ItemUncheckedCreateInput, 'heroId' | 'place'>): Promise<Item> {
  const place = freePlace(hero);
  if (!place) throw ApiError.conflict('bag_full', 'Your Bag is full');
  const item = await tx.item.create({ data: { ...data, heroId: hero.id, place } });
  hero.items.push(item);
  return item;
}

/** Destroys an Item for good (Forge, Salvage, the altar, a Shop). */
export async function destroyItem(tx: Tx, hero: HeroWithItems, item: Item): Promise<void> {
  await tx.item.delete({ where: { id: item.id } });
  hero.items.splice(hero.items.indexOf(item), 1);
}

/** City gold. */
export async function spendGold(tx: Tx, hero: Hero, amount: number): Promise<void> {
  if (amount < 0) throw new Error('negative spend');
  if (hero.gold < amount) throw ApiError.conflict('not_enough_gold', 'Not enough gold');
  await tx.hero.update({ where: { id: hero.id }, data: { gold: { decrement: amount } } });
  hero.gold -= amount;
}

export async function earnGold(tx: Tx, hero: Hero, amount: number): Promise<void> {
  if (amount < 0) throw new Error('negative earning');
  await tx.hero.update({ where: { id: hero.id }, data: { gold: { increment: amount } } });
  hero.gold += amount;
}

/** Gold carried in the Labyrinth (merchants and gamblers take nothing else). */
export async function spendCarried(tx: Tx, hero: Hero, amount: number): Promise<void> {
  if (amount < 0) throw new Error('negative spend');
  if (hero.carriedGold < amount) throw ApiError.conflict('not_enough_gold', 'Not enough gold on you');
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { decrement: amount } } });
  hero.carriedGold -= amount;
}

export async function earnCarried(tx: Tx, hero: Hero, amount: number): Promise<void> {
  if (amount < 0) throw new Error('negative earning');
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: amount } } });
  hero.carriedGold += amount;
}

/** Days since the epoch, UTC: Shops restock and Event rooms reset on this. */
export const dayNumber = (now: Date): number => Math.floor(now.getTime() / 86_400_000);
