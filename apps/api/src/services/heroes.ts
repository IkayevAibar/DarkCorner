import type { Hero, Item, Player, Prisma } from '@prisma/client';
import type {
  AbilitySetView, CreateHeroRequest, CreationOptions, HeroDraft, HeroView, MyHeroResponse, SlotId,
} from '@dark/shared';
import {
  ABILITY_REROLLS, type AbilitySet, BAD_LUCK_MAX, BAG_SLOTS, BANNER_COLORS, BLESSINGS, type BlessingId, CLASS_DEFS, CLASSES,
  type GearBase, PORTRAITS, RACE_DEFS, luckOf,
  RACES, SLOTS, STAMINA_MAX, STARTER_POTIONS, STARTING_GOLD, STORAGE_SLOTS, TALENT_DEFS, TALENTS, armorClass, baseById,
  createRng, currentStamina, portraitById, portraitsFor, restUses, rollAbilitySet, rollGear, slotsFor, startingHealth,
  validateHeroChoices,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { gearData, toItemView } from './items.js';
import { lockHero, requireCity } from './ledger.js';
import { currentSeason } from './seasons.js';

type HeroWithItems = Hero & { items: Item[] };

export function creationOptions(): CreationOptions {
  return {
    races: RACES.map((id) => {
      const r = RACE_DEFS[id];
      return { id, name: r.name, trait: r.trait, talentPicks: r.talentPicks };
    }),
    classes: CLASSES.map((id) => {
      const c = CLASS_DEFS[id];
      return { id, name: c.name, hitDie: c.hitDie, fights: c.fights, trick: c.trick };
    }),
    talents: TALENTS.map((id) => ({ id, name: TALENT_DEFS[id].name, description: TALENT_DEFS[id].description })),
    portraits: PORTRAITS.map((p) => ({ id: p.id, race: p.race, class: p.class, url: p.url })),
    banners: [...BANNER_COLORS],
  };
}

const toSetView = (set: AbilitySet): AbilitySetView => ({ rolls: set.rolls, scores: set.scores, total: set.total });

function toDraftView(draft: { sets: Prisma.JsonValue; rerollsLeft: number }): HeroDraft {
  return { sets: (draft.sets as unknown as AbilitySet[]).map(toSetView), rerollsLeft: draft.rerollsLeft };
}

/** The Blessing still on the Hero, if any. */
export const activeBlessing = (hero: Pick<Hero, 'blessing' | 'blessingUntil'>, now = new Date()): BlessingId | null =>
  hero.blessing && hero.blessingUntil && hero.blessingUntil > now ? (hero.blessing as BlessingId) : null;

/** Magic find, gold find and meter speed from worn gear and the Blessing. */
export function heroLuck(hero: Hero & { items: Item[] }, now = new Date()) {
  const worn = hero.items
    .filter((i) => i.place === 'WORN')
    .map((i) => ({ bonusStats: i.bonusStats as { stat: string; value: number }[], radiant: i.radiant, uniqueId: i.uniqueId }));
  return luckOf({ worn, blessing: activeBlessing(hero, now) });
}

/** The Hero's portrait art, falling back to the hooded figure if its portrait was removed. */
export const portraitUrlOf = (hero: Pick<Hero, 'portrait'>): string =>
  (portraitById(hero.portrait) ?? PORTRAITS[PORTRAITS.length - 1]!).url;

export function toHeroView(hero: HeroWithItems, now = new Date()): HeroView {
  const slotOrder = (slot: string | null) => SLOTS.indexOf(slot as (typeof SLOTS)[number]);
  const worn = hero.items
    .filter((i) => i.place === 'WORN' && i.slot)
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot))
    .map((i) => ({ slot: i.slot as SlotId, item: toItemView(i) }));
  const byAge = (a: Item, b: Item) => a.createdAt.getTime() - b.createdAt.getTime();

  return {
    id: hero.id,
    name: hero.name,
    race: hero.race as HeroView['race'],
    class: hero.class as HeroView['class'],
    talents: hero.talents as HeroView['talents'],
    portrait: hero.portrait,
    portraitUrl: portraitUrlOf(hero),
    banner: hero.banner,
    level: hero.level,
    xp: hero.xp,
    abilities: { str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha },
    maxHp: hero.maxHp,
    hp: hero.hp,
    armorClass: armorClass(
      hero.dex,
      hero.items
        .filter((i) => i.place === 'WORN')
        .map((i) => ({
          base: i.base,
          quality: i.quality,
          upgrade: i.upgrade,
          radiant: i.radiant,
          bonusStats: i.bonusStats as { stat: string; value: number }[],
        })),
    ),
    gold: hero.gold,
    stamina: currentStamina(hero.stamina, hero.staminaAt, now).stamina,
    staminaMax: STAMINA_MAX,
    worn,
    bag: hero.items.filter((i) => i.place === 'BAG').sort(byAge).map(toItemView),
    storage: hero.items.filter((i) => i.place === 'STORAGE').sort(byAge).map(toItemView),
    bagSlots: BAG_SLOTS,
    storageSlots: STORAGE_SLOTS,
    inCity: hero.location === 'CITY',
    luck: luckView(hero, now),
  };
}

