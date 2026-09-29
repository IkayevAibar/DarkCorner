import type { Item, Listing, Player, Prisma } from '@prisma/client';
import type { Listing as ListingView, MarketView } from '@dark/shared';
import { MARKET_DAYS, MARKET_MAX_PRICE, MARKET_TAX, marketPayout, uniqueById } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { feed } from './feed.js';
import { TIER_NAMES, baseName } from './feedLine.js';
import { toHeroView } from './heroes.js';
import { toItemView } from './items.js';
import { type Tx, freePlace, lockHero, ownItem, requireCity, spendGold } from './ledger.js';
import { currentSeason } from './seasons.js';
import { omenOf } from './omens.js';
import { notify } from './push.js';

/** A Player may have this many Items on the Market at once (v0). */
export const MAX_LISTINGS = 20;

const DAY_MS = 86_400_000;

function toListingView(listing: Listing & { item: Item }, playerId: string, now: Date): ListingView {
  return {
    id: listing.id,
    item: toItemView(listing.item),
    price: listing.price,
    seller: listing.sellerName,
    mine: listing.sellerId === playerId,
    expiresAt: listing.expiresAt.toISOString(),
    expired: listing.expiresAt <= now,
  };
}

export async function marketView(player: Player): Promise<MarketView> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  const now = new Date();
  const [others, mine] = await Promise.all([
    prisma.listing.findMany({
      where: { seasonId: season.id, sellerId: { not: player.id }, expiresAt: { gt: now } },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.listing.findMany({ where: { seasonId: season.id, sellerId: player.id }, include: { item: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    listings: others.map((l) => toListingView(l, player.id, now)),
    mine: mine.map((l) => toListingView(l, player.id, now)),
    taxPercent: Math.round((omenOf(season, now)?.marketTax ?? MARKET_TAX) * 100),
    days: MARKET_DAYS,
    hero: toHeroView(hero, now),
  };
}

/** Puts an Item (a whole stack) up for sale for 7 days. It leaves the Hero until it sells or comes back. */
export async function listItem(player: Player, itemId: string, price: number): Promise<MarketView> {
  if (price < 1 || price > MARKET_MAX_PRICE) throw ApiError.badRequest('bad_price', 'That price is not allowed');
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const item = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    const listed = await tx.listing.count({ where: { sellerId: player.id } });
    if (listed >= MAX_LISTINGS) throw ApiError.conflict('too_many_listings', `At most ${MAX_LISTINGS} listings at once`);
    await tx.item.update({ where: { id: item.id }, data: { place: 'MARKET', heroId: null, slot: null } });
    await tx.listing.create({
      data: {
        seasonId: season.id, itemId: item.id, sellerId: player.id, sellerName: hero.name, price,
        expiresAt: new Date(Date.now() + MARKET_DAYS * DAY_MS),
      },
    });
  });
  return marketView(player);
}

/** The listing, locked; the row is the lock that stops two buyers (or a buyer and the seller) racing. */
async function lockListing(tx: Tx, id: string): Promise<Listing & { item: Item }> {
  await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id} FOR UPDATE`;
  const listing = await tx.listing.findUnique({ where: { id }, include: { item: true } });
  if (!listing) throw ApiError.notFound('listing_gone', 'That listing is gone');
  return listing;
}

export async function buyListing(player: Player, listingId: string): Promise<MarketView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const listing = await lockListing(tx, listingId);
    if (listing.seasonId !== season.id) throw ApiError.notFound('listing_gone', 'That listing is gone');
    if (listing.expiresAt <= new Date()) throw ApiError.conflict('listing_expired', 'That listing has expired');
    if (listing.sellerId === player.id) throw ApiError.conflict('own_listing', 'That is your own listing');
    const buyer = await lockHero(tx, player, season.id);
    requireCity(buyer);
    const place = freePlace(buyer);
    if (!place) throw ApiError.conflict('bag_full', 'Your Bag and Storage are full');
    await spendGold(tx, buyer, listing.price);

    const owners = Array.isArray(listing.item.owners) ? [...(listing.item.owners as string[]), buyer.name] : listing.item.owners;
    await tx.item.update({
      where: { id: listing.itemId },
      data: { heroId: buyer.id, place, owners: (owners ?? undefined) as Prisma.InputJsonValue | undefined },
    });
    await tx.listing.delete({ where: { id: listing.id } });

    // Proceeds go to the seller's living Hero, or to the last one (a new Hero inherits its gold).
    const seller = await tx.hero.findFirst({ where: { playerId: listing.sellerId, seasonId: season.id }, orderBy: [{ retiredAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }] });
    const payout = marketPayout(listing.price, omenOf(season)?.marketTax ?? MARKET_TAX);
    if (seller) await tx.hero.update({ where: { id: seller.id }, data: { gold: { increment: payout } } });
    await feed(tx, season, buyer, 'market-sale', {
      seller: listing.sellerName, price: listing.price, tier: listing.item.tier, base: listing.item.base, uniqueId: listing.item.uniqueId,
    });
    const base = baseName(listing.item.base);
    const item = listing.item.uniqueId ? uniqueById(listing.item.uniqueId).name : { en: base.en.toLowerCase(), ru: base.ru };
    const tier = TIER_NAMES[listing.item.tier]!;
    await notify(tx, listing.sellerId, {
      kind: 'market',
      title: { en: 'Sold on the Market', ru: 'Продано на рынке' },
      body: {
        en: `${buyer.name} bought your ${tier.en} ${item.en} for ${listing.price} gold. ${payout} gold is yours.`,
        ru: `${item.ru} (ранг: ${tier.ru}) — покупатель ${buyer.name}, цена ${listing.price} золота. Ваша доля: ${payout}.`,
      },
      url: '/city',
      tag: `sale-${listing.id}`,
    });
  });
  return marketView(player);
}

/** Takes a listing back (live or expired) into the Bag, or Storage. */
export async function cancelListing(player: Player, listingId: string): Promise<MarketView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const listing = await lockListing(tx, listingId);
    if (listing.sellerId !== player.id) throw ApiError.forbidden('not_yours', 'That is not your listing');
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const place = freePlace(hero);
    if (!place) throw ApiError.conflict('bag_full', 'Your Bag and Storage are full');
    await tx.item.update({ where: { id: listing.itemId }, data: { heroId: hero.id, place } });
    await tx.listing.delete({ where: { id: listing.id } });
  });
  return marketView(player);
}
