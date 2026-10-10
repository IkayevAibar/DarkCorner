import type { Delve, Hero, Player, Season } from '@prisma/client';
import {
  type BoonId as BoonIdView, type BoonView, type DelveEnd, type DelveResult, type DelveRow, type DelveRun, type DelveView, type Facing,
  type ItemView, type LocalizedText, fightReplaySchema,
} from '@dark/shared';
import {
  BOONS, type BoonId, type ClassId, DAY_MS, DELVE_POTIONS, DELVE_PRIZES, DELVE_ROOMS, type FightInput, type PathId, type StanceId, chestBase,
  createRng, delveEncounter, delveFloor, delveGold, delveMap, delveOffer, delveRoomFloor, delveRoomKind, delveScore, delveSeed, fightOdds,
  restUses, simulateFight, takeBoon, threatOf, weaponStrike, withBoons,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { countDeeds, titleOf } from './deeds.js';
import { feed } from './feed.js';
import { combatOf, combatant, foeOf, t } from './fights.js';
import { fullHealth, portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import { type HeroWithItems, type Tx, dayNumber, earnGold, giveStack, lockHero } from './ledger.js';
import { monsterOmen } from './difficulty.js';
import { omenOf } from './omens.js';
import { currentSeason } from './seasons.js';
import { finishTraining, requireNotTraining } from './training.js';
import { gameNow } from '../gameClock.js';

// The Daily Delve (docs/design.md → The Daily Delve): once a day, a Player takes
// their Hero down the same six Rooms as everyone else, each deeper than the last.
// The Delve keeps its own health, potions and abilities, so nothing the Hero owns
// is at risk; the Player stops whenever they like and banks the score.

// The contract's Boons are the engine's.
const _sameBoons: readonly BoonIdView[] = [] as BoonId[];
void _sameBoons;

const BOARD_SIZE = 10;

const running = (season: Season) => season.status === 'ACTIVE' || season.status === 'FINALE';

const boonView = (id: BoonId): BoonView => ({ id, name: BOONS[id].name, about: BOONS[id].about });

/** The Hero as it fights in this Delve: its gear and the Boons, with the Delve's health, potions and abilities. */
function delveInput(hero: HeroWithItems, run: Delve, room: number, stance: StanceId, omen: ReturnType<typeof omenOf>, seasonSeed: string): FightInput {
  const own = combatOf(hero);
  return {
    hero: withBoons({ ...own, hp: Math.min(run.hp, own.maxHp) }, run.boons as BoonId[]),
    monsters: delveEncounter(delveSeed(seasonSeed, run.day), run.floor, room, omen),
    uses: { spells: run.spellUses, heals: run.healUses },
    potions: run.potions,
    runPowers: { deathless: run.deathless, lucky: run.lucky },
    stance,
    surprise: null,
    bomb: null,
    gold: 0,
    escapeBonus: omen?.sneak ?? 0,
    spare: false,
  };
}

/** What waits in the next Room, with the Threat in each Stance. */
function nextRoom(hero: HeroWithItems, run: Delve, season: Season, now: Date): DelveRun['next'] {
  if (run.end !== null || run.rooms >= DELVE_ROOMS) return null;
  const room = run.rooms;
  const omen = monsterOmen(season, now);
  const monsters = delveEncounter(delveSeed(season.seed, run.day), run.floor, room, omen);
  const rate = (stance: StanceId) =>
    threatOf(fightOdds(`${delveSeed(season.seed, run.day)}:${hero.id}:threat:${room}:${stance}`, delveInput(hero, run, room, stance, omen, season.seed)));
  const facing: Facing = {
    kind: delveRoomKind(room),
    monsters: monsters.map((m) => combatant(m.key, m)),
    foes: monsters.map(foeOf),
    threat: { bold: rate('bold'), steady: rate('steady'), wary: rate('wary') },
    sneak: null,
  };
  return { room: room + 1, floor: delveRoomFloor(run.floor, room), facing };
}

function runView(hero: HeroWithItems, run: Delve, season: Season, now: Date): DelveRun {
  const maxHp = fullHealth(hero);
  const offer = run.end === null && run.rooms > 0 && run.rooms < DELVE_ROOMS ? delveOffer(delveSeed(season.seed, run.day), run.rooms).map(boonView) : null;
  return {
    floor: run.floor,
    rooms: run.rooms,
    hp: Math.min(run.hp, maxHp),
    maxHp,
    potions: run.potions,
    boons: (run.boons as BoonId[]).map(boonView),
    end: run.end as DelveEnd | null,
    score: run.end !== null ? run.score : delveScore(run.rooms, run.hp, maxHp, 'stopped'),
    gold: run.end !== null ? run.gold : delveGold(run.floor, run.rooms),
    next: nextRoom(hero, run, season, now),
    offer,
  };
}

type RowRun = Delve & { hero: Hero };

function rowOf(run: RowRun, place: number, playerId: string): DelveRow {
  return {
    place, hero: run.hero.name, class: run.hero.class as ClassId, level: run.hero.level, portraitUrl: portraitUrlOf(run.hero), banner: run.hero.banner,
    title: titleOf(run.hero), floor: run.floor, rooms: run.rooms, end: run.end as DelveEnd, score: run.score, mine: run.playerId === playerId,
  };
}

/** A day's finished Delves, best first; equal scores go to whoever finished first. */
async function standings(tx: Tx, seasonId: string, day: number): Promise<RowRun[]> {
  return tx.delve.findMany({
    where: { seasonId, day, end: { not: null } },
    include: { hero: true },
    orderBy: [{ score: 'desc' }, { endedAt: 'asc' }],
  });
}

async function view(tx: Tx, player: Player, hero: HeroWithItems, season: Season, now: Date): Promise<DelveView> {
  const day = dayNumber(now);
  const [run, today, yesterday, prize] = await Promise.all([
    tx.delve.findUnique({ where: { playerId_day: { playerId: player.id, day } } }),
    standings(tx, season.id, day),
    tx.delve.findMany({ where: { seasonId: season.id, day: day - 1, place: { not: null } }, include: { hero: true }, orderBy: { place: 'asc' } }),
    tx.delve.findFirst({ where: { seasonId: season.id, playerId: player.id, place: { not: null }, claimedAt: null }, orderBy: { day: 'asc' } }),
  ]);
  const places = today.map((r, i) => ({ r, place: i + 1 }));
  const board = places.filter(({ r, place }) => place <= BOARD_SIZE || r.playerId === player.id).map(({ r, place }) => rowOf(r, place, player.id));
  return {
    day,
    closesAt: new Date((day + 1) * DAY_MS).toISOString(),
    rooms: DELVE_ROOMS,
    floor: run?.floor ?? delveFloor(hero.bestFloor, hero.level),
    stance: hero.stance as StanceId,
    run: run ? runView(hero, run, season, now) : null,
    board,
    yesterday: yesterday.map((r) => rowOf(r, r.place!, player.id)),
    prize: prize ? { day: prize.day, place: prize.place!, chest: DELVE_PRIZES[prize.place! - 1]! } : null,
  };
}

async function result(tx: Tx, player: Player, hero: HeroWithItems, season: Season, now: Date, extra: Partial<Omit<DelveResult, 'view'>> = {}): Promise<DelveResult> {
  return { view: await view(tx, player, hero, season, now), fight: extra.fight ?? null, loot: extra.loot ?? [], notices: extra.notices ?? [] };
}

/** Today's Delve, locked; one that has ended can't be played on. */
async function lockRun(tx: Tx, player: Player, day: number): Promise<Delve> {
  const found = await tx.delve.findUnique({ where: { playerId_day: { playerId: player.id, day } }, select: { id: true } });
  if (!found) throw ApiError.conflict('no_delve', 'Start today’s Delve first');
  await tx.$queryRaw`SELECT id FROM "Delve" WHERE id = ${found.id} FOR UPDATE`;
  const run = await tx.delve.findUniqueOrThrow({ where: { id: found.id } });
  if (run.end !== null) throw ApiError.conflict('delve_over', 'Today’s Delve is over; come back tomorrow');
  return run;
}

/** Ends a Delve: the score, and the gold for its Rooms into the Hero's City purse. */
async function finish(tx: Tx, run: Delve, hero: HeroWithItems, end: DelveEnd, now: Date, notices: LocalizedText[]): Promise<Delve> {
  const maxHp = fullHealth(hero);
  const score = delveScore(run.rooms, run.hp, maxHp, end);
  const gold = delveGold(run.floor, run.rooms);
  const done = await tx.delve.update({ where: { id: run.id }, data: { end, score, gold, endedAt: now } });
  if (gold > 0) await earnGold(tx, hero, gold);
  notices.push(t(
    `The Delve is over: ${score} points${gold > 0 ? ` and ${gold} gold` : ''}.`,
    `Спуск окончен. Очки: ${score}${gold > 0 ? `, золото: ${gold}` : ''}.`,
  ));
  if (end === 'cleared') await countDeeds(tx, hero, { delves: 1 }, { notices });
  return done;
}

async function playerSeason(): Promise<Season> {
  const season = await currentSeason();
  if (!running(season)) throw ApiError.conflict('season_not_running', 'The Delve opens while a Season is under way');
  return season;
}

// ─── Actions ──────────────────────────────────────────────────────────────

export async function delveState(player: Player): Promise<DelveResult> {
  const season = await currentSeason();
  const now = gameNow();
  return prisma.$transaction(async (tx) => {
    const hero = await tx.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, include: { items: true } });
    if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
    return result(tx, player, hero, season, now);
  });
}

