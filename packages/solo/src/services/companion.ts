import type { Hero, Item, Player, Prisma, Season } from '@prisma/client';
import type { GrowRequest, ItemView, LocalizedText } from '@dark/shared';
import {
  ABILITY_CAP, type Ability, BAG_SLOTS, BANNER_COLORS, CLASS_DEFS, CLASSES, type ClassId, type GearBase, type GrowthChoice, type Oath, type PathId, RACES,
  type RaceId, SHORT_RESTS, STAMINA_MAX, STORAGE_SLOTS, type TalentId, XP_FOR_LEVEL, baseById, canUse, createRng, isGear, levelChoice, pathsOf,
  portraitsFor, restUses, startingHealth, talentOffer, wearPlan,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { gameNow, nextMorning } from '../gameClock.js';
import { worldSettings } from '../settings.js';
import { applyGrowth, applyPath, fullHealth, giveStarterKit, portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import { type HeroWithItems, type Tx, dayNumber, freePlace, lockHero, ownItem, requireCity } from './ledger.js';
import { raiseLevel } from './progression.js';
import { labyrinthFor } from './labyrinth.js';
import { currentSeason } from './seasons.js';

// The Companion (docs/design.md → The solo game → The Companion): a Hero of another
// Class, hired at the Tavern and played by the AI as the Hero's Duo partner. It is a
// Hero like any other, owned by a Player of its own, so the Duo code walks, fights and
// shares with it as with a friend's Hero. What makes it a Companion lives here: its
// wage, its level, its loyalty, and where it goes when it falls or leaves. Solo only.

const t = (en: string, ru: string): LocalizedText => ({ en, ru });

/** The Player every Companion belongs to: never signed in, never ranked, always beside its Hero. */
export const COMPANION_PLAYER = 'companion';
export const isCompanion = (hero: Pick<Hero, 'playerId'> | null | undefined): boolean => hero?.playerId === COMPANION_PLAYER;

/** Its wage each morning, for each of its levels (v0). */
export const WAGE_PER_LEVEL = 20;
/** Loyalty runs from 0 to LOYALTY_MAX and starts at LOYALTY_START; at LOYAL or more it swears Share (v0). */
export const LOYALTY_MAX = 10;
export const LOYALTY_START = 5;
export const LOYAL = 5;
/** What sharing with it earns, and what taking costs (v0). */
export const SHARE_EARNS = 1;
export const TAKE_COSTS = 2;
/** Offers at the Tavern each Day (v0). */
const OFFERS = 3;
/** How long a Grave lasts: two nights, as a Hero's (fights.ts). */
const GRAVE_MS = 48 * 60 * 60 * 1000;

const wageOf = (level: number): number => WAGE_PER_LEVEL * level;

// ─── Its state ────────────────────────────────────────────────────────────

/** What a Companion is to its Hero, kept between Days in the World's Setting table. */
interface CompanionState {
  /** The Companion's own Hero. */
  heroId: string;
  /** The Hero it serves. */
  masterId: string;
  loyalty: number;
  /** Its wage is paid until this morning. */
  paidUntil: string;
  /** Fallen: back at its Hero's side this morning. */
  downUntil: string | null;
}

const KEY = 'companion';

async function stateOf(tx: Tx): Promise<CompanionState | null> {
  const row = await tx.setting.findUnique({ where: { key: KEY } });
  return row ? (row.value as unknown as CompanionState) : null;
}

async function save(tx: Tx, state: CompanionState | null): Promise<void> {
  if (!state) {
    await tx.setting.deleteMany({ where: { key: KEY } });
    return;
  }
  const value = state as unknown as Prisma.InputJsonValue;
  await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

// ─── The Tavern's offers ──────────────────────────────────────────────────

/** Names a Companion goes by, the same one in each language. */
const NAMES = {
  en: ['Brann', 'Ysolde', 'Corvin', 'Tamsin', 'Odile', 'Fenwick', 'Mirela', 'Rook', 'Halvard', 'Sabine', 'Ivo', 'Wren', 'Astrid', 'Kestrel', 'Lorcan', 'Neve', 'Orrin', 'Petra', 'Quill', 'Runa'],
  ru: ['Бранн', 'Изольда', 'Корвин', 'Тамсин', 'Одиль', 'Фенвик', 'Мирела', 'Рук', 'Хальвард', 'Сабина', 'Иво', 'Рен', 'Астрид', 'Кестрел', 'Лоркан', 'Нив', 'Оррин', 'Петра', 'Квилл', 'Руна'],
} as const;

/** One of the Tavern's Companions for the Day, as the Player sees it. */
export interface CompanionOffer {
  name: string;
  class: ClassId;
  race: RaceId;
  portraitUrl: string;
  banner: string;
  level: number;
  /** Paid on hiring, and again each morning. */
  wage: number;
}

interface Offer extends CompanionOffer {
  portrait: string;
}

/** The language its name is given in: the one the screen asks in, else the Player's own. */
const localeOf = (player: Pick<Player, 'locale'>, asked?: string): 'en' | 'ru' => ((asked ?? player.locale) === 'ru' ? 'ru' : 'en');

/** The Tavern's three for the Day: Classes other than the Hero's, at its level, the same all Day. */
function offersFor(hero: Hero, season: Pick<Season, 'seed'>, locale: 'en' | 'ru', now: Date): Offer[] {
  const rng = createRng(`${season.seed}:companions:${hero.id}:${dayNumber(now)}`);
  const classes = CLASSES.filter((c) => c !== hero.class);
  const names = NAMES.en.map((_, i) => i).filter((i) => NAMES.en[i] !== hero.name && NAMES.ru[i] !== hero.name);
  const offers: Offer[] = [];
  for (let n = 0; n < OFFERS; n++) {
    const cls = classes.splice(rng.int(0, classes.length - 1), 1)[0]!;
    const name = names.splice(rng.int(0, names.length - 1), 1)[0]!;
    const race = rng.pick(RACES);
    // Its own Class's portraits first; the ones for anyone only when there are none.
    const offered = portraitsFor(race, cls);
    const own = offered.filter((p) => p.class !== null);
    const portrait = rng.pick(own.length > 0 ? own : offered).id;
    offers.push({
      name: NAMES[locale][name]!, class: cls, race, portrait, portraitUrl: portraitUrlOf({ portrait }), banner: rng.pick(BANNER_COLORS),
      level: hero.level, wage: wageOf(hero.level),
    });
  }
  return offers;
}

// ─── Its make and its levels ──────────────────────────────────────────────

/** A second ability a Class leans on, as for par Heroes: a Monk's WIS, a Paladin's CHA. */
const SECOND: Partial<Record<ClassId, Ability>> = { monk: 'wis', paladin: 'cha' };
const TALENTS: TalentId[] = ['alert', 'tough'];

/** Its ability scores: a par Hero's, its Class's ability first. */
function scoresFor(cls: ClassId): Record<Ability, number> {
  const second = SECOND[cls];
  return { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, ...(second ? { [second]: 14 } : {}), [CLASS_DEFS[cls].primary]: 16 };
}

/** Its growth: +2 to the ability its Class leans on most that still has room, or else a Talent. */
function growthFor(c: Hero): GrowthChoice {
  const cls = c.class as ClassId;
  const second = SECOND[cls];
  const order: Ability[] = [CLASS_DEFS[cls].primary, ...(second ? [second] : []), 'con', 'dex', 'wis', 'str', 'int', 'cha'];
  const scores: Record<Ability, number> = { str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha };
  const ability = order.find((a) => scores[a] + 2 <= ABILITY_CAP);
  return ability ? { kind: 'ability', ability } : { kind: 'talent', talent: talentOffer(c.id, c.level, c.talents as TalentId[])[0]! };
}

/** Up to its Hero's level, a level at a time as a Hero takes them, its Path and growth chosen for it. */
async function raiseTo(tx: Tx, companion: Hero, level: number): Promise<Hero> {
  let c = companion;
  while (c.level < level) {
    const choice = levelChoice({ path: c.path as PathId | null, level: c.level });
    const raised = raiseLevel(createRng(`${c.id}:level:${c.level + 1}`), c);
    c = await tx.hero.update({ where: { id: c.id }, data: { ...raised.data, xp: XP_FOR_LEVEL[c.level + 1]! } });
    if (choice === 'path') await applyPath(tx, c, pathsOf(c.class as ClassId)[0]!.id);
    if (choice === 'growth') await applyGrowth(tx, c, { level: c.level, choice: growthFor(c) } as GrowRequest);
    c = await tx.hero.findUniqueOrThrow({ where: { id: c.id } });
  }
  return c;
}

// ─── Beside its Hero ──────────────────────────────────────────────────────

/** Beside its Hero as its Partner: where the Hero stands, knowing all the Hero knows of the Labyrinth. */
async function join(tx: Tx, hero: HeroWithItems, companion: HeroWithItems): Promise<void> {
  const data = {
    location: hero.location, floor: hero.floor, room: hero.room, prevRoom: hero.prevRoom, facing: hero.facing, campSince: hero.campSince,
    partnerId: hero.id, waypoints: [...new Set([...companion.waypoints, ...hero.waypoints])], bestFloor: Math.max(companion.bestFloor, hero.bestFloor),
  };
  await tx.hero.update({ where: { id: companion.id }, data });
  Object.assign(companion, data);
  await tx.hero.update({ where: { id: hero.id }, data: { partnerId: companion.id } });
  hero.partnerId = companion.id;
  // Its map is its Hero's: the Rooms the Hero has stood in, and those it has cleared.
  for (const f of await tx.heroFloor.findMany({ where: { heroId: hero.id } })) {
    const map = { seen: f.seen, cleared: f.cleared as Prisma.InputJsonValue };
    await tx.heroFloor.upsert({
      where: { heroId_floor: { heroId: companion.id, floor: f.floor } },
      create: { heroId: companion.id, floor: f.floor, ...map },
      update: map,
    });
  }
}

/** The Hero stands in the Dragon's lair, where it is faced alone. */
async function inLair(tx: Tx, hero: Hero): Promise<boolean> {
  if (hero.location !== 'LABYRINTH' || hero.floor === null || hero.room === null) return false;
  const season = await tx.season.findUniqueOrThrow({ where: { id: hero.seasonId } });
  return labyrinthFor(season).floors[hero.floor - 1]?.rooms[hero.room]?.type === 'boss';
}

/**
 * The Companion leaves its Hero: what it wears goes back to the Hero, into the Bag (or
 * Storage when the Bag is full in the City; all into Storage, `toStorage`, for the next
 * Hero when this one is gone). Its own things go with it.
 */
async function letGo(tx: Tx, hero: HeroWithItems, companion: HeroWithItems, toStorage = false): Promise<void> {
  if (hero.partnerId === companion.id) {
    await tx.hero.update({ where: { id: hero.id }, data: { partnerId: null } });
    hero.partnerId = null;
  }
  for (const item of companion.items.filter((i) => i.place === 'WORN')) {
    const place = toStorage ? 'STORAGE' : (freePlace(hero) ?? 'BAG');
    const back = await tx.item.update({ where: { id: item.id }, data: { heroId: hero.id, place, slot: null } });
    hero.items.push(back);
  }
  await tx.item.deleteMany({ where: { heroId: companion.id } });
  await tx.heroFloor.deleteMany({ where: { heroId: companion.id } });
  await tx.hero.update({
    where: { id: companion.id },
    data: { retiredAt: gameNow(), partnerId: null, location: 'CITY', floor: null, room: null, prevRoom: null, facing: false },
  });
  await save(tx, null);
}

/**
 * Before each of the Hero's actions: the wage each morning (unpaid, it leaves), its
 * level kept to its Hero's, a fallen Companion back in the morning, and back beside its
 * Hero whenever they stand in one place or the Hero is home. A fight under way waits.
 */
export async function tendCompanion(tx: Tx, hero: HeroWithItems, now: Date, out?: { notices: LocalizedText[] }): Promise<void> {
  const state = await stateOf(tx);
  if (!state) return;
  if (state.masterId !== hero.id) {
    // Its Hero is gone, Retired or fallen for good, which let it go: nothing is left to tend.
    await save(tx, null);
    return;
  }
  if (await tx.fight.count({ where: { OR: [{ heroId: hero.id }, { partnerId: hero.id }] } }) > 0) return;
  const companion = await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } });
  if (!companion || companion.retiredAt) {
    await save(tx, null);
    return;
  }
  const name = companion.name;

  // Its wage, for each morning since the last one paid: City gold first, then what the Hero carries.
  let paidUntil = new Date(state.paidUntil).getTime();
  while (paidUntil <= now.getTime()) {
    const wage = wageOf(hero.level);
    if (hero.gold + hero.carriedGold < wage) {
      await letGo(tx, hero, companion);
      out?.notices.push(t(
        `You can't pay ${name} this morning's ${wage} gold. Your Companion leaves your service, and gives back your gear.`,
        `Вам нечем заплатить ${name} утренние ${wage} золота. Спутник уходит от вас и возвращает ваше снаряжение.`,
      ));
      return;
    }
    const fromGold = Math.min(hero.gold, wage);
    hero.gold -= fromGold;
    hero.carriedGold -= wage - fromGold;
    await tx.hero.update({ where: { id: hero.id }, data: { gold: hero.gold, carriedGold: hero.carriedGold } });
    out?.notices.push(t(`${name} takes this morning's wage: ${wage} gold.`, `${name} берёт утреннее жалованье: ${wage} золота.`));
    paidUntil = nextMorning(paidUntil);
  }
  state.paidUntil = new Date(paidUntil).toISOString();

  // Always its Hero's level.
  if (companion.level < hero.level) Object.assign(companion, await raiseTo(tx, companion, hero.level));

  // Fallen yesterday: back on its feet this morning, and on its way to its Hero.
  let revived = false;
  if (state.downUntil && new Date(state.downUntil) <= now) {
    state.downUntil = null;
    revived = true;
    const uses = restUses(companion.class as ClassId, companion.level, companion.path as PathId | null);
    const fresh = {
      hp: fullHealth(companion), hpAt: now, spellUses: uses.spells, healUses: uses.heals, stamina: STAMINA_MAX, staminaAt: now,
      shortRests: SHORT_RESTS, shortRestsAt: now, deathless: true, lucky: true,
    };
    await tx.hero.update({ where: { id: companion.id }, data: fresh });
    Object.assign(companion, fresh);
    out?.notices.push(t(`${name} is back on its feet, and at your side again.`, `${name} снова на ногах и рядом с вами.`));
  }

  // Beside its Hero again: back from the lair's door, home with it, or up this morning. Somehow
  // apart, it catches up. Into the lair it never follows: there it waits for its Hero's return.
  if (!state.downUntil) {
    const beside = companion.location === hero.location && companion.floor === hero.floor && companion.room === hero.room;
    const rejoins = hero.partnerId === companion.id ? !beside : !hero.partnerId && (beside || revived || hero.location === 'CITY');
    if (rejoins && !(await inLair(tx, hero))) await join(tx, hero, companion);
  }
  await save(tx, state);
}

