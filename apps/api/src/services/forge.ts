import type { Item, Player, Prisma } from '@prisma/client';
import type {
  ForgeCost, ForgeQuote, ForgeView, HeroView, ReforgeResult, SalvageResult, UpgradeResult,
} from '@dark/shared';
import {
  type ForgeCost as EngineCost, MAX_UPGRADE, RECIPES, REFORGE_COST, type Tier, UPGRADE_CHANCE, UPGRADE_SAFE_UNTIL, baseById,
  bonusLines, canReforge, createRng, isGear, rollBonusStats, rollSalvage, rollUpgrade, salvageRange, upgradeCost,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { feed } from './feed.js';
import { toHeroView } from './heroes.js';
import { toItemView } from './items.js';
import {
  type HeroWithItems, type Tx, destroyItem, giveStack, lockHero, ownItem, requireCity, spendGold, stackTotal, takeStack,
} from './ledger.js';
import { currentSeason } from './seasons.js';

const PROTECTION = 'scroll-protection';

function costView(hero: HeroWithItems, cost: EngineCost): ForgeCost {
  return {
    gold: cost.gold,
    materials: cost.materials.map((m) => ({ base: m.base, name: baseById(m.base).name, quantity: m.quantity, have: stackTotal(hero, m.base) })),
  };
}

/** Pays a Forge cost: the gold, then each Material. */
async function pay(tx: Tx, hero: HeroWithItems, cost: EngineCost): Promise<void> {
  await spendGold(tx, hero, cost.gold);
  for (const m of cost.materials) await takeStack(tx, hero, m.base, m.quantity, 'missing_materials');
}

/** An identified piece of gear the Hero can reach, for the Forge. */
function forgeable(hero: HeroWithItems, itemId: string, places: Item['place'][] = ['WORN', 'BAG', 'STORAGE']): Item {
  const item = ownItem(hero, itemId, places);
  if (!isGear(baseById(item.base))) throw ApiError.badRequest('not_gear', 'The Forge only works gear');
  if (!item.identified) throw ApiError.conflict('identify_first', 'Identify it first');
  return item;
}

async function heroView(heroId: string): Promise<HeroView> {
  return toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } }));
}

async function readHero(player: Player): Promise<HeroWithItems> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  return hero;
}

/** What the Forge can do with one Item, at what price. */
export async function forgeQuote(player: Player, itemId: string): Promise<ForgeQuote> {
  const hero = await readHero(player);
  const item = ownItem(hero, itemId);
  if (!isGear(baseById(item.base))) throw ApiError.badRequest('not_gear', 'The Forge only works gear');
  const tier = item.tier as Tier;
  const view = toItemView(item);
  if (!item.identified) return { item: view, upgrade: null, reforge: null, salvage: null, blocked: 'identify_first' };
  const to = item.upgrade + 1;
  const salvage = salvageRange(tier, item.upgrade);
  return {
    item: view,
    upgrade: item.upgrade < MAX_UPGRADE
      ? {
        to, chance: UPGRADE_CHANCE[to]!, cost: costView(hero, upgradeCost(tier, to)),
        risky: to > UPGRADE_SAFE_UNTIL, protectionScrolls: stackTotal(hero, PROTECTION),
      }
      : null,
    reforge: canReforge(tier) ? costView(hero, REFORGE_COST[tier]!) : null,
    salvage: salvage ? { ...salvage, name: baseById(salvage.base).name } : null,
    blocked: null,
  };
}

