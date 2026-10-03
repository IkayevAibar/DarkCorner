import { Prisma, type Hero, type Player, type Season } from '@prisma/client';
import { type BulkSellResult, type BulkTier, type ShopView, type TradeResult, takenInBulk } from '@dark/shared';
import {
  type ClassId, SHOP_BASICS, SHOP_GEAR_MARKUP, buybackPrice, createRng, isGear, baseById, sellValue, shopBuyPrice, shopDeal,
  shopSellPrice, shopStock,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { scoresOf, toHeroView } from './heroes.js';
import type { HeroWithItems } from './ledger.js';
import { gearData, rollView, stackView } from './items.js';
import {
  dayNumber, destroyItem, earnGold, giveItem, giveStack, lockHero, ownItem, requireCity, spendGold,
} from './ledger.js';
import { currentSeason } from './seasons.js';

/** How much better this Hero's Shop deals are: a Haggler's, and its Charisma's. */
const deal = (hero: HeroWithItems) => shopDeal(hero.talents.includes('haggler'), scoresOf(hero).cha);

/** Today's gear for one Hero: seeded by the day, so it is the same all day and new tomorrow. */
function todaysStock(season: Season, hero: Hero, day: number) {
  return shopStock(createRng(`${season.seed}:shop:${hero.id}:${day}`), {
    classId: hero.class as ClassId,
    itemLevel: Math.max(1, hero.bestFloor),
  });
}

const stockPrice = (hero: HeroWithItems, roll: Parameters<typeof buybackPrice>[0]) => shopBuyPrice(buybackPrice(roll) * SHOP_GEAR_MARKUP, deal(hero));

async function heroView(heroId: string) {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

export async function shopView(player: Player): Promise<ShopView> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  const now = new Date();
  const day = dayNumber(now);
  const bought = new Set((await prisma.shopPurchase.findMany({ where: { heroId: hero.id, day } })).map((p) => p.offer));
  return {
    basics: SHOP_BASICS.map(({ base, price }) => ({
      id: base, item: stackView(base, 1), price: shopBuyPrice(price, deal(hero)), soldOut: false,
    })),
    stock: todaysStock(season, hero, day).map((roll, i) => ({
      id: `stock-${i}`, item: rollView(roll, `stock-${i}`), price: stockPrice(hero, roll), soldOut: bought.has(`stock-${i}`),
    })),
    restocksAt: new Date((day + 1) * 86_400_000).toISOString(),
    sellRate: 1 + deal(hero),
    hero: toHeroView(hero, now),
  };
}

/** Buys basics (any number) or one piece of today's gear, with City gold. */
export async function buyFromShop(player: Player, offer: string, quantity: number): Promise<TradeResult> {
  const season = await currentSeason();
  const { heroId, spent } = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const basic = SHOP_BASICS.find((b) => b.base === offer);
    if (basic) {
      const price = shopBuyPrice(basic.price, deal(hero)) * quantity;
      await spendGold(tx, hero, price);
      await giveStack(tx, hero, season.id, basic.base, quantity);
      return { heroId: hero.id, spent: price };
    }

    const index = /^stock-(\d+)$/.exec(offer)?.[1];
    const day = dayNumber(new Date());
    const roll = index === undefined ? undefined : todaysStock(season, hero, day)[Number(index)];
    if (!roll) throw ApiError.notFound('no_offer', 'The Shops don’t sell that');
    if (quantity !== 1) throw ApiError.badRequest('one_only', 'Gear sells one at a time');
    try {
      // The unique (hero, day, offer) row is the lock: a second purchase fails here.
      await tx.shopPurchase.create({ data: { heroId: hero.id, day, offer } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw ApiError.conflict('sold_out', 'Already bought today');
      throw e;
    }
    const price = stockPrice(hero, roll);
    await spendGold(tx, hero, price);
    await giveItem(tx, hero, { ...gearData(roll, `${season.seed}:shop:${hero.id}:${day}#${index}`), seasonId: season.id });
    return { heroId: hero.id, spent: price };
  });
  return { gold: -spent, hero: await heroView(heroId) };
}

/** Sells an Item (or part of a stack) from the Bag or Storage at the Buyback price. */
/** Sells every Bag Item a bulk sale up to `upTo` takes, each at the price it would fetch alone. */
export async function sellInBulk(player: Player, upTo: BulkTier): Promise<BulkSellResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const items = hero.items.filter((i) => i.place === 'BAG' && takenInBulk({ ...i, tier: i.tier as never, gear: isGear(baseById(i.base)) }, upTo));
    let gold = 0;
    for (const item of items) {
      gold += shopSellPrice(sellValue({ ...item, tier: item.tier as never, quantity: 1 }), deal(hero));
      await destroyItem(tx, hero, item);
    }
    if (gold > 0) await earnGold(tx, hero, gold);
    return { heroId: hero.id, sold: items.length, gold };
  });
  return { sold: r.sold, gold: r.gold, hero: await heroView(r.heroId) };
}

export async function sellToShop(player: Player, itemId: string, quantity?: number): Promise<TradeResult> {
  const season = await currentSeason();
  const { heroId, earned } = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const item = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    if (item.tier === 'relic') throw ApiError.conflict('relic', 'The Shops won’t touch a Relic. Try the Market.');
    const count = isGear(baseById(item.base)) ? 1 : (quantity ?? item.quantity);
    if (count > item.quantity) throw ApiError.badRequest('too_many', 'You don’t have that many');
    const earned = shopSellPrice(sellValue({ ...item, tier: item.tier as never, quantity: count }), deal(hero));
    if (count === item.quantity) await destroyItem(tx, hero, item);
    else await tx.item.update({ where: { id: item.id }, data: { quantity: item.quantity - count } });
    await earnGold(tx, hero, earned);
    return { heroId: hero.id, earned };
  });
  return { gold: earned, hero: await heroView(heroId) };
}