/** Down the Well: today's Delve starts at full health, with its own potions and abilities. */
export async function startDelve(player: Player): Promise<DelveResult> {
  const season = await playerSeason();
  const now = gameNow();
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    await finishTraining(tx, hero, now);
    requireNotTraining(hero, now);
    const day = dayNumber(now);
    if (await tx.delve.findUnique({ where: { playerId_day: { playerId: player.id, day } }, select: { id: true } })) {
      throw ApiError.conflict('delve_taken', 'One Delve a day; come back tomorrow');
    }
    const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
    await tx.delve.create({
      data: {
        seasonId: season.id, playerId: player.id, heroId: hero.id, day, floor: delveFloor(hero.bestFloor, hero.level),
        hp: fullHealth(hero), potions: DELVE_POTIONS, spellUses: uses.spells, healUses: uses.heals,
      },
    });
    return result(tx, player, hero, season, now);
  });
}

/** Takes the chosen Boon (after the first Room), then fights the next Room. */
export async function delveFight(player: Player, boon: BoonId | null): Promise<DelveResult> {
  const season = await playerSeason();
  const now = gameNow();
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    let run = await lockRun(tx, player, dayNumber(now));
    const seed = delveSeed(season.seed, run.day);
    const room = run.rooms;

    if (room > 0) {
      const offer = delveOffer(seed, room);
      if (!boon || !offer.includes(boon)) throw ApiError.badRequest('pick_boon', 'Choose one of the Boons on offer');
      const full = { maxHp: fullHealth(hero), uses: restUses(hero.class as ClassId, hero.level, hero.path as PathId | null) };
      const state = takeBoon({ hp: run.hp, potions: run.potions, uses: { spells: run.spellUses, heals: run.healUses } }, boon, full);
      run = await tx.delve.update({
        where: { id: run.id },
        data: { hp: state.hp, potions: state.potions, spellUses: state.uses.spells, healUses: state.uses.heals, boons: { push: boon } },
      });
    }

    const omen = monsterOmen(season, now);
    const input = delveInput(hero, run, room, hero.stance as StanceId, omen, season.seed);
    const fightSeed = newSeed();
    const fought = simulateFight(createRng(fightSeed), input);
    await tx.rollLog.create({
      data: { playerId: player.id, kind: 'delve', seed: fightSeed, detail: { day: run.day, room: room + 1, floor: delveRoomFloor(run.floor, room), outcome: fought.outcome, boons: run.boons } },
    });
    const fight = fightReplaySchema.parse({
      map: delveMap(seed, run.floor, room),
      hero: {
        key: 'hero', name: { en: hero.name, ru: hero.name }, art: portraitUrlOf(hero), hp: input.hero.hp, maxHp: input.hero.maxHp, ac: input.hero.ac,
        boss: false, banner: hero.banner, elite: null, powers: [], strike: weaponStrike(input.hero.weapon?.base), kin: null, class: hero.class as ClassId,
      },
      monsters: input.monsters.map((m) => combatant(m.key, m)),
      events: fought.events,
      outcome: fought.outcome,
    });

    const won = fought.outcome === 'victory';
    run = await tx.delve.update({
      where: { id: run.id },
      data: {
        hp: Math.max(0, fought.hp), potions: run.potions - fought.potionsUsed, spellUses: fought.uses.spells, healUses: fought.uses.heals,
        deathless: fought.runPowers.deathless, lucky: fought.runPowers.lucky, rooms: won ? room + 1 : room,
      },
    });
    const notices: LocalizedText[] = [];
    const end: DelveEnd | null = !won ? (fought.outcome === 'escaped' ? 'fled' : 'fell') : run.rooms >= DELVE_ROOMS ? 'cleared' : null;
    if (end) {
      if (end === 'fell') notices.push(t('Your Hero goes down, and the Well spits them out: half the points stay.', 'Падение! Колодец выбрасывает героя наверх: остаётся половина очков.'));
      if (end === 'fled') notices.push(t('An Escape roll gets your Hero out: the Rooms won still count.', 'Бросок побега выносит героя наверх: выигранные комнаты засчитаны.'));
      run = await finish(tx, run, hero, end, now, notices);
      if (end === 'cleared') await feed(tx, season, hero, 'delve-cleared', { score: run.score, floor: run.floor });
    }
    return result(tx, player, hero, season, now, { fight, notices });
  });
}