export async function upgradeItem(player: Player, itemId: string, protect: boolean): Promise<UpgradeResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const item = forgeable(hero, itemId);
    if (item.upgrade >= MAX_UPGRADE) throw ApiError.conflict('max_upgrade', 'It can’t go higher');
    const to = item.upgrade + 1;
    const risky = to > UPGRADE_SAFE_UNTIL;
    const useScroll = protect && risky;
    if (useScroll && stackTotal(hero, PROTECTION) < 1) throw ApiError.conflict('no_protection', 'You have no Protection scroll');
    await pay(tx, hero, upgradeCost(item.tier as Tier, to));

    const seed = newSeed();
    const result = rollUpgrade(createRng(seed), item.upgrade, useScroll);
    await tx.rollLog.create({
      data: { playerId: player.id, kind: 'forge', seed, detail: { itemId: item.id, from: item.upgrade, protect: useScroll, ...result } },
    });
    if (result.protectionUsed) await takeStack(tx, hero, PROTECTION, 1);

    let updated: Item | null = item;
    if (result.outcome === 'destroyed') {
      await destroyItem(tx, hero, item);
      updated = null;
    } else if (result.level !== item.upgrade) {
      updated = await tx.item.update({ where: { id: item.id }, data: { upgrade: result.level } });
    }
    if (result.outcome === 'success' && result.level === MAX_UPGRADE) {
      await feed(tx, season, hero, 'upgrade10', { item: item.id, base: item.base, tier: item.tier });
    }
    return { heroId: hero.id, result, updated };
  });
  return {
    outcome: r.result.outcome,
    roll: r.result.roll,
    chance: r.result.chance,
    item: r.updated ? toItemView(r.updated) : null,
    hero: await heroView(r.heroId),
  };
}

export async function reforgeItem(player: Player, itemId: string): Promise<ReforgeResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const item = forgeable(hero, itemId);
    const tier = item.tier as Tier;
    if (!canReforge(tier)) throw ApiError.conflict('cannot_reforge', 'Nothing to reforge');
    await pay(tx, hero, REFORGE_COST[tier]!);
    const seed = newSeed();
    const before = item.bonusStats as { stat: string; value: number }[];
    const bonusStats = rollBonusStats(createRng(seed), tier, item.itemLevel);
    await tx.rollLog.create({ data: { playerId: player.id, kind: 'reforge', seed, detail: { itemId: item.id, before, after: bonusStats } } });
    const updated = await tx.item.update({ where: { id: item.id }, data: { bonusStats: bonusStats as unknown as Prisma.InputJsonValue } });
    return { heroId: hero.id, updated, before: bonusLines({ bonusStats: before as never, radiant: item.radiant }) };
  });
  return { item: toItemView(r.updated), before: r.before, hero: await heroView(r.heroId) };
}

export async function salvageItem(player: Player, itemId: string): Promise<SalvageResult> {
  const season = await currentSeason();
  const r = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    const item = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    if (!isGear(baseById(item.base))) throw ApiError.badRequest('not_gear', 'Only gear can be salvaged');
    const seed = newSeed();
    const got = rollSalvage(createRng(seed), item.tier as Tier, item.upgrade);
    if (!got) throw ApiError.conflict('relic', 'Relics can’t be salvaged');
    await destroyItem(tx, hero, item);
    await giveStack(tx, hero, season.id, got.base, got.quantity);
    await tx.rollLog.create({ data: { playerId: player.id, kind: 'salvage', seed, detail: { itemId: item.id, tier: item.tier, ...got } } });
    return { heroId: hero.id, got };
  });
  return { got: { ...r.got, name: baseById(r.got.base).name }, hero: await heroView(r.heroId) };
}

export async function forgeView(player: Player): Promise<ForgeView> {
  const hero = await readHero(player);
  return {
    recipes: RECIPES.map((recipe) => {
      const materials = costView(hero, { gold: 0, materials: recipe.materials }).materials;
      const base = baseById(recipe.makes);
      return {
        id: recipe.id,
        makes: { base: base.id, name: base.name, icon: base.icon },
        materials,
        canCraft: materials.every((m) => m.have >= m.quantity),
      };
    }),
    hero: toHeroView(hero),
  };
}

export async function craft(player: Player, recipeId: string, quantity: number): Promise<HeroView> {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw ApiError.notFound('no_recipe', 'No such recipe');
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    for (const m of recipe.materials) await takeStack(tx, hero, m.base, m.quantity * quantity, 'missing_materials');
    await giveStack(tx, hero, season.id, recipe.makes, quantity);
    return hero.id;
  });
  return heroView(heroId);
}
