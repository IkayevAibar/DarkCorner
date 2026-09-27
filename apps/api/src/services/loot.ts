import type { Season } from '@prisma/client';
import type { ItemView, LocalizedText } from '@dark/shared';
import {
  BAD_LUCK_MAX, type Tier, chestBase, createRng, dropOdds, rollChestGrade, rollGear, rollLootTier, tierRank,
} from '@dark/engine';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { broadcast } from './broadcast.js';
import { feed } from './feed.js';
import { heroLuck } from './heroes.js';
import { gearData, toItemView } from './items.js';
import { type HeroWithItems, type Tx, freePlace, giveStack } from './ledger.js';
import { omenOf } from './omens.js';

/** What an action brought: Items as the web shows them, and lines to read. */
export interface Haul {
  loot: ItemView[];
  notices: LocalizedText[];
}

const t = (en: string, ru: string): LocalizedText => ({ en, ru });
const BAG_FULL = t('Your Bag is full — you had to leave something behind.', 'Сумка полна — пришлось что-то оставить.');

/**
 * Rolls `count` pieces of gear into the Hero's Bag, with its magic find and the
 * Bad-luck meter (docs/design.md → Where loot comes from, Bad-luck meter).
 */
export async function dropGear(tx: Tx, hero: HeroWithItems, season: Season, opts: {
  floor: number; count: number; odds?: [Tier, number][]; source: string;
}, haul: Haul): Promise<void> {
  const luck = heroLuck(hero);
  const magicFind = luck.magicFind + (omenOf(season)?.magicFind ?? 0);
  for (let i = 0; i < opts.count; i++) {
    const seed = newSeed();
    const rng = createRng(seed);
    const { tier, forced, reset } = rollLootTier(rng, {
      odds: opts.odds ?? dropOdds(opts.floor), magicFind, badLuck: hero.badLuck,
    });
    const roll = rollGear(rng, { tier, itemLevel: Math.max(1, opts.floor) });
    await tx.rollLog.create({
      data: {
        playerId: hero.playerId, kind: 'drop', seed,
        detail: { floor: opts.floor, source: opts.source, tier, base: roll.base, forced, magicFind, badLuck: hero.badLuck },
      },
    });
    if (reset && hero.badLuck !== 0) {
      await tx.hero.update({ where: { id: hero.id }, data: { badLuck: 0 } });
      hero.badLuck = 0;
    }
    const place = freePlace(hero);
    if (!place) {
      haul.notices.push(BAG_FULL);
      continue;
    }
    const item = await tx.item.create({ data: { ...gearData(roll, seed), seasonId: season.id, heroId: hero.id, place } });
    hero.items.push(item);
    haul.loot.push(toItemView(item));
    if (tierRank(tier) >= tierRank('legendary')) await feed(tx, season, hero, 'drop', { tier, base: roll.base, forced, floor: opts.floor });
    if (tier === 'mythic') {
      await broadcast(tx, {
        en: `🔴 ${hero.name} found a Mythic Item on Floor ${opts.floor}!`,
        ru: `🔴 Мифическая находка у героя ${hero.name} на этаже ${opts.floor}!`,
      });
    }
  }
}

/** Adds stackables (a Chest, a Key…) to the Bag and the haul; a full Bag loses them. */
export async function dropStack(tx: Tx, hero: HeroWithItems, season: Season, base: string, quantity: number, haul: Haul): Promise<void> {
  try {
    await giveStack(tx, hero, season.id, base, quantity);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'bag_full') {
      haul.notices.push(BAG_FULL);
      return;
    }
    throw e;
  }
  const stack = hero.items.find((i) => i.base === base && (i.place === 'BAG' || i.place === 'STORAGE'))!;
  haul.loot.push({ ...toItemView(stack), id: `${stack.id}:+${quantity}`, quantity });
}

/** A Chest of a grade that suits the Floor. */
export async function dropChest(tx: Tx, hero: HeroWithItems, season: Season, floor: number, haul: Haul): Promise<void> {
  await dropStack(tx, hero, season, chestBase(rollChestGrade(createRng(newSeed()), floor)), 1, haul);
}

/** The meter gains per fight won and per Mini-boss, faster with some Relics and Blessings. */
export async function addBadLuck(tx: Tx, hero: HeroWithItems, amount: number): Promise<void> {
  const next = Math.min(BAD_LUCK_MAX, hero.badLuck + amount * heroLuck(hero).badLuckRate);
  if (next === hero.badLuck) return;
  await tx.hero.update({ where: { id: hero.id }, data: { badLuck: next } });
  hero.badLuck = next;
}

/** Gold with the Hero's gold find. */
export const withGoldFind = (hero: HeroWithItems, gold: number): number => Math.round(gold * (1 + heroLuck(hero).goldFind / 100));