/** The Hero's Companion with it now, beside it or at the lair's door; null without one, or while it is down. */
export async function companionOf(tx: Tx, hero: Pick<Hero, 'id'>): Promise<HeroWithItems | null> {
  const state = await stateOf(tx);
  if (!state || state.masterId !== hero.id || state.downUntil) return null;
  const companion = await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } });
  return companion && !companion.retiredAt ? companion : null;
}

/** Into the Dragon's lair the Hero goes alone: its Companion waits at the door, out of the Duo until they meet again. */
export async function waitAtLair(tx: Tx, hero: Hero, companion: Hero, out: { notices: LocalizedText[] }): Promise<void> {
  await tx.hero.updateMany({ where: { id: { in: [hero.id, companion.id] } }, data: { partnerId: null } });
  hero.partnerId = null;
  companion.partnerId = null;
  out.notices.push(t(
    `${companion.name} waits at the lair's door: the Dragon is faced alone.`,
    `${companion.name} ждёт у входа в логово: с драконом сражаются один на один.`,
  ));
}

// ─── Loyalty ──────────────────────────────────────────────────────────────

/** How the Companion swears at an Oathstone: Share while loyal, Take below that. */
export async function companionOath(tx: Tx): Promise<Oath> {
  const state = await stateOf(tx);
  return (state?.loyalty ?? LOYALTY_START) >= LOYAL ? 'share' : 'take';
}

