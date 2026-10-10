import type { Hero, Item, Player, Prisma } from '@prisma/client';
import type {
  AbilitySetView, CreateHeroRequest, CreationOptions, GrowRequest, HeroDraft, HeroView, LevelUpRequest, LevelUpResponse, LevelUpView, MyHeroResponse,
  PathView, SlotId, AbilityId,
} from '@dark/shared';
import {
  ABILITY_REROLLS, type AbilitySet, BAD_LUCK_MAX, BAG_SLOTS, BANNER_COLORS, BLESSINGS, type BlessingId, CLASS_DEFS, CLASSES,
  DAY_MS, type GearBase, PORTRAITS, RACE_DEFS, type Tier, UNCOMMON_KIT_AFTER_DAYS, isGear, itemName, luckOf, tierRank,
  RACES, SLOTS, STAMINA_MAX, STARTER_POTIONS, STARTING_GOLD, STORAGE_SLOTS, TALENT_DEFS, TALENTS, baseById, heroArmorClass,
  type ClassId, type Growth, type GrowthChoice, ORIGIN_TALENTS, PATH_DEFS, PATH_LEVEL, type PathId, type TalentId, createRng, currentStamina, maxHealth,
  pathsOf, pendingGrowth, portraitById, portraitClass, portraitsFor, restUses, rollAbilitySet, rollGear, kitSlots, startingHealth, talentOffer,
  validateGrowth, validateHeroChoices, MAX_LEVEL, XP_FOR_LEVEL, type RaceId, levelChoice, levelGains,
  ABILITIES, type AbilityScores, BONUS_STATS, charmOf, critFromOf, escapeSteps, gearScores, onPath, statTotal,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { gearData, toItemView } from './items.js';
import { blessingText } from './days.js';
import { deedViews, isDone } from './deeds.js';
import { type Tx, lockHero, requireCity } from './ledger.js';
import { levelReady, raiseLevel } from './progression.js';
import { currentSeason } from './seasons.js';
import { gameNow, gameNowMs } from '../gameClock.js';

type HeroWithItems = Hero & { items: Item[] };

export function creationOptions(): CreationOptions {
  return {
    races: RACES.map((id) => {
      const r = RACE_DEFS[id];
      return { id, name: r.name, trait: r.trait, talentPicks: r.talentPicks };
    }),
    classes: CLASSES.map((id) => {
      const c = CLASS_DEFS[id];
      return { id, name: c.name, hitDie: c.hitDie, fights: c.fights, trick: c.trick, primary: c.primary, wears: portraitClass(id) };
    }),
    talents: TALENTS.map((id) => ({
      id, name: TALENT_DEFS[id].name, description: TALENT_DEFS[id].description, origin: (ORIGIN_TALENTS as readonly string[]).includes(id),
    })),
    portraits: PORTRAITS.map((p) => ({ id: p.id, race: p.race, class: p.class, url: p.url })),
    banners: [...BANNER_COLORS],
  };
}

const toSetView = (set: AbilitySet): AbilitySetView => ({ rolls: set.rolls, scores: set.scores, total: set.total });

function toDraftView(draft: { sets: Prisma.JsonValue; rerollsLeft: number }): HeroDraft {
  return { sets: (draft.sets as unknown as AbilitySet[]).map(toSetView), rerollsLeft: draft.rerollsLeft };
}

/** The Blessing still on the Hero, if any. */
export const activeBlessing = (hero: Pick<Hero, 'blessing' | 'blessingUntil'>, now = gameNow()): BlessingId | null =>
  hero.blessing && hero.blessingUntil && hero.blessingUntil > now ? (hero.blessing as BlessingId) : null;

/** Magic find, gold find and meter speed from worn gear and the Blessing. */
/** The Hero's worn gear as far as its Bonus stats go (Radiant, Upgrades and two hands count; joined Bond rings only in a Duo's fights). */
const wornStats = (hero: Hero & { items: Item[] }) => hero.items
  .filter((i) => i.place === 'WORN')
  .map((i) => ({ base: i.base, bonusStats: i.bonusStats as { stat: string; value: number }[], radiant: i.radiant, upgrade: i.upgrade, uniqueId: i.uniqueId }));

export function heroLuck(hero: Hero & { items: Item[] }, now = gameNow()) {
  return luckOf({ worn: wornStats(hero), blessing: activeBlessing(hero, now), talents: hero.talents as TalentId[], path: hero.path as PathId | null, level: hero.level });
}

/** Full health with the gear the Hero wears: what the City, a Camp's rest and potions fill up to. */
export function fullHealth(hero: Hero & { items: Item[] }): number {
  return maxHealth(hero.maxHp, wornStats(hero));
}

const baseScores = (hero: Hero): AbilityScores => ({ str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha });

/** The Hero's ability scores with its worn gear: what every Check rolls with, as fights do. */
export function scoresOf(hero: Hero & { items: Item[] }): AbilityScores {
  return gearScores(baseScores(hero), wornStats(hero));
}

/** What worn gear adds to the Hero, for the Character sheet and the Item cards' explanations. */
function gearView(hero: Hero & { items: Item[] }): HeroView['gear'] {
  const base = baseScores(hero);
  const scores = scoresOf(hero);
  const worn = wornStats(hero);
  const stats: HeroView['gear']['stats'] = {};
  for (const { id } of BONUS_STATS) {
    if ((ABILITIES as readonly string[]).includes(id)) continue;
    const total = statTotal(worn, id);
    if (total !== 0) stats[id] = total;
  }
  const champion = onPath({ path: hero.path as PathId | null, level: hero.level }, 'champion');
  return {
    abilities: Object.fromEntries(ABILITIES.map((a) => [a, scores[a] - base[a]])) as AbilityScores,
    stats,
    critFrom: critFromOf(stats.crit ?? 0, champion),
    escape: escapeSteps(stats.escape ?? 0),
    charm: Math.round(charmOf(scores.cha) * 100),
  };
}

/** The Hero's portrait art, falling back to the hooded figure if its portrait was removed. */
export const portraitUrlOf = (hero: Pick<Hero, 'portrait'>): string =>
  (portraitById(hero.portrait) ?? PORTRAITS[PORTRAITS.length - 1]!).url;

export function toHeroView(hero: HeroWithItems, now = gameNow()): HeroView {
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
    abilities: baseScores(hero),
    maxHp: fullHealth(hero),
    hp: Math.min(hero.hp, fullHealth(hero)),
    gear: gearView(hero),
    armorClass: heroArmorClass(
      { class: hero.class as ClassId, level: hero.level, path: hero.path as PathId | null, talents: hero.talents as TalentId[], scores: scoresOf(hero) },
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
    training: hero.training && hero.trainingUntil && hero.trainingUntil > now
      ? { ability: hero.training as AbilityId, until: hero.trainingUntil.toISOString() } : null,
    luck: luckView(hero, now),
    ...growthView(hero),
    deeds: deedViews(hero),
    title: hero.title,
  };
}

const talentView = (id: TalentId) => ({ id, name: TALENT_DEFS[id].name, description: TALENT_DEFS[id].description });

function pathView(id: PathId, level: number): PathView {
  const def = PATH_DEFS[id];
  return {
    id, name: def.name, blurb: def.blurb,
    features: def.features.map((f) => ({ level: f.level, name: f.name, text: f.text, unlocked: level >= f.level })),
  };
}

/** The Path, and the choices a Hero has waiting as it grows. */
function growthView(hero: Hero): Pick<HeroView, 'path' | 'pathChoices' | 'pendingGrowth' | 'talentOffer' | 'xpNext' | 'levelUp'> {
  const pending = pendingGrowth(hero.level, hero.growths as unknown as Growth[]);
  return {
    path: hero.path ? pathView(hero.path as PathId, hero.level) : null,
    pathChoices: !hero.path && hero.level >= PATH_LEVEL ? pathsOf(hero.class as ClassId).map((p) => pathView(p.id, hero.level)) : null,
    pendingGrowth: pending,
    talentOffer: pending.length > 0 ? talentOffer(hero.id, pending[0]!, hero.talents as TalentId[]).map(talentView) : null,
    xpNext: hero.level < MAX_LEVEL ? XP_FOR_LEVEL[hero.level + 1]! : null,
    levelUp: levelUpView(hero),
  };
}

const leveling = (hero: Hero) => ({
  class: hero.class as ClassId, race: hero.race as RaceId, path: hero.path as PathId | null, level: hero.level, con: hero.con,
  talents: hero.talents as TalentId[],
});

/** The next level while its XP is there: what it gives, and its choice with what is on offer. */
function levelUpView(hero: Hero): LevelUpView | null {
  if (!levelReady(hero)) return null;
  const level = hero.level + 1;
  const choice = levelChoice(leveling(hero));
  return {
    level,
    gains: levelGains(leveling(hero)),
    choice,
    paths: choice === 'path' ? pathsOf(hero.class as ClassId).map((p) => pathView(p.id, level)) : null,
    talents: choice === 'growth' ? talentOffer(hero.id, level, hero.talents as TalentId[]).map(talentView) : null,
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
      ? {
        id: blessing, name: BLESSINGS[blessing].name, description: blessingText(blessing), until: hero.blessingUntil!.toISOString(),
        curse: BLESSINGS[blessing].curse === true,
      }
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

/**
 * The free kit: worn where a slot is free, otherwise into the Bag; plus potions.
 * Common, or Uncommon once the Season is two weeks old (late joiners).
 */
export async function giveStarterKit(tx: Prisma.TransactionClient, hero: Hero, seasonId: string): Promise<void> {
  const worn = new Map(
    (await tx.item.findMany({ where: { heroId: hero.id, place: 'WORN' }, select: { slot: true, base: true } })).map((i) => [i.slot ?? '', i.base]),
  );
  const season = await tx.season.findUnique({ where: { id: seasonId } });
  const late = season?.startsAt && gameNowMs() - season.startsAt.getTime() >= UNCOMMON_KIT_AFTER_DAYS * DAY_MS;
  const kit = CLASS_DEFS[hero.class as keyof typeof CLASS_DEFS].starterKit;
  const slots = kitSlots(kit, worn);
  for (const [i, baseId] of kit.entries()) {
    const seed = newSeed();
    const roll = rollGear(createRng(seed), { tier: late ? 'uncommon' : 'common', itemLevel: 1, baseId, identified: true, radiant: false, quality: 50 });
    const slot = slots[i] ?? null;
    await tx.item.create({
      data: { ...gearData(roll, seed), seasonId, heroId: hero.id, place: slot ? 'WORN' : 'BAG', slot },
    });
  }
  await tx.item.create({
    data: { seasonId, heroId: hero.id, place: 'BAG', base: 'potion', tier: 'common', quantity: STARTER_POTIONS },
  });
}

/** At level 3 and up, once: the Hero chooses one of its Class's two Paths. */
async function applyPath(tx: Tx, hero: Hero, path: PathId): Promise<void> {
  if (hero.path) throw ApiError.conflict('path_chosen', 'This Hero has already chosen its Path');
  if (hero.level < PATH_LEVEL) throw ApiError.conflict('too_early', 'A Path is chosen at level 3');
  if (PATH_DEFS[path].class !== hero.class) throw ApiError.badRequest('wrong_class', 'That Path is for another Class');
  await tx.hero.update({ where: { id: hero.id }, data: { path } });
}

/**
 * At a growth level (4, 8, 12, 16, 19) the Hero takes +2 to one ability, +1 to
 * two, or one of the three Talents offered to it. Tough counts for every level
 * already gained.
 */
async function applyGrowth(tx: Tx, hero: Hero, request: GrowRequest): Promise<void> {
  const growths = hero.growths as unknown as Growth[];
  if (!pendingGrowth(hero.level, growths).includes(request.level)) throw ApiError.conflict('no_growth', 'Nothing to choose at that level');
  const choice = request.choice as GrowthChoice;
  const scores = { str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha };
  const problems = validateGrowth(choice, scores, talentOffer(hero.id, request.level, hero.talents as TalentId[]));
  if (problems.length > 0) throw ApiError.badRequest('invalid_growth', 'That is not on offer', problems);

  const data: Prisma.HeroUpdateInput = { growths: [...growths, { level: request.level, ...choice }] as unknown as Prisma.InputJsonValue };
  if (choice.kind === 'ability') data[choice.ability] = { increment: 2 };
  if (choice.kind === 'abilities') for (const a of choice.abilities) data[a] = { increment: 1 };
  if (choice.kind === 'talent') {
    data.talents = { push: choice.talent };
    if (choice.talent === 'tough') {
      data.maxHp = { increment: 2 * hero.level };
      data.hp = { increment: 2 * hero.level };
    }
  }
  await tx.hero.update({ where: { id: hero.id }, data });
}

const heroById = async (id: string) => toHeroView(await prisma.hero.findUniqueOrThrow({ where: { id }, include: { items: true } }));

/** A Path a Hero reached level 3 without choosing (a level taken before level-ups asked). */
export async function choosePath(player: Player, path: PathId): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await applyPath(tx, hero, path);
    return hero.id;
  });
  return heroById(heroId);
}