/** Stops and banks the score. */
export async function stopDelve(player: Player): Promise<DelveResult> {
  const season = await playerSeason();
  const now = gameNow();
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const run = await lockRun(tx, player, dayNumber(now));
    const notices: LocalizedText[] = [];
    await finish(tx, run, hero, 'stopped', now, notices);
    return result(tx, player, hero, season, now, { notices });
  });
}

/** Takes the Chest won on a day's board into the Bag (or Storage in the City). */
export async function claimDelvePrize(player: Player): Promise<DelveResult> {
  const season = await currentSeason();
  const now = gameNow();
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const prize = await tx.delve.findFirst({ where: { seasonId: season.id, playerId: player.id, place: { not: null }, claimedAt: null }, orderBy: { day: 'asc' } });
    if (!prize) throw ApiError.conflict('no_prize', 'No Chest waits for you at the Well');
    const base = chestBase(DELVE_PRIZES[prize.place! - 1]!);
    await giveStack(tx, hero, season.id, base, 1);
    await tx.delve.update({ where: { id: prize.id }, data: { claimedAt: now } });
    const stack = hero.items.find((i) => i.base === base && (i.place === 'BAG' || i.place === 'STORAGE'))!;
    const loot: ItemView[] = [{ ...toItemView(stack), id: `${stack.id}:+1`, quantity: 1 }];
    return result(tx, player, hero, season, now, { loot });
  });
}