/** Loyalty moves with sharing (up) and taking (down). At 0 the Companion leaves. */
export async function shiftLoyalty(tx: Tx, hero: HeroWithItems, delta: number, out: { notices: LocalizedText[] }): Promise<void> {
  const state = await stateOf(tx);
  if (!state || state.masterId !== hero.id) return;
  const companion = await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } });
  if (!companion) return;
  const loyalty = Math.max(0, Math.min(LOYALTY_MAX, state.loyalty + delta));
  if (loyalty === 0) {
    await letGo(tx, hero, companion);
    out.notices.push(t(
      `${companion.name} has had enough of your greed. Your Companion leaves your service, and gives back your gear.`,
      `Спутнику ${companion.name} надоела ваша жадность. Спутник уходит от вас и возвращает ваше снаряжение.`,
    ));
    return;
  }
  await save(tx, { ...state, loyalty });
  out.notices.push(delta > 0
    ? t(`${companion.name} takes it kindly. Loyalty: ${loyalty} of ${LOYALTY_MAX}.`, `Спутнику ${companion.name} это по душе. Верность: ${loyalty} из ${LOYALTY_MAX}.`)
    : t(`${companion.name} remembers that. Loyalty: ${loyalty} of ${LOYALTY_MAX}.`, `${companion.name} это запомнит. Верность: ${loyalty} из ${LOYALTY_MAX}.`));
}