function luckView(hero: HeroWithItems, now: Date): HeroView['luck'] {
  const luck = heroLuck(hero, now);
  const blessing = activeBlessing(hero, now);
  return {
    badLuck: hero.badLuck,
    badLuckMax: BAD_LUCK_MAX,
    magicFind: luck.magicFind,
    goldFind: luck.goldFind,
    blessing: blessing
      ? { id: blessing, name: BLESSINGS[blessing].name, description: BLESSINGS[blessing].description, until: hero.blessingUntil!.toISOString() }
      : null,
  };
}

async function seasonHeroes(playerId: string, seasonId: string) {
  return prisma.hero.findMany({ where: { playerId, seasonId }, include: { items: true }, orderBy: { createdAt: 'asc' } });
}

export async function myHeroState(player: Player): Promise<MyHeroResponse> {
  const season = await currentSeason();
  const heroes = await seasonHeroes(player.id, season.id);
  const active = heroes.find((h) => !h.retiredAt) ?? null;
  const draft = active
    ? null
    : await prisma.heroDraft.findUnique({ where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } } });
  return {
    season: season.number,
    hero: active ? toHeroView(active) : null,
    draft: draft ? toDraftView(draft) : null,
    canCreate: !active && heroes.length < 2,
    canRetire: Boolean(active) && heroes.length < 2,
  };
}

async function logAbilityRoll(playerId: string, seed: string, set: AbilitySet) {
  await prisma.rollLog.create({
    data: { playerId, kind: 'abilities', seed, detail: set as unknown as Prisma.InputJsonValue },
  });
}

/** Starts creating a Hero: rolls the first ability set. Returns the existing draft if there is one. */
export async function startDraft(player: Player): Promise<HeroDraft> {
  const state = await myHeroState(player);
  if (!state.canCreate) throw ApiError.conflict('cannot_create', 'You already have a Hero this Season');
  const season = await currentSeason();
  const key = { playerId_seasonId: { playerId: player.id, seasonId: season.id } };

  const existing = await prisma.heroDraft.findUnique({ where: key });
  if (existing) return toDraftView(existing);

  const seed = newSeed();
  const set = rollAbilitySet(createRng(seed));
  await logAbilityRoll(player.id, seed, set);
  const draft = await prisma.heroDraft.upsert({
    where: key,
    create: { playerId: player.id, seasonId: season.id, sets: [set] as unknown as Prisma.InputJsonValue, rerollsLeft: ABILITY_REROLLS },
    update: {},
  });
  return toDraftView(draft);
}

export async function rerollDraft(player: Player): Promise<HeroDraft> {
  const season = await currentSeason();
  const seed = newSeed();
  const set = rollAbilitySet(createRng(seed));

  const draft = await prisma.$transaction(async (tx) => {
    // Claim a reroll atomically so two taps can't spend one.
    const claimed = await tx.heroDraft.updateMany({
      where: { playerId: player.id, seasonId: season.id, rerollsLeft: { gt: 0 } },
      data: { rerollsLeft: { decrement: 1 } },
    });
    if (claimed.count === 0) throw ApiError.conflict('no_rerolls', 'No rerolls left');
    const current = await tx.heroDraft.findUniqueOrThrow({
      where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } },
    });
    const sets = [...(current.sets as unknown as AbilitySet[]), set];
    return tx.heroDraft.update({ where: { id: current.id }, data: { sets: sets as unknown as Prisma.InputJsonValue } });
  });
  await logAbilityRoll(player.id, seed, set);
  return toDraftView(draft);
}