// ─── Midnight ─────────────────────────────────────────────────────────────

/**
 * At midnight UTC (the Omen job): closes yesterday's Delve, and any older day that
 * still has one under way (a night the job missed).
 */
export async function closeDelves(tx: Tx, season: Season, now: Date): Promise<void> {
  const today = dayNumber(now);
  const stuck = await tx.delve.findMany({ where: { seasonId: season.id, day: { lt: today - 1 }, end: null }, distinct: ['day'], select: { day: true } });
  for (const day of [...stuck.map((r) => r.day), today - 1]) await closeDelveDay(tx, season, day, now);
}

/**
 * Solo: the Chest a Delve earns by the Rooms it won (kept as `place`: 1 Gold,
 * 2 Silver, 3 Iron). The server gives them to the day's first three, which alone
 * would be the one Hero, every day.
 */
const chestPlace = (rooms: number): number | null => (rooms >= DELVE_ROOMS ? 1 : rooms >= 4 ? 2 : rooms >= 2 ? 3 : null);

/**
 * Closes a day's Delve: Delves still under way stop and bank, and each earns its
 * Chest by the Rooms it won. Safe to run twice.
 */
async function closeDelveDay(tx: Tx, season: Season, day: number, now: Date): Promise<void> {
  const open = await tx.delve.findMany({ where: { seasonId: season.id, day, end: null } });
  for (const run of open) {
    const hero = await tx.hero.findUniqueOrThrow({ where: { id: run.heroId }, include: { items: true } });
    await finish(tx, run, hero, 'stopped', now, []);
  }
  if (await tx.delve.count({ where: { seasonId: season.id, day, place: { not: null } } }) > 0) return;
  for (const run of await standings(tx, season.id, day)) {
    const place = chestPlace(run.rooms);
    if (place !== null) await tx.delve.update({ where: { id: run.id }, data: { place } });
  }
}