// ─── Falling, and the Hero gone ───────────────────────────────────────────

/**
 * The Companion falls in a fight: carried back to the City, and at its Hero's side again
 * the next morning with all its gear. In Iron mode it is gone for good, and what it wore
 * lies in its Grave where it fell.
 */
export async function companionFalls(tx: Tx, companion: HeroWithItems, season: Season, floor: number, room: number, out: { notices: LocalizedText[] }): Promise<void> {
  const state = await stateOf(tx);
  const now = gameNow();
  await tx.hero.updateMany({ where: { partnerId: companion.id }, data: { partnerId: null } });
  if (worldSettings().iron) {
    const grave = await tx.grave.create({
      data: { seasonId: season.id, floor, room, heroId: companion.id, ownerName: companion.name, gold: 0, expiresAt: new Date(now.getTime() + GRAVE_MS) },
    });
    await tx.item.updateMany({ where: { heroId: companion.id, place: 'WORN' }, data: { place: 'GRAVE', heroId: null, slot: null, graveId: grave.id } });
    await tx.item.deleteMany({ where: { heroId: companion.id } });
    await tx.heroFloor.deleteMany({ where: { heroId: companion.id } });
    await tx.hero.update({
      where: { id: companion.id },
      data: { retiredAt: now, hp: 0, partnerId: null, location: 'CITY', floor: null, room: null, prevRoom: null, facing: false },
    });
    await save(tx, null);
    out.notices.push(t(
      `${companion.name} falls, and in Iron mode that is the end: your Companion is gone. What it wore lies in its Grave here.`,
      `${companion.name} падает, и в железном режиме это конец: спутника больше нет. Снаряжение спутника лежит здесь, в могиле.`,
    ));
    return;
  }
  await tx.hero.update({
    where: { id: companion.id },
    data: { partnerId: null, location: 'CITY', floor: null, room: null, prevRoom: null, facing: false, campSince: null },
  });
  if (state) await save(tx, { ...state, downUntil: new Date(nextMorning(now.getTime())).toISOString() });
  out.notices.push(t(
    `${companion.name} falls, and is carried back to the City. Tomorrow morning your Companion is at your side again.`,
    `${companion.name} падает, и спутника уносят в город. Завтра утром спутник снова будет рядом с вами.`,
  ));
}