export async function createHero(player: Player, request: CreateHeroRequest): Promise<HeroView> {
  const problems = validateHeroChoices(request);
  if (problems.length > 0) throw ApiError.badRequest('invalid_hero', 'Those choices do not make a Hero', problems);
  if (!portraitsFor(request.race, request.class).some((p) => p.id === request.portrait)) {
    throw ApiError.badRequest('bad_portrait', 'That portrait is not offered for this Race and Class');
  }
  if (!(BANNER_COLORS as readonly string[]).includes(request.banner)) {
    throw ApiError.badRequest('bad_banner', 'Unknown banner color');
  }

  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const draft = await tx.heroDraft.findUnique({ where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } } });
    if (!draft) throw ApiError.conflict('no_draft', 'Roll ability scores first');
    const set = (draft.sets as unknown as AbilitySet[])[request.set];
    if (!set) throw ApiError.badRequest('bad_set', 'No such ability set');

    // Deleting the draft is the lock: a second request racing this one finds nothing to delete.
    const claimed = await tx.heroDraft.deleteMany({ where: { id: draft.id } });
    if (claimed.count === 0) throw ApiError.conflict('no_draft', 'Roll ability scores first');

    const heroes = await tx.hero.findMany({ where: { playerId: player.id, seasonId: season.id } });
    if (heroes.some((h) => !h.retiredAt) || heroes.length >= 2) {
      throw ApiError.conflict('cannot_create', 'You already have a Hero this Season');
    }
    const retired = heroes.find((h) => h.retiredAt) ?? null;

    const maxHp = startingHealth(request.class, request.race, request.talents, set.scores.con);
    const hero = await tx.hero.create({
      data: {
        playerId: player.id,
        seasonId: season.id,
        name: request.name.trim(),
        race: request.race,
        class: request.class,
        talents: request.talents,
        portrait: request.portrait,
        banner: request.banner,
        ...set.scores,
        maxHp,
        hp: maxHp,
        gold: STARTING_GOLD + (retired?.gold ?? 0),
        stamina: STAMINA_MAX,
        spellUses: restUses(request.class, 1).spells,
        healUses: restUses(request.class, 1).heals,
      },
    });

    if (retired) {
      // Storage and gold carry over from a retired Hero (docs/design.md → Retiring).
      await tx.item.updateMany({ where: { heroId: retired.id, place: 'STORAGE' }, data: { heroId: hero.id } });
      await tx.hero.update({ where: { id: retired.id }, data: { gold: 0 } });
    }

    await giveStarterKit(tx, hero, season.id);
    return hero.id;
  });

  const hero = await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } });
  return toHeroView(hero);
}

/** The free Common kit: worn where a slot is free, otherwise into the Bag; plus potions. */
export async function giveStarterKit(tx: Prisma.TransactionClient, hero: Hero, seasonId: string): Promise<void> {
  const worn = new Set(
    (await tx.item.findMany({ where: { heroId: hero.id, place: 'WORN' }, select: { slot: true } })).map((i) => i.slot),
  );
  for (const baseId of CLASS_DEFS[hero.class as keyof typeof CLASS_DEFS].starterKit) {
    const seed = newSeed();
    const roll = rollGear(createRng(seed), { tier: 'common', itemLevel: 1, baseId, identified: true, radiant: false, quality: 50 });
    const slot = slotsFor(baseById(baseId) as GearBase).find((s) => !worn.has(s)) ?? null;
    if (slot) worn.add(slot);
    await tx.item.create({
      data: { ...gearData(roll, seed), seasonId, heroId: hero.id, place: slot ? 'WORN' : 'BAG', slot },
    });
  }
  await tx.item.create({
    data: { seasonId, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common', quantity: STARTER_POTIONS },
  });
}

/** Once per Season: the Hero steps aside, and everything it had goes to Storage. */
export async function retireHero(player: Player): Promise<void> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const active = await lockHero(tx, player, season.id);
    // The Temple is in the City: a Hero in the Labyrinth has to come home first.
    requireCity(active);
    const heroes = await tx.hero.count({ where: { playerId: player.id, seasonId: season.id } });
    if (heroes >= 2) throw ApiError.conflict('retire_used', 'You have already retired a Hero this Season');
    await tx.item.updateMany({
      where: { heroId: active.id, place: { in: ['WORN', 'BAG'] } },
      data: { place: 'STORAGE', slot: null },
    });
    await tx.hero.update({ where: { id: active.id }, data: { retiredAt: new Date() } });
  });
}