/** Wears a done Deed's Title after the Hero's name, or none. */
export async function setTitle(player: Player, deed: string | null): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    if (deed !== null && !isDone(hero, deed)) throw ApiError.badRequest('deed_not_done', 'That Deed is not done yet');
    await tx.hero.update({ where: { id: hero.id }, data: { title: deed } });
    return hero.id;
  });
  return heroById(heroId);
}

/** A growth choice still waiting from a level taken before level-ups asked. */
export async function growHero(player: Player, request: GrowRequest): Promise<HeroView> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await applyGrowth(tx, hero, request);
    return hero.id;
  });
  return heroById(heroId);
}

/**
 * The Player takes the next level by hand, once its XP is there, and makes the
 * level's choice with it (docs/design.md → Levels). Anywhere, even mid-Run.
 */
export async function levelUpHero(player: Player, request: LevelUpRequest): Promise<LevelUpResponse> {
  const season = await currentSeason();
  const { heroId, health } = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    if (!levelReady(hero)) throw ApiError.conflict('not_ready', 'Not enough XP for the next level');
    const choice = levelChoice(leveling(hero));
    if (choice === 'path' && !request.path) throw ApiError.badRequest('choose_path', 'This level asks for a Path');
    if (choice === 'growth' && !request.grow) throw ApiError.badRequest('choose_growth', 'This level asks for abilities or a Talent');

    const seed = newSeed();
    const raised = raiseLevel(createRng(seed), hero);
    const hero2 = await tx.hero.update({ where: { id: hero.id }, data: raised.data });
    if (choice === 'path') await applyPath(tx, hero2, request.path!);
    if (choice === 'growth') await applyGrowth(tx, hero2, { level: hero2.level, choice: request.grow! });
    await tx.rollLog.create({
      data: { playerId: hero.playerId, kind: 'level-up', seed, detail: { level: hero2.level, roll: raised.health.roll, gain: raised.health.gain } },
    });
    return { heroId: hero.id, health: raised.health };
  });
  const hero = await heroById(heroId);
  return { hero, health: { die: CLASS_DEFS[hero.class].hitDie, ...health } };
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
    await tx.hero.update({ where: { id: active.id }, data: { retiredAt: gameNow(), partnerId: null } });
    // Its Duo ends: the partner goes on alone.
    await tx.hero.updateMany({ where: { partnerId: active.id }, data: { partnerId: null } });
  });
}

/** For the hub's dashboard card: the Hero this Season, its depth and its best identified Item. */
export async function heroSummary(playerId: string) {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId, seasonId: season.id, retiredAt: null }, include: { items: true } });
  if (!hero) return null;
  const rank = (tier: string) => tierRank(tier as Tier);
  const best = hero.items
    .filter((i) => i.place !== 'GRAVE' && i.place !== 'MARKET' && i.identified && isGear(baseById(i.base)))
    .sort((a, b) => rank(b.tier) - rank(a.tier) || b.upgrade - a.upgrade)[0];
  return {
    name: hero.name,
    level: hero.level,
    bestFloor: hero.bestFloor,
    bestItem: best ? { name: itemName(best), tier: best.tier } : null,
  };
}