/** Its Hero Retires or falls for good: the Companion leaves, and what it wore goes to Storage for the next Hero. */
export async function releaseCompanion(tx: Tx, hero: HeroWithItems): Promise<void> {
  const state = await stateOf(tx);
  if (!state || state.masterId !== hero.id) return;
  const companion = await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } });
  if (companion) await letGo(tx, hero, companion, true);
  else await save(tx, null);
}

/** The Wardens' Bond ring: the Companion puts its half on, giving back a ring of the Hero's it had to take off. */
export async function wearBondRing(tx: Tx, companion: HeroWithItems, ring: Item, hero: HeroWithItems): Promise<void> {
  const on = companion.items.filter((w) => w.place === 'WORN' && w.slot);
  const { slot, vacate } = wearPlan(baseById(ring.base) as GearBase, new Map(on.map((w) => [w.slot!, w.base])));
  for (const w of on.filter((i) => (vacate as string[]).includes(i.slot!))) {
    const back = await tx.item.update({ where: { id: w.id }, data: { heroId: hero.id, place: freePlace(hero) ?? 'BAG', slot: null } });
    hero.items.push(back);
    companion.items.splice(companion.items.indexOf(w), 1);
  }
  const worn = await tx.item.update({ where: { id: ring.id }, data: { place: 'WORN', slot } });
  companion.items.splice(companion.items.indexOf(ring), 1, worn);
}

// ─── The Player's side: hire, gear, dismiss ───────────────────────────────

/** The Companion as the Player sees it at the Tavern, and the offers while there is none. */
export interface CompanionView {
  companion: {
    name: string;
    class: ClassId;
    race: RaceId;
    level: number;
    portraitUrl: string;
    banner: string;
    hp: number;
    maxHp: number;
    loyalty: number;
    loyaltyMax: number;
    /** Paid each morning. */
    wage: number;
    /** Fallen: back at the Hero's side at this morning. */
    backAt: string | null;
    /** Waiting at the door of the Dragon's lair. */
    waiting: boolean;
    gear: ItemView[];
  } | null;
  /** Today's offers, while the Hero has no Companion and stands in the City. */
  offers: CompanionOffer[];
  /** City gold, for the wage. */
  gold: number;
  /** What happened since the last look: wages, a return, a parting. */
  notices: LocalizedText[];
}

/** The Companion beside the Hero, to hand gear to or take it back: not while it is down or away at the lair's door. */
async function besideHero(tx: Tx, hero: HeroWithItems): Promise<HeroWithItems> {
  const companion = hero.partnerId ? await tx.hero.findUnique({ where: { id: hero.partnerId }, include: { items: true } }) : null;
  if (!companion || !isCompanion(companion)) throw ApiError.conflict('no_companion', 'You have no Companion beside you');
  return companion;
}

async function viewOf(tx: Tx, player: Player, hero: HeroWithItems, season: Season, now: Date, notices: LocalizedText[], locale?: string): Promise<CompanionView> {
  const state = await stateOf(tx);
  const companion = state && state.masterId === hero.id ? await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } }) : null;
  return {
    companion: companion && state ? {
      name: companion.name, class: companion.class as ClassId, race: companion.race as RaceId, level: companion.level, portraitUrl: portraitUrlOf(companion),
      banner: companion.banner, hp: Math.min(companion.hp, fullHealth(companion)), maxHp: fullHealth(companion), loyalty: state.loyalty, loyaltyMax: LOYALTY_MAX,
      wage: wageOf(companion.level), backAt: state.downUntil, waiting: !state.downUntil && hero.partnerId !== companion.id,
      gear: companion.items.filter((i) => i.place === 'WORN').map(toItemView),
    } : null,
    offers: !companion && hero.location === 'CITY' ? offersFor(hero, season, localeOf(player, locale), now).map(({ portrait: _, ...offer }) => offer) : [],
    gold: hero.gold,
    notices,
  };
}

/** A look at the Companion (its morning tended first), and the Tavern's offers, named in `locale`. */
export async function companionView(player: Player, locale?: string): Promise<CompanionView> {
  const season = await currentSeason();
  const now = gameNow();
  const notices: LocalizedText[] = [];
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await tendCompanion(tx, hero, now, { notices });
    return viewOf(tx, player, hero, season, now, notices, locale);
  });
}

/** Hires one of the Tavern's offers (named in `locale`): the first wage now, at the Hero's level, in its Class's Starter kit. */
export async function hireCompanion(player: Player, index: number, locale?: string): Promise<CompanionView> {
  const season = await currentSeason();
  const now = gameNow();
  const notices: LocalizedText[] = [];
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    await tendCompanion(tx, hero, now, { notices });
    if (await stateOf(tx)) throw ApiError.conflict('companion_hired', 'You have a Companion already');
    if (hero.partnerId) throw ApiError.conflict('in_duo', 'You are in a Duo already');
    const offer = offersFor(hero, season, localeOf(player, locale), now)[index];
    if (!offer) throw ApiError.notFound('no_companion_offer', 'Nobody like that is at the Tavern today');
    if (hero.gold < offer.wage) throw ApiError.conflict('not_enough_gold', 'Not enough gold');
    await tx.hero.update({ where: { id: hero.id }, data: { gold: { decrement: offer.wage } } });
    hero.gold -= offer.wage;
    await tx.player.upsert({ where: { id: COMPANION_PLAYER }, create: { id: COMPANION_PLAYER, discordId: COMPANION_PLAYER, username: 'Companion' }, update: {} });

    const scores = scoresFor(offer.class);
    const maxHp = startingHealth(offer.class, offer.race, TALENTS, scores.con);
    const uses = restUses(offer.class, 1);
    const made = await tx.hero.create({
      data: {
        playerId: COMPANION_PLAYER, seasonId: season.id, name: offer.name, race: offer.race, class: offer.class, talents: TALENTS,
        portrait: offer.portrait, banner: offer.banner, ...scores, maxHp, hp: maxHp, stamina: STAMINA_MAX, spellUses: uses.spells, healUses: uses.heals,
      },
    });
    await giveStarterKit(tx, made, season.id);
    await raiseTo(tx, made, hero.level);
    const companion = await tx.hero.findUniqueOrThrow({ where: { id: made.id }, include: { items: true } });
    companion.hp = fullHealth(companion);
    await tx.hero.update({ where: { id: companion.id }, data: { hp: companion.hp } });
    await save(tx, { heroId: companion.id, masterId: hero.id, loyalty: LOYALTY_START, paidUntil: new Date(nextMorning(now.getTime())).toISOString(), downUntil: null });
    await join(tx, hero, companion);
    notices.push(t(`${offer.name} joins you, for ${offer.wage} gold each morning.`, `${offer.name} теперь с вами, за ${offer.wage} золота каждое утро.`));
    return viewOf(tx, player, hero, season, now, notices);
  });
}

/** Lets the Companion go, at the Tavern: it gives back what it wears. */
export async function dismissCompanion(player: Player): Promise<CompanionView> {
  const season = await currentSeason();
  const now = gameNow();
  const notices: LocalizedText[] = [];
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    await tendCompanion(tx, hero, now, { notices });
    const state = await stateOf(tx);
    const companion = state ? await tx.hero.findUnique({ where: { id: state.heroId }, include: { items: true } }) : null;
    if (!state || !companion) throw ApiError.conflict('no_companion', 'You have no Companion');
    await letGo(tx, hero, companion);
    notices.push(t(`${companion.name} leaves your service, and gives back your gear.`, `${companion.name} уходит от вас и возвращает ваше снаряжение.`));
    return viewOf(tx, player, hero, season, now, notices);
  });
}

/**
 * Hands the Companion a piece of gear from the Bag (or Storage, in the City): it wears it,
 * and what it takes off goes back where the gift came from.
 */
export async function giveToCompanion(player: Player, itemId: string): Promise<CompanionView> {
  const season = await currentSeason();
  const now = gameNow();
  const notices: LocalizedText[] = [];
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await tendCompanion(tx, hero, now, { notices });
    const companion = await besideHero(tx, hero);
    const item = ownItem(hero, itemId, ['BAG', 'STORAGE']);
    const base = baseById(item.base);
    if (!isGear(base)) throw ApiError.badRequest('not_gear', 'Only gear can be worn');
    if (!item.identified) throw ApiError.conflict('identify_first', 'Identify it before wearing it');
    if (!canUse(companion.class as ClassId, base)) throw ApiError.conflict('companion_cannot_use', `${companion.name}'s Class cannot use this`);
    const on = companion.items.filter((w) => w.place === 'WORN' && w.slot);
    const { slot, vacate } = wearPlan(base as GearBase, new Map(on.map((w) => [w.slot!, w.base])));
    const off = on.filter((w) => (vacate as string[]).includes(w.slot!));
    const from = item.place as 'BAG' | 'STORAGE';
    const room = from === 'BAG' ? BAG_SLOTS : STORAGE_SLOTS;
    if (hero.items.filter((i) => i.place === from).length - 1 + off.length > room) {
      throw ApiError.conflict('hands_full', 'No room to put away what it takes off');
    }
    // Out of its slots first: (heroId, slot) is unique.
    for (const w of off) await tx.item.update({ where: { id: w.id }, data: { heroId: hero.id, place: from, slot: null } });
    await tx.item.update({ where: { id: item.id }, data: { heroId: companion.id, place: 'WORN', slot } });
    return viewOf(tx, player, hero, season, now, notices);
  });
}

/** Takes a piece of gear back off the Companion, into the Bag (or Storage, in the City). */
export async function takeFromCompanion(player: Player, itemId: string): Promise<CompanionView> {
  const season = await currentSeason();
  const now = gameNow();
  const notices: LocalizedText[] = [];
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await tendCompanion(tx, hero, now, { notices });
    const companion = await besideHero(tx, hero);
    const item = companion.items.find((i) => i.id === itemId && i.place === 'WORN');
    if (!item) throw ApiError.notFound('item_not_found', 'Your Companion wears no such Item');
    const place = freePlace(hero);
    if (!place) throw ApiError.conflict('bag_full', 'Your Bag is full');
    await tx.item.update({ where: { id: item.id }, data: { heroId: hero.id, place, slot: null } });
    return viewOf(tx, player, hero, season, now, notices);
  });
}
