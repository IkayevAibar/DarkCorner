import type { Fight, Hero, HeroFloor, Player, Season } from '@prisma/client';
import {
  type Direction, type EventAction, type Exit, type FaceAction, type Facing, type HeroActionView, KIT_BASES, type LabyrinthResult, type LabyrinthView,
  type LiveFight, type OathChoice, type Stance,
} from '@dark/shared';
import {
  BAG_SLOTS, type ClassId, type Door, breaksWalls, FLOOR_COUNT, type Floor, LOOT, type Labyrinth, RACE_DEFS, type RaceId, STAMINA_MAX,
  type PathId, STAMINA_REFILL_MS, type StanceId, THEMES, type ThemeId, XP_FOR_LEVEL, abilityModifier, check, cluesFor, createRng, currentStamina, doorsOf,
  PATH_MASTERY, type HeroKey, InvalidChoice, type MonsterInstance, type ThreatId, type Tier, dropOdds, fightOdds, generateLabyrinth, onPath, proficiencyBonus, recoveredHealth, restUses, sneakCheck,
  threatOf, tierRank, baseById, heroFeatures, itemAbout, CAMP_REST_MS, SHORT_RESTS, SHORT_REST_RECHARGE_MS, SHORT_REST_SHARE, addStamina, monsterById, OATH_MS,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { bossVictory } from './boss.js';
import { trackBounties } from './bounties.js';
import { omenOf, omenView } from './omens.js';
import { enterEvent, eventAction, eventView, withLuck } from './events.js';
import { feed } from './feed.js';
import { type PartnerRow, activePartner, addNews, endDuo, loadActors, mergeOutcomes, partnerView, takeNews } from './duo.js';
import {
  DAY_MS, type FightKind, type Outcome, WARDENS_MS, combatOf, combatant, duoInput, duoMonstersFor, emptyOutcome, fallBack, fight, fightInput, foeOf,
  clearedAt, heroFloor, isCleared, markCleared, monstersFor, t,
} from './fights.js';
import { fullHealth, portraitUrlOf, scoresOf } from './heroes.js';
import { toItemView } from './items.js';
import { type HeroWithItems, type Tx, lockHero, noFight, stackTotal, takeStack } from './ledger.js';
import { type FightStep, advance, choiceOf, fightHeroes, fightOf, isPaused, liveView, replayOf, startFight } from './liveFights.js';
import { dropChest, dropGear, withGoldFind } from './loot.js';
import { boostedXp, gainXp } from './progression.js';
import { countDeeds } from './deeds.js';
import { newRun, tallyRun, tallyRunIn } from './runs.js';
import { currentSeason } from './seasons.js';
import { enterVault, vaultState } from './vaults.js';
import { chestOf, chestView, duoTreasure, oathView, swear, takeTurns } from './trust.js';
import { finishTraining, requireNotTraining } from './training.js';
import { gameNow, gameNowMs } from '../gameClock.js';

const HOUR_MS = 60 * 60 * 1000;
/** Clues: a WIS Check against this sees through a lie (v0). */
const CLUE_DC = 13;
/** Secret Doors: a WIS Check against this spots one, a new try each day (v0). */
const SECRET_DC = 14;
/** A hidden room's hoard comes back a week after it is taken (v0). */
const HOARD_MS = 7 * DAY_MS;

/**
 * How long a Room stays done once its monsters are beaten or its prize taken (docs/design.md):
 * a day, and a week for a hidden hoard, the Twin Wardens and an Oathstone. Other Rooms hold
 * nothing that comes back.
 */
const DONE_FOR: Partial<Record<string, number>> = {
  fight: DAY_MS, miniboss: DAY_MS, boss: DAY_MS, treasure: DAY_MS, event: DAY_MS, hidden: HOARD_MS, twin: WARDENS_MS, oathstone: OATH_MS,
};

/** XP for setting foot on a Floor for the first time, per Floor number (v0). */
const NEW_FLOOR_XP = 50;

// ─── The Labyrinth itself ─────────────────────────────────────────────────

const cache = new Map<string, Labyrinth>();

export function labyrinthFor(season: Pick<Season, 'seed'>): Labyrinth {
  let lab = cache.get(season.seed);
  if (!lab) {
    lab = generateLabyrinth(season.seed);
    cache.set(season.seed, lab);
  }
  return lab;
}

function floorOf(lab: Labyrinth, n: number): Floor {
  const floor = lab.floors[n - 1];
  if (!floor) throw ApiError.badRequest('no_such_floor', 'No such Floor');
  return floor;
}

function direction(floor: Floor, from: number, to: number): Direction {
  const a = floor.rooms[from]!;
  const b = floor.rooms[to]!;
  if (b.y < a.y) return 'n';
  if (b.y > a.y) return 's';
  return b.x > a.x ? 'e' : 'w';
}

// ─── Loading the Hero ─────────────────────────────────────────────────────

/** Every Labyrinth action works on the locked Hero, so two taps can't both spend the same Stamina. */
const loadHero = lockHero;

const bagCount = (hero: HeroWithItems) => hero.items.filter((i) => i.place === 'BAG').length;
const stackIn = (hero: HeroWithItems, base: string) => hero.items.find((i) => i.place === 'BAG' && i.base === base) ?? null;
const wears = (hero: HeroWithItems, uniqueId: string) => hero.items.some((i) => i.place === 'WORN' && i.uniqueId === uniqueId);

/** The Hero's Floor and Room, or a 409 when it is in the City. */
function whereIs(hero: HeroWithItems, lab: Labyrinth): { floor: Floor; room: number } {
  if (hero.location !== 'LABYRINTH' || hero.floor === null || hero.room === null) {
    throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
  }
  return { floor: floorOf(lab, hero.floor), room: hero.room };
}

// ─── Monsters in the way ──────────────────────────────────────────────────

/**
 * The monsters this Hero would have to deal with in a Room right now, if any:
 * a fight Room it hasn't cleared today, a Mini-boss nobody has beaten in the
 * last day, the Boss when its lair isn't quiet for this Hero, or the Twin
 * Wardens it hasn't beaten this week.
 */
async function monstersWaiting(tx: Tx, hero: Hero, season: Season, floor: Floor, roomId: number, now: Date): Promise<FightKind | null> {
  const type = floor.rooms[roomId]!.type;
  if (type !== 'fight' && type !== 'miniboss' && type !== 'boss' && type !== 'twin') return null;
  if (type === 'miniboss') {
    const claim = await tx.specialClaim.findUnique({ where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } } });
    return claim && now.getTime() - claim.claimedAt.getTime() < DAY_MS ? null : 'miniboss';
  }
  const hf = await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: floor.number } } });
  return isCleared(hf, roomId, now, type === 'twin' ? WARDENS_MS : DAY_MS) ? null : type;
}

/** A Duo meets whatever either Hero still has to beat in a Room: its monsters wait for both. */
async function pairWaiting(tx: Tx, hero: Hero, partner: Hero | null, season: Season, floor: Floor, roomId: number, now: Date): Promise<FightKind | null> {
  return (await monstersWaiting(tx, hero, season, floor, roomId, now)) ?? (partner ? monstersWaiting(tx, partner, season, floor, roomId, now) : null);
}

/**
 * A Hero (or Duo) that is still marked as facing monsters that are gone (a Mini-boss
 * someone else beat meanwhile) stops facing them, and the Room becomes its last safe one.
 * A Hero left facing the Twin Wardens alone (its Duo over) steps back out: they face only a Duo.
 */
async function stillFacing(tx: Tx, hero: HeroWithItems, partner: Hero | null, season: Season, floor: Floor, now: Date, out?: Outcome): Promise<FightKind | null> {
  if (!(hero.facing || partner?.facing) || hero.room === null) return null;
  if (!partner && floor.rooms[hero.room]!.type === 'twin') {
    const back = { facing: false, ...fallBack(hero, floor, now) };
    await tx.hero.update({ where: { id: hero.id }, data: back });
    Object.assign(hero, back);
    out?.notices.push(t('Alone, you step back from the Twin Wardens: they face only a Duo.', 'В одиночку вы отступаете от стражей-близнецов: они встречают только дуэт.'));
    return null;
  }
  const kind = await pairWaiting(tx, hero, partner, season, floor, hero.room, now);
  if (!kind) {
    for (const h of partner ? [hero, partner] : [hero]) {
      await tx.hero.update({ where: { id: h.id }, data: { facing: false, prevRoom: hero.room } });
      h.facing = false;
      h.prevRoom = hero.room;
    }
  }
  return kind;
}

/**
 * Whether a Room holds something new for this Hero now: monsters back, a Treasure or
 * hoard not taken, an event not done today (a Merchant never counts). Walking into a
 * known Room is free only without one, so a known Floor can't be farmed for nothing.
 */
function somethingNew(floor: Floor, roomId: number, hf: HeroFloor | null, now: Date): boolean {
  const room = floor.rooms[roomId]!;
  switch (room.type) {
    case 'fight':
    case 'miniboss':
    case 'boss':
    case 'treasure':
      return !isCleared(hf, roomId, now);
    case 'hidden':
      return !isCleared(hf, roomId, now, HOARD_MS);
    case 'twin':
      return !isCleared(hf, roomId, now, WARDENS_MS);
    case 'event':
      return room.event !== 'merchant' && !isCleared(hf, roomId, now);
    default:
      return false;
  }
}

/**
 * Free to walk into: a Room the Hero has stood in, with nothing new in it today. In a
 * Duo (`partnerHf` given) monsters the partner still has to beat make it a fight for
 * both, so neither walks in free.
 */
function freeToEnter(floor: Floor, roomId: number, hf: HeroFloor | null, now: Date, partnerHf?: HeroFloor | null): boolean {
  if (!(hf?.seen.includes(roomId) ?? false) || somethingNew(floor, roomId, hf, now)) return false;
  if (partnerHf === undefined) return true;
  const type = floor.rooms[roomId]!.type;
  if (type === 'twin') return isCleared(partnerHf, roomId, now, WARDENS_MS);
  return !(type === 'fight' || type === 'miniboss' || type === 'boss') || isCleared(partnerHf, roomId, now);
}

/** Fight Rooms can be snuck past; Mini-bosses only by a Thief who has grown into its Path (Ghost); the Boss never. A Duo, only where both can. */
const canSneak = (hero: Hero, kind: FightKind, partner: Hero | null = null): boolean =>
  (kind === 'fight' || (kind === 'miniboss' && onPath({ path: hero.path as PathId | null, level: hero.level }, 'thief', PATH_MASTERY)))
  && (!partner || canSneak(partner, kind));

/** Who waits for this Hero (or Duo) in a Room, and what its Threat is rated on. */
function encounterFor(hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, roomId: number, kind: FightKind, now: Date) {
  if (!partner) return monstersFor(season, hero, floor, roomId, kind, now);
  if (kind === 'boss') throw ApiError.conflict('duo_boss', 'The Dragon is faced alone: leave the Duo first');
  return duoMonstersFor(season, hero, partner, floor, roomId, kind, now);
}
const threatInput = (hero: HeroWithItems, partner: HeroWithItems | null, monsters: MonsterInstance[], stance: StanceId, lean: number) =>
  partner ? duoInput(hero, partner, monsters, { stance, escapeBonus: lean }) : fightInput(hero, combatOf(hero), monsters, { stance, escapeBonus: lean });

/** What the Player sees before choosing: who waits, how dangerous in each Stance, and the Sneak Check. */
function facingView(hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, roomId: number, kind: FightKind, now: Date): Facing {
  const { monsters, spawnSeed } = encounterFor(hero, partner, season, floor, roomId, kind, now);
  const combat = combatOf(hero);
  const lean = omenOf(season, now)?.sneak ?? 0;
  const rate = (stance: StanceId) => threatOf(fightOdds(`${spawnSeed}:threat:${stance}`, threatInput(hero, partner, monsters, stance, lean)));
  const sneak = canSneak(hero, kind, partner) ? sneakCheck(combat, floor.number, monsters.length, lean) : null;
  return {
    kind,
    monsters: monsters.map((m) => combatant(m.key, m)),
    foes: monsters.map(foeOf),
    threat: { bold: rate('bold'), steady: rate('steady'), wary: rate('wary') },
    sneak: sneak ? { modifier: sneak.modifier, dc: sneak.dc, edge: sneak.edge ?? 'normal' } : null,
  };
}

// ─── Seeing the Labyrinth ─────────────────────────────────────────────────

/**
 * Whether the Hero knows a secret Door is there: it has been through it, wears
 * the Eye of the Abyss, is a Warlock (Devil's sight), or spots it today (a WIS Check,
 * Rogues and Elves with advantage; the same answer all day).
 */
function spotsSecret(hero: HeroWithItems, floor: Floor, door: Door, seen: ReadonlySet<number>, now: Date): boolean {
  const hidden = floor.rooms[door.a]!.type === 'hidden' ? door.a : door.b;
  if (seen.has(hidden) || wears(hero, 'eye-of-the-abyss') || hero.class === 'warlock') return true;
  const race = RACE_DEFS[hero.race as RaceId];
  const rng = createRng(`${hero.id}:secret:${floor.number}:${door.a}-${door.b}:${Math.floor(now.getTime() / DAY_MS)}`);
  return check(rng, {
    modifier: abilityModifier(scoresOf(hero).wis) + (hero.class === 'rogue' ? proficiencyBonus(hero.level) : 0),
    dc: SECRET_DC,
    edge: hero.class === 'rogue' || race.clueAdvantage ? 'advantage' : 'normal',
    rerollOnes: race.rerollOnes,
  }).success;
}

/** Whether one Hero alone gets through a Door. A Twin door it doesn't: it opens only for a Duo (opens()). */
function canPass(door: Door, hero: HeroWithItems): boolean {
  if (door.kind === 'cracked') return breaksWalls(hero.class as ClassId);
  if (door.kind === 'locked') return hero.class === 'rogue' || stackIn(hero, 'key-iron') !== null;
  if (door.kind === 'twin') return false;
  return true;
}

/**
 * Whether the Hero, with its partner when it has one beside it, gets through a Door to `to`:
 * where either could alone, and through a Twin door as a Duo. Anyone walks out of the Wardens' Room.
 */
function opens(door: Door, floor: Floor, to: number, hero: HeroWithItems, partner: HeroWithItems | null): boolean {
  if (door.kind === 'twin') return partner !== null || floor.rooms[to]!.type !== 'twin';
  return canPass(door, hero) || (partner !== null && canPass(door, partner));
}

/**
 * Rangers always know a lying Clue, and Paladins (Divine sense) in the crypts and the depths;
 * Rogues and Elves (with advantage) may see through one. Stable per Door.
 */
function seesThrough(hero: HeroWithItems, floor: number, door: Door, from: number, theme: ThemeId): boolean {
  const race = RACE_DEFS[hero.race as RaceId];
  if (hero.class === 'ranger' || (hero.class === 'paladin' && (theme === 'crypts' || theme === 'depths'))) return true;
  if (hero.class !== 'rogue' && !race.clueAdvantage) return false;
  const rng = createRng(`${hero.id}:clue:${floor}:${door.a}-${door.b}:${from}`);
  return check(rng, {
    modifier: abilityModifier(scoresOf(hero).wis) + proficiencyBonus(hero.level),
    dc: CLUE_DC,
    edge: race.clueAdvantage ? 'advantage' : 'normal',
    rerollOnes: race.rerollOnes,
  }).success;
}

// ─── Short rests ──────────────────────────────────────────────────────────

/**
 * A Run starts with its short rests back, but no sooner than 8 hours after they
 * last came back (v0): stepping out at the gate and in again can't refill them.
 * A Hero without a rest clock yet (new, or from before short rests) starts one.
 */
function restsOnEntry(hero: Hero, now: Date): { shortRests?: number; shortRestsAt?: Date } {
  if (hero.shortRests >= SHORT_RESTS) return hero.shortRestsAt ? {} : { shortRestsAt: now };
  if (hero.shortRestsAt && now.getTime() - hero.shortRestsAt.getTime() < SHORT_REST_RECHARGE_MS) return {};
  return { shortRests: SHORT_RESTS, shortRestsAt: now };
}

/** When used short rests can come back with the next Run; null when none are used or they can already. */
function restsBackAt(hero: Hero, now: Date): string | null {
  if (hero.shortRests >= SHORT_RESTS || !hero.shortRestsAt) return null;
  const at = hero.shortRestsAt.getTime() + SHORT_REST_RECHARGE_MS;
  return at > now.getTime() ? new Date(at).toISOString() : null;
}

/** A Town Portal stays open for a day behind the Hero who read it (v0). */
const PORTAL_MS = 24 * HOUR_MS;

/** The Hero's open Town Portal, if it has one. */
function portalOf(hero: Hero, now: Date): { floor: number; closesAt: string } | null {
  if (hero.portalFloor === null || hero.portalRoom === null || !hero.portalUntil || hero.portalUntil <= now) return null;
  return { floor: hero.portalFloor, closesAt: hero.portalUntil.toISOString() };
}

/** The Hero's Duo partner, while both still point at each other. */
async function partnerOf(tx: Tx, hero: Hero): Promise<PartnerRow | null> {
  if (!hero.partnerId) return null;
  const partner = await tx.hero.findUnique({ where: { id: hero.partnerId }, include: { items: true, player: true } });
  return partner && partner.partnerId === hero.id && !partner.retiredAt ? partner : null;
}

async function buildView(tx: Tx, hero: HeroWithItems, season: Season, now: Date): Promise<LabyrinthView> {
  const partner = await partnerOf(tx, hero);
  const { stamina, savedAt } = currentStamina(hero.stamina, hero.staminaAt, now);
  const potions = hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion').reduce((s, i) => s + i.quantity, 0);
  const portals = hero.items.filter((i) => i.place === 'BAG' && i.base === 'scroll-portal').reduce((s, i) => s + i.quantity, 0);
  const heroPart = {
    name: hero.name,
    portraitUrl: portraitUrlOf(hero),
    banner: hero.banner,
    hp: Math.min(hero.hp, fullHealth(hero)),
    maxHp: fullHealth(hero),
    level: hero.level,
    xp: hero.xp,
    xpNext: hero.level < XP_FOR_LEVEL.length - 1 ? XP_FOR_LEVEL[hero.level + 1]! : null,
    stamina,
    staminaMax: STAMINA_MAX,
    staminaNextAt: stamina < STAMINA_MAX ? new Date(savedAt.getTime() + STAMINA_REFILL_MS).toISOString() : null,
    carriedGold: hero.carriedGold,
    spells: hero.spellUses,
    heals: hero.healUses,
    potions,
    portalScrolls: portals,
    stance: hero.stance as Stance,
    bombs: {
      fire: stackTotal(hero, 'bomb-fire'),
      smoke: stackTotal(hero, 'bomb-smoke'),
    },
    features: heroFeatures({
      class: hero.class as ClassId, level: hero.level, path: hero.path as PathId | null, int: scoresOf(hero).int, wis: scoresOf(hero).wis, cha: scoresOf(hero).cha,
      spellUses: hero.spellUses, healUses: hero.healUses,
    }),
    // What the Bag lends the belt, in the order a Run reaches for it.
    kit: KIT_BASES.map((base) => ({ base, count: stackTotal(hero, base), name: baseById(base).name, about: itemAbout(base)! }))
      .filter((k) => k.count > 0),
    shortRests: { left: hero.shortRests, of: SHORT_RESTS, backAt: restsBackAt(hero, now) },
    trainingUntil: hero.trainingUntil && hero.trainingUntil > now ? hero.trainingUntil.toISOString() : null,
  };
  const base = {
    hero: heroPart,
    season: {
      status: season.status.toLowerCase() as LabyrinthView['season']['status'], bossGateAt: season.bossGateAt?.toISOString() ?? null,
      omen: omenView(season, now),
    },
    waypoints: hero.waypoints,
    portal: portalOf(hero, now),
    bestFloor: hero.bestFloor,
    duo: partner ? partnerView(partner, now, hero.items) : null,
    fight: null,
  };

  if (hero.location === 'CITY' || hero.floor === null || hero.room === null) {
    return { ...base, location: 'city', floor: null, room: null, exits: [], map: null, graves: [], chest: null };
  }

  const lab = labyrinthFor(season);
  const floor = floorOf(lab, hero.floor);
  const room = floor.rooms[hero.room]!;
  const hf = await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: hero.floor } } });
  const seen = new Set(hf?.seen ?? []);
  // A Duo together sees every wall either Hero could break and every secret Door either spots, and gets through where either can.
  const together = partner && partner.floor === hero.floor && partner.room === hero.room ? partner : null;
  const pf = together ? await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: together.id, floor: hero.floor } } }) : undefined;
  const partnerSeen = new Set(pf?.seen ?? []);
  const breaks = breaksWalls(hero.class as ClassId) || (together !== null && breaksWalls(together.class as ClassId));
  const spots = (door: Door) => spotsSecret(hero, floor, door, seen, now) || (together !== null && spotsSecret(together, floor, door, partnerSeen, now));

  const exits: Exit[] = doorsOf(floor, room.id)
    .filter(({ door }) => door.kind !== 'cracked' || breaks)
    .filter(({ door }) => door.kind !== 'secret' || spots(door))
    .map(({ door, to, clue }) => {
      // The Hollow Crown: Clues never lie to its wearer.
      const truth = clue.lie && wears(hero, 'hollow-crown')
        ? createRng(`${floor.number}:${door.a}-${door.b}:${room.id}:truth`).pick(cluesFor(floor.rooms[to]!.type, floor.theme))
        : null;
      return {
        to,
        direction: direction(floor, room.id, to),
        kind: door.kind,
        clue: truth ?? clue.text,
        suspicious: !truth && clue.lie && seesThrough(hero, floor.number, door, room.id, floor.theme),
        passable: opens(door, floor, to, hero, together),
        visited: seen.has(to),
        free: freeToEnter(floor, to, hf, now, pf),
      };
    });

  // The Map: every Room stood in, plus the unknown Rooms next to them (the edge of the
  // fog), and the Doors of the Rooms stood in. Only Fighters and Barbarians see cracked walls.
  const known = new Set(seen);
  const doors = new Map<string, { a: number; b: number; kind: Door['kind']; passable: boolean; key: boolean }>();
  // A Route on the Map goes only where this Hero (or the Duo together) gets through, and spares the Keys a lock costs.
  const passable = (door: Door) => (door.kind === 'twin' ? together !== null : canPass(door, hero) || (together !== null && canPass(door, together)));
  const picks = hero.class === 'rogue' || together?.class === 'rogue';
  for (const id of seen) {
    for (const { door, to } of doorsOf(floor, id)) {
      if (door.kind === 'cracked' && !breaks) continue;
      if (door.kind === 'secret' && !spots(door)) continue;
      known.add(to);
      doors.set(`${door.a}-${door.b}`, { a: door.a, b: door.b, kind: door.kind, passable: passable(door), key: door.kind === 'locked' && !picks });
    }
  }
  // The Eye of the Abyss shows every Special room on the Floor.
  const eye = wears(hero, 'eye-of-the-abyss');
  const special = (type: string) => type === 'vault' || type === 'miniboss' || type === 'hidden' || type === 'twin';
  if (eye) for (const r of floor.rooms) if (special(r.type)) known.add(r.id);
  const rooms = [...known].sort((a, b) => a - b).map((id) => {
    const r = floor.rooms[id]!;
    const shown = seen.has(id) || (eye && special(r.type));
    // Done for now, and when it fills again: what the Map marks, and its Route walks through for free.
    const lasts = DONE_FOR[r.type];
    const at = lasts ? clearedAt(hf, id) : null;
    const done = lasts !== undefined && at !== null && now.getTime() - at.getTime() < lasts;
    return {
      id, x: r.x, y: r.y, type: shown ? r.type : null, visited: seen.has(id), cleared: done,
      free: seen.has(id) && freeToEnter(floor, id, hf, now, pf),
      back: done ? new Date(at!.getTime() + lasts!).toISOString() : null,
    };
  });

  const live = await liveFightOf(tx, hero, floor);
  const waiting = hero.facing && !live ? await pairWaiting(tx, hero, together, season, floor, room.id, now) : null;

  const graves = await tx.grave.findMany({
    where: { seasonId: season.id, floor: floor.number, room: room.id, expiresAt: { gt: now } },
    include: { items: { select: { id: true } } },
  });

  return {
    ...base,
    location: 'labyrinth',
    floor: { number: floor.number, name: THEMES[floor.theme].name, theme: floor.theme, width: floor.width, height: floor.height },
    room: {
      id: room.id,
      type: room.type,
      event: room.event,
      map: room.map,
      cleared: isCleared(hf, room.id, now),
      restedAt: room.type === 'camp' && hero.campSince ? new Date(hero.campSince.getTime() + CAMP_REST_MS).toISOString() : null,
      eventView: room.type === 'event' ? await eventView(tx, hero, season, floor, room.id, now) : null,
      vault: room.type === 'vault' ? await vaultView(tx, season, floor.number, room.id, now) : null,
      facing: waiting ? facingView(hero, waiting === 'boss' ? null : together, season, floor, room.id, waiting, now) : null,
      oath: room.type === 'oathstone' ? await oathView(tx, hero, together, season, floor, room.id, now) : null,
    },
    exits,
    map: { rooms, doors: [...doors.values()] },
    graves: graves.map((g) => ({ id: g.id, owner: g.ownerName, items: g.items.length, gold: g.gold, expiresAt: g.expiresAt.toISOString() })),
    fight: live,
    chest: await chestFor(tx, hero),
  };
}

/** The Duo Chest this Hero is splitting, as its Player sees it. */
async function chestFor(tx: Tx, hero: HeroWithItems) {
  const chest = await chestOf(tx, hero.id);
  if (!chest) return null;
  const otherId = chest.heroAId === hero.id ? chest.heroBId : chest.heroAId;
  const other = await tx.hero.findUniqueOrThrow({ where: { id: otherId }, include: { items: true } });
  return chestView(chest, hero.id, new Map([[hero.id, hero], [other.id, other]]));
}

/**
 * Brings the Hero's Duo Chest up to date (a pick left 30 seconds goes to the best Item left),
 * or, with `finish`, picks what is left in turn: the Duo moves on, or is no more. The other
 * Hero's part goes into `partnerOut` when it is the Duo partner here, or else into its news.
 */
async function tendChest(tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, now: Date, out: Outcome,
  opts: { finish?: boolean; partnerOut?: Outcome; pick?: number } = {}) {
  const chest = await chestOf(tx, hero.id);
  if (!chest) {
    if (opts.pick !== undefined) throw ApiError.conflict('no_chest', 'There is no Duo Chest here');
    return;
  }
  const otherId = chest.heroAId === hero.id ? chest.heroBId : chest.heroAId;
  const other = partner?.id === otherId ? partner : await tx.hero.findUniqueOrThrow({ where: { id: otherId }, include: { items: true } });
  const otherOut = partner?.id === otherId && opts.partnerOut ? opts.partnerOut : emptyOutcome();
  // A Duo no longer together at its chest can't split it: what is left is picked for them.
  const together = partner?.id === otherId && [hero, other].every((h) => h.location === 'LABYRINTH' && h.floor === chest.floor && h.room === chest.room);
  await takeTurns(tx, chest, new Map([[hero.id, hero], [other.id, other]]), season, new Map([[hero.id, out], [other.id, otherOut]]), now, {
    finish: opts.finish || !together, ...(opts.pick !== undefined ? { pick: { heroId: hero.id, index: opts.pick } } : {}),
  });
  if (otherOut !== opts.partnerOut) await addNews(tx, other.id, otherOut);
}

/** The fight this Hero is in, as its Player sees it now; null when there is none. */
async function liveFightOf(tx: Tx, hero: Hero, floor: Floor): Promise<LiveFight | null> {
  const fight = await fightOf(tx, hero.id);
  if (!fight || fight.floor !== floor.number) return null;
  const r = replayOf(fight);
  if (!isPaused(r)) return null;
  return liveView(fight, r, await fightHeroes(tx, fight, false), fight.heroId === hero.id ? 'hero' : 'ally', floor);
}

async function vaultView(tx: Tx, season: Season, floor: number, room: number, now: Date) {
  const v = await vaultState(tx, season.id, floor, room, now);
  return { state: v.state, opensAt: v.opensAt?.toISOString() ?? null };
}

// ─── Results ──────────────────────────────────────────────────────────────

async function respond(heroId: string, season: Season, outcome: Outcome): Promise<LabyrinthResult> {
  const now = gameNow();
  const run = await tallyRun(heroId, outcome, now);
  // Whatever a Duo partner's actions brought this Hero since its Player last looked
  // comes first (it was tallied into the Run when it happened).
  const news = await takeNews(heroId);
  const shown = news ? mergeOutcomes(news.outcome, outcome) : outcome;
  const hero = await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } });
  return {
    view: await buildView(prisma, hero, season, now),
    fight: shown.fight,
    loot: shown.loot,
    gold: shown.gold,
    xp: shown.xp,
    levelUp: shown.levelUp,
    died: shown.died,
    notices: shown.notices,
    checks: shown.checks,
    duel: shown.duel,
    run: run ?? news?.run ?? null,
    deeds: shown.deeds,
    oath: shown.oath,
    closedChest: shown.closedChest,
  };
}

/** A Duo partner's side of an action: into its Run now, and waiting for its Player's next look. */
async function tellPartner(tx: Tx, partner: Hero, out: Outcome, now: Date): Promise<void> {
  await addNews(tx, partner.id, out, await tallyRunIn(tx, partner.id, out, now));
}

/** A fight's step, delivered: what it brought the acting Hero into `out`, its partner's as news. */
async function deliver(tx: Tx, step: FightStep, fight: Fight, actorId: string, out: Outcome, now: Date): Promise<void> {
  if (!step.ended) return;
  const led = fight.heroId === actorId;
  const mine = led ? step.ended.hero : step.ended.ally;
  const theirs = led ? step.ended.ally : step.ended.hero;
  if (mine) Object.assign(out, mergeOutcomes(out, mine));
  const otherId = led ? fight.partnerId : fight.heroId;
  if (theirs && otherId) await tellPartner(tx, { id: otherId } as Hero, theirs, now);
}

/** A Room fight begins, played turn by turn: it runs to the first choice, or to its end. */
async function fightLive(tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, roomId: number, kind: FightKind,
  opts: { surprise?: 'hero'; bomb?: boolean; threat?: ThreatId | null; auto?: boolean }, out: Outcome, now: Date): Promise<void> {
  const fight = await startFight(tx, hero, partner, season, floor, roomId, kind, opts, now);
  await deliver(tx, await advance(tx, fight, await fightHeroes(tx, fight), season, floor, now), fight, hero.id, out, now);
}

/** The acting Hero and, in a Duo, its partner, ready to go with it (see activePartner). */
async function actors(tx: Tx, player: Player, season: Season, now: Date, out: Outcome, looks = false) {
  const { hero, partner } = await loadActors(tx, player, season.id);
  return { hero, partner: await activePartner(tx, hero, partner, now, out, looks) };
}

/**
 * Waiting heals. Four hours in a Camp is a long rest, a full one: health, every use,
 * Stamina and both short rests (and the clock starts again). Anywhere else in the
 * Labyrinth health comes back slowly, hour by hour, so a Hero left at death's door
 * can still walk out.
 */
async function restIfDue(tx: Tx, hero: HeroWithItems, now: Date, out?: Outcome): Promise<void> {
  if (hero.campSince && now.getTime() - hero.campSince.getTime() >= CAMP_REST_MS) {
    const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
    const rested = {
      hp: fullHealth(hero), spellUses: uses.spells, healUses: uses.heals, campSince: now, hpAt: now,
      stamina: STAMINA_MAX, staminaAt: now, shortRests: SHORT_RESTS, shortRestsAt: now,
    };
    await tx.hero.update({ where: { id: hero.id }, data: rested });
    Object.assign(hero, rested);
    out?.notices.push(t(
      'A full rest in the Camp: health, abilities, Stamina and both short rests are back.',
      'Полный отдых в лагере: здоровье, способности, выносливость и оба коротких отдыха восстановлены.',
    ));
    return;
  }
  if (hero.location !== 'LABYRINTH') return;
  const recovered = recoveredHealth(hero.hp, fullHealth(hero), hero.hpAt, now);
  // A full Hero's clock only needs moving now and then, so no hour is kept in store.
  if (recovered.hp === hero.hp && recovered.savedAt.getTime() - hero.hpAt.getTime() < HOUR_MS) return;
  const data = { hp: recovered.hp, hpAt: recovered.savedAt };
  await tx.hero.update({ where: { id: hero.id }, data });
  Object.assign(hero, data);
}

// ─── Actions ──────────────────────────────────────────────────────────────

export async function labyrinthState(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const outcome = emptyOutcome();
  const hero = await prisma.$transaction(async (tx) => {
    const now = gameNow();
    const { hero: h, partner } = await actors(tx, player, season, now, outcome, true);
    const fight = await fightOf(tx, h.id);
    if (fight) {
      const floor = floorOf(labyrinthFor(season), fight.floor);
      await deliver(tx, await advance(tx, fight, await fightHeroes(tx, fight), season, floor, now), fight, h.id, outcome, now);
      return h;
    }
    await restIfDue(tx, h, now, outcome);
    if (h.location === 'LABYRINTH' && h.floor !== null) await stillFacing(tx, h, partner, season, floorOf(labyrinthFor(season), h.floor), now, outcome);
    await tendChest(tx, h, partner, season, now, outcome);
    return h;
  });
  return respond(hero.id, season, outcome);
}

/**
 * From the City into the Labyrinth: at the entrance of Floor 1, or at a Waypoint already
 * reached (in a Duo, one both have reached, and the partner comes along).
 */
export async function enterLabyrinth(player: Player, floorNumber: number, viaPortal = false): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const now = gameNow();
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    if (hero.location !== 'CITY') throw ApiError.conflict('already_inside', 'Already in the Labyrinth');
    // Away at the Training grounds: no going in until the +1 lands (for either of a Duo).
    for (const h of partner ? [hero, partner] : [hero]) await finishTraining(tx, h, now);
    requireNotTraining(hero, now, partner);
    if (season.status === 'PLANNED') throw ApiError.conflict('season_not_started', 'The Season has not started yet');
    if (partner) {
      if (viaPortal) throw ApiError.conflict('duo_portal', 'A Town Portal takes one Hero: leave the Duo to step through');
      if (floorNumber !== 1 && !(hero.waypoints.includes(floorNumber) && partner.waypoints.includes(floorNumber))) {
        throw ApiError.conflict('no_waypoint', 'Both Heroes need that Waypoint');
      }
    }
    if (viaPortal) {
      // Back through the open Town Portal, to the Room it was read in; it closes behind the Hero.
      if (!portalOf(hero, now)) throw ApiError.conflict('no_portal', 'You have no open Town Portal');
      const floor = floorOf(lab, hero.portalFloor!);
      const room = hero.portalRoom!;
      // Monsters back in that Room by now: the Hero steps out in their doorway.
      const waiting = await monstersWaiting(tx, hero, season, floor, room, now);
      await tx.hero.update({
        where: { id: hero.id },
        data: {
          location: 'LABYRINTH', floor: floor.number, room, prevRoom: waiting ? floor.landing : room, facing: waiting !== null,
          deathless: true, lucky: true, campSince: floor.rooms[room]!.type === 'camp' ? now : null, hpAt: now,
          portalFloor: null, portalRoom: null, portalUntil: null, ...restsOnEntry(hero, now), run: newRun(hero.level, floor.number, now),
        },
      });
      return hero.id;
    }
    if (floorNumber !== 1 && !hero.waypoints.includes(floorNumber)) {
      throw ApiError.conflict('no_waypoint', 'You have not reached that Waypoint yet');
    }
    const floor = floorOf(lab, floorNumber);
    const room = floorNumber === 1 ? floor.landing : floor.rooms.find((r) => r.type === 'waypoint')!.id;
    for (const h of partner ? [hero, partner] : [hero]) {
      const hf = await heroFloor(tx, h.id, floorNumber);
      if (!hf.seen.includes(room)) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: room } } });
      await tx.hero.update({
        where: { id: h.id },
        data: {
          location: 'LABYRINTH', floor: floorNumber, room, prevRoom: room, deathless: true, lucky: true, campSince: null, facing: false,
          bestFloor: Math.max(h.bestFloor, floorNumber), ...restsOnEntry(h, now), run: newRun(h.level, floorNumber, now),
        },
      });
    }
    if (partner) {
      const into = floorNumber === 1 ? t('into the Labyrinth', 'в лабиринт') : t(`to the Waypoint on Floor ${floorNumber}`, `к путевому камню на этаже ${floorNumber}`);
      await addNews(tx, partner.id, { ...emptyOutcome(), notices: [t(`${hero.name} leads the Duo ${into.en}.`, `${hero.name} ведёт дуэт ${into.ru}.`)] });
    }
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/**
 * One Move: through a Door into the next Room (one Stamina unless it is known and nothing
 * new waits there), and whatever does. A Duo moves together: each Hero pays for itself,
 * and a Door either can get through lets both through.
 */
export async function moveTo(player: Player, to: number): Promise<LabyrinthResult> {
  return walkRoute(player, [to]);
}

/** Everything an Outcome has brought so far but its notices: a step that changes it ends a walk. */
const brought = (o: Outcome): string => JSON.stringify([
  o.loot.length, o.gold, o.xp, o.checks.length, o.levelUp, o.died, o.deeds.length, o.depth,
  o.fight !== null, o.duel !== null, o.oath !== null, o.closedChest !== null, o.runEnd !== null,
]);

/**
 * Walks a Route picked on the Map, Door by Door as if each were tapped (a single move is a
 * Route of one). Past a Room it goes on only while the walk is quiet: no Stamina spent,
 * nothing waiting, nothing found, no secret Door spotted; the lines a known Room always
 * says (a quiet lair, a Camp) go unsaid on the way. A Door further on that won't open, or
 * Stamina running out, ends the walk where it stands rather than undoing it.
 */
export async function walkRoute(player: Player, route: number[]): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();

  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, now, outcome, { finish: true, partnerOut });
    const { floor } = whereIs(hero, lab);
    await restIfDue(tx, hero, now, outcome);
    if (partner) await restIfDue(tx, partner, now, partnerOut);
    if (await stillFacing(tx, hero, partner, season, floor, now, outcome)) {
      throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
    }
    for (const [i, to] of route.entries()) {
      const before = { mine: brought(outcome), theirs: brought(partnerOut), notices: outcome.notices.length, told: partnerOut.notices.length };
      let step: Step;
      try {
        step = await stepTo(tx, hero, partner, season, floor, to, now, outcome, partnerOut);
      } catch (e) {
        // The first Door answers as a tap would; one further on that won't open ends the walk there.
        if (i === 0 || !(e instanceof ApiError)) throw e;
        outcome.notices.push(e.code === 'no_stamina' || e.code === 'partner_no_stamina'
          ? t('Out of Stamina: the walk stops here.', 'Выносливость кончилась: путь обрывается здесь.')
          : t('The way on is shut: the walk stops here.', 'Дальше не пройти: путь обрывается здесь.'));
        break;
      }
      if (i === route.length - 1) break;
      const quiet = step.free && !step.spotted && !hero.facing && brought(outcome) === before.mine && brought(partnerOut) === before.theirs;
      if (!quiet) break;
      outcome.notices.length = before.notices;
      partnerOut.notices.length = before.told;
    }
    if (partner) await tellPartner(tx, partner, partnerOut, now);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** What one step brought the walk: whether it was free of Stamina, and whether a secret Door showed itself. */
interface Step { free: boolean; spotted: boolean }

/**
 * One step through a Door into `to`, for the Hero and its partner when in a Duo: the Door
 * must open for them, Stamina is paid unless the Room is free to walk into, monsters stop
 * them in the doorway, and any other Room does what it does.
 */
async function stepTo(
  tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, to: number, now: Date, outcome: Outcome, partnerOut: Outcome,
): Promise<Step> {
  const from = hero.room!;
  const exit = doorsOf(floor, from).find((d) => d.to === to);
  if (!exit) throw ApiError.badRequest('no_door', 'No Door leads there');
  const walkers = [{ hero, out: outcome, hf: await heroFloor(tx, hero.id, floor.number) }];
  if (partner) walkers.push({ hero: partner, out: partnerOut, hf: await heroFloor(tx, partner.id, floor.number) });
  if (exit.door.kind === 'secret' && !walkers.some((w) => spotsSecret(w.hero, floor, exit.door, new Set(w.hf.seen), now))) {
    throw ApiError.badRequest('no_door', 'No Door leads there');
  }
  if (!opens(exit.door, floor, to, hero, partner)) {
    if (exit.door.kind === 'twin') throw ApiError.conflict('twin_door', 'The Twin door opens only for a Duo');
    throw ApiError.conflict(exit.door.kind === 'cracked' ? 'wall' : 'locked', 'You cannot get through that Door');
  }
  const target = floor.rooms[to]!;
  if (target.type === 'boss' && (!season.bossGateAt || season.bossGateAt > now)) {
    throw ApiError.conflict('boss_gate_closed', 'The Boss gate is still sealed');
  }
  if (target.type === 'boss' && partner) throw ApiError.conflict('duo_boss', 'The Dragon is faced alone: leave the Duo first');
  // Walking back through known Rooms is free, unless something new waits in one today.
  const costs = walkers.map((w, i) => ({
    free: freeToEnter(floor, to, w.hf, now, partner ? walkers[1 - i]!.hf : undefined),
    stamina: currentStamina(w.hero.stamina, w.hero.staminaAt, now),
  }));
  if (!costs[0]!.free && costs[0]!.stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');
  if (partner && !costs[1]!.free && costs[1]!.stamina.stamina < 1) {
    throw ApiError.conflict('partner_no_stamina', `${partner.name} is out of Stamina`);
  }

  // A locked Door without a Rogue costs one Iron key: the mover's, or else its partner's.
  if (exit.door.kind === 'locked' && walkers.every((w) => w.hero.class !== 'rogue')) {
    const holder = walkers.find((w) => stackIn(w.hero, 'key-iron'))!.hero;
    const key = stackIn(holder, 'key-iron')!;
    if (key.quantity > 1) await tx.item.update({ where: { id: key.id }, data: { quantity: key.quantity - 1 } });
    else await tx.item.delete({ where: { id: key.id } });
    if (holder !== hero) partnerOut.notices.push(t(`${hero.name} opens the Door with one of your Iron keys.`, `${hero.name} открывает дверь вашим железным ключом.`));
  }

  // Monsters stop the Hero (or Duo) in the doorway: the Player sees them and chooses (face()).
  // Any other Room becomes the last safe one.
  const waiting = await pairWaiting(tx, hero, partner, season, floor, to, now);
  for (const [i, w] of walkers.entries()) {
    if (!w.hf.seen.includes(to)) {
      await tx.heroFloor.update({ where: { id: w.hf.id }, data: { seen: { push: to } } });
      w.out.explored++;
      await countDeeds(tx, w.hero, { rooms: 1 }, w.out);
    }
    const { free, stamina } = costs[i]!;
    await tx.hero.update({
      where: { id: w.hero.id },
      data: {
        ...(free ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }), room: to, campSince: target.type === 'camp' ? now : null,
        facing: waiting !== null, ...(waiting ? {} : { prevRoom: to }),
      },
    });
    w.hero.room = to;
    w.hero.facing = waiting !== null;
  }

  // Treasure a Duo walks in on together goes into one Duo Chest.
  const shared = partner !== null && target.type === 'treasure';
  let spotted = false;
  for (const w of walkers) {
    if (!waiting && !shared) await resolveRoom(tx, w.hero, season, floor, to, w.hf, now, w.out);
    // A sharp eye catches a way into a hidden room.
    const seenNow = new Set([...w.hf.seen, to]);
    for (const { door } of doorsOf(floor, to)) {
      const hidden = floor.rooms[door.a]!.type === 'hidden' ? door.a : door.b;
      if (door.kind === 'secret' && !seenNow.has(hidden) && spotsSecret(w.hero, floor, door, seenNow, now)) {
        w.out.notices.push(t('A thin draft through a crack in the stones: a secret Door!', 'Тонкий сквозняк из трещины в камнях: потайная дверь!'));
        spotted = true;
      }
    }
  }
  if (!waiting && shared) await duoTreasure(tx, [hero, partner], season, floor, to, now, new Map([[hero.id, outcome], [partner.id, partnerOut]]));
  return { free: costs.every((c) => c.free), spotted };
}

/** What a Room without monsters in the way does when the Hero walks in. */
async function resolveRoom(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, roomId: number, hf: HeroFloor, now: Date, out: Outcome) {
  const room = floor.rooms[roomId]!;
  switch (room.type) {
    case 'miniboss':
      out.notices.push(t('The Mini-boss here lies defeated. It will be back tomorrow.', 'Мини-босс здесь повержен. Он вернётся завтра.'));
      break;
    case 'boss':
      out.notices.push(t('The lair is quiet. The Dragon will be back tomorrow.', 'В логове тихо. Дракон вернётся завтра.'));
      break;
    case 'twin':
      out.notices.push(t('The Twin Wardens stand still as stone. They wake a week after you beat them.', 'Стражи-близнецы стоят неподвижно, как камень. Они проснутся через неделю после вашей победы.'));
      break;
    case 'oathstone':
      if (isCleared(hf, roomId, now, OATH_MS)) {
        out.notices.push(t('The Oathstone is quiet: you have sworn by it this week.', 'Камень клятв молчит: на этой неделе вы уже клялись им.'));
      } else {
        out.notices.push(hero.partnerId
          ? t('An Oathstone. Each of you swears by it in secret: share, or take.', 'Камень клятв. Каждый из вас втайне клянётся им: поделиться или забрать.')
          : t('An Oathstone stands here, silent: it answers only two who swear together.', 'Здесь стоит Камень клятв, безмолвный: он отвечает только двоим, кто клянётся вместе.'));
      }
      break;
    case 'waypoint':
      if (!hero.waypoints.includes(floor.number)) {
        await tx.hero.update({ where: { id: hero.id }, data: { waypoints: { push: floor.number } } });
        out.notices.push(t('The Waypoint hums awake. You can now enter the Labyrinth here.', 'Путевой камень пробудился. Теперь сюда можно входить из города.'));
      }
      break;
    case 'camp':
      out.notices.push(t(
        'A safe Camp. Wait here four hours for a full rest: health, abilities, Stamina and both short rests.',
        'Безопасный лагерь. Подождите здесь четыре часа ради полного отдыха: здоровье, способности, выносливость и оба коротких отдыха.',
      ));
      break;
    case 'hidden':
      if (!isCleared(hf, roomId, now, HOARD_MS)) {
        const rng = createRng(newSeed());
        await dropGear(tx, hero, season, { floor: floor.number, count: 2, odds: dropOdds(Math.min(10, floor.number + 2)), source: 'hidden' }, out);
        if (rng.chance(0.25)) await dropChest(tx, hero, season, floor.number, out);
        const gold = withGoldFind(hero, Math.round(rng.int(20, 60) * (floor.number + 1) * (omenOf(season, now)?.gold ?? 1)));
        await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
        hero.carriedGold += gold;
        out.gold += gold;
        await markCleared(tx, hf, roomId, now);
        out.notices.push(t('A hidden hoard, untouched for years!', 'Потайной клад, нетронутый годами!'));
        await feed(tx, season, hero, 'hidden', { floor: floor.number });
        await countDeeds(tx, hero, { hidden: 1 }, out);
        await trackBounties(tx, hero, { type: 'treasure' }, out, now);
      } else {
        out.notices.push(t('The hoard here is taken. It fills again in a week.', 'Клад здесь уже взят. Он наполнится через неделю.'));
      }
      break;
    case 'treasure':
      if (!isCleared(hf, roomId, now)) {
        const rng = createRng(newSeed());
        let r = rng.next() * LOOT.treasureItems.reduce((sum, [, w]) => sum + w, 0);
        const count = LOOT.treasureItems.find(([, w]) => (r -= w) < 0)?.[0] ?? 1;
        await dropGear(tx, hero, season, { floor: floor.number, count, source: 'treasure' }, out);
        if (rng.chance(LOOT.treasureChest)) await dropChest(tx, hero, season, floor.number, out);
        const gold = withGoldFind(hero, Math.round(rng.int(5, 15) * (floor.number + 1) * (omenOf(season, now)?.gold ?? 1)));
        await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
        hero.carriedGold += gold;
        out.gold += gold;
        await markCleared(tx, hf, roomId, now);
        await trackBounties(tx, hero, { type: 'treasure' }, out, now);
      }
      break;
    case 'event':
      await enterEvent(tx, hero, season, floor, roomId, now, out);
      break;
    case 'vault':
      await enterVault(tx, hero, season, floor.number, roomId, now, out);
      break;
    default:
      break;
  }
}

/**
 * The Hero stands in a doorway facing monsters: fight them (maybe opening with a
 * Fire bomb), Sneak past (a DEX Check, or sure with a Smoke bomb; failing it is
 * an ambush), or Retreat to the last safe Room for free. A Duo does it together.
 */
export async function face(player: Player, action: FaceAction): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    await noFight(tx, hero.id);
    const { floor, room } = whereIs(hero, lab);
    const kind = await stillFacing(tx, hero, partner, season, floor, now, outcome);
    if (!kind) throw ApiError.conflict('not_facing', 'There is nothing here to face');
    if (partner) {
      await faceTogether(tx, hero, partner, season, floor, room, kind, action, now, outcome, partnerOut);
      await tellPartner(tx, partner, partnerOut, now);
      return hero.id;
    }

    if (action.action === 'retreat') {
      await tx.hero.update({ where: { id: hero.id }, data: { facing: false, ...fallBack(hero, floor, now) } });
      outcome.notices.push(t('You back away to the last safe Room.', 'Вы отступаете в последнюю безопасную комнату.'));
      return hero.id;
    }

    if (action.action === 'sneak') {
      if (!canSneak(hero, kind)) throw ApiError.conflict('no_sneaking', 'There is no sneaking past this one');
      let slipped = true;
      if (action.smoke) {
        await takeStack(tx, hero, 'bomb-smoke', 1, 'no_bomb');
        outcome.notices.push(t('Smoke fills the Room, and you slip through it.', 'Комнату заволакивает дым, и вы проскальзываете сквозь него.'));
      } else {
        const { monsters } = monstersFor(season, hero, floor, room, kind, now);
        slipped = await sneaks(tx, hero, floor, room, monsters.length, season, now, outcome);
      }
      if (slipped) {
        await tx.hero.update({ where: { id: hero.id }, data: { facing: false } });
        if (!action.smoke) outcome.notices.push(t('You slip past unseen.', 'Вы незаметно прокрадываетесь мимо.'));
        await trackBounties(tx, hero, { type: 'sneak' }, outcome, now);
        return hero.id;
      }
      outcome.notices.push(t('They spot you! The monsters strike first.', 'Вас заметили! Монстры бьют первыми.'));
      await fightLive(tx, hero, null, season, floor, room, kind, { surprise: 'hero' }, outcome, now);
      return hero.id;
    }

    if (action.bomb) await takeStack(tx, hero, 'bomb-fire', 1, 'no_bomb');
    // The Threat the Player was shown, for bounties that ask for a hard fight.
    const { monsters, spawnSeed } = monstersFor(season, hero, floor, room, kind, now);
    const threat = threatOf(fightOdds(`${spawnSeed}:threat:${hero.stance}`, fightInput(hero, combatOf(hero), monsters, { escapeBonus: omenOf(season, now)?.sneak ?? 0 })));
    // Auto: the Hero fights it out on its own at once, as before manual fights.
    if (action.auto) await fightHere(tx, hero, season, floor, room, kind, outcome, { bomb: action.bomb, threat });
    else await fightLive(tx, hero, null, season, floor, room, kind, { bomb: action.bomb, threat }, outcome, now);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** One Hero's Sneak Check past `count` monsters, rolled and logged. */
async function sneaks(tx: Tx, hero: HeroWithItems, floor: Floor, room: number, count: number, season: Season, now: Date, out: Outcome): Promise<boolean> {
  const input = sneakCheck(combatOf(hero), floor.number, count, omenOf(season, now)?.sneak ?? 0);
  const seed = newSeed();
  const rng = createRng(seed);
  const { check: result } = await withLuck(tx, hero, t('Sneak past', 'Прокрасться мимо'), () => ({ check: check(rng, input) }), out);
  await tx.rollLog.create({ data: { playerId: hero.playerId, kind: 'sneak', seed, detail: { floor: floor.number, room, success: result.success } } });
  return result.success;
}

/**
 * A Duo in a doorway: Retreat takes both back; a Sneak is a group Check (each rolls, and
 * one success leads both through), a Smoke bomb covers both; a fight is fought side by side.
 */
async function faceTogether(tx: Tx, hero: HeroWithItems, partner: PartnerRow, season: Season, floor: Floor, room: number, kind: FightKind,
  action: FaceAction, now: Date, out: Outcome, partnerOut: Outcome) {
  if (kind === 'boss') throw ApiError.conflict('duo_boss', 'The Dragon is faced alone: leave the Duo first');
  const both = [{ hero, out }, { hero: partner, out: partnerOut }];

  if (action.action === 'retreat') {
    const back = fallBack(hero, floor, now);
    for (const h of [hero, partner]) await tx.hero.update({ where: { id: h.id }, data: { facing: false, ...back } });
    out.notices.push(t('You back away to the last safe Room.', 'Вы отступаете в последнюю безопасную комнату.'));
    partnerOut.notices.push(t(`${hero.name} pulls the Duo back to the last safe Room.`, `${hero.name} уводит дуэт в последнюю безопасную комнату.`));
    return;
  }

  if (action.action === 'sneak') {
    if (!canSneak(hero, kind, partner)) throw ApiError.conflict('no_sneaking', 'There is no sneaking past this one');
    let slipped = false;
    if (action.smoke) {
      await takeStack(tx, hero, 'bomb-smoke', 1, 'no_bomb');
      out.notices.push(t('Smoke fills the Room, and the Duo slips through it.', 'Комнату заволакивает дым, и дуэт проскальзывает сквозь него.'));
      partnerOut.notices.push(t(`${hero.name} throws a Smoke bomb, and the Duo slips through.`, `${hero.name} бросает дымовую бомбу, и дуэт проскальзывает.`));
      slipped = true;
    } else {
      const { monsters } = encounterFor(hero, partner, season, floor, room, kind, now);
      for (const w of both) if (await sneaks(tx, w.hero, floor, room, monsters.length, season, now, w.out)) slipped = true;
    }
    if (slipped) {
      for (const w of both) {
        await tx.hero.update({ where: { id: w.hero.id }, data: { facing: false } });
        if (!action.smoke) w.out.notices.push(t('The Duo slips past unseen.', 'Дуэт незаметно прокрадывается мимо.'));
        await trackBounties(tx, w.hero, { type: 'sneak' }, w.out, now);
      }
      return;
    }
    for (const w of both) w.out.notices.push(t('The Duo is spotted! The monsters strike first.', 'Дуэт заметили! Монстры бьют первыми.'));
    await fightLive(tx, hero, partner, season, floor, room, kind, { surprise: 'hero' }, out, now);
    return;
  }

  if (action.bomb) await takeStack(tx, hero, 'bomb-fire', 1, 'no_bomb');
  // The Threat the Player was shown, for bounties that ask for a hard fight.
  const { monsters, spawnSeed } = encounterFor(hero, partner, season, floor, room, kind, now);
  const threat = threatOf(fightOdds(`${spawnSeed}:threat:${hero.stance}`, threatInput(hero, partner, monsters, hero.stance as StanceId, omenOf(season, now)?.sneak ?? 0)));
  await fightLive(tx, hero, partner, season, floor, room, kind, { bomb: action.bomb, threat, auto: action.action === 'fight' && action.auto }, out, now);
}

/** A fight in the Room the Hero faces; beating the Boss pays out on its own terms. */
async function fightHere(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, roomId: number, kind: FightKind, out: Outcome, opts: {
  surprise?: 'hero';
  bomb?: boolean;
  threat?: ThreatId;
}) {
  const result = await fight(tx, hero, season, floor, roomId, kind, out, opts);
  if (kind === 'boss' && result === 'victory') await bossVictory(tx, hero, season, floor.number, roomId, out);
}

/** How the Hero fights from now on. */
export async function setStance(player: Player, stance: StanceId): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    await tx.hero.update({ where: { id: hero.id }, data: { stance } });
    return hero.id;
  });
  return respond(heroId, season, emptyOutcome());
}

/** Whatever the Hero does in the Event room it stands in. */
export async function actInEvent(player: Player, action: EventAction): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room } = whereIs(hero, lab);
    if (floor.rooms[room]!.type !== 'event') throw ApiError.conflict('no_event', 'Nothing to do here');
    await eventAction(tx, hero, season, floor, room, action, now, outcome);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** Down the stairs to the next Floor's landing: one Stamina the first time, free after. A Duo goes down together. */
export async function descend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, now, outcome, { finish: true, partnerOut });
    const { floor, room } = whereIs(hero, lab);
    if (floor.rooms[room]!.type !== 'stairs' || floor.number >= FLOOR_COUNT) {
      throw ApiError.conflict('no_stairs', 'There are no stairs down here');
    }
    const next = floorOf(lab, floor.number + 1);
    const walkers = [{ hero, out: outcome, hf: await heroFloor(tx, hero.id, next.number) }];
    if (partner) walkers.push({ hero: partner, out: partnerOut, hf: await heroFloor(tx, partner.id, next.number) });
    payStairs(walkers.map((w) => ({ hero: w.hero, known: w.hf.seen.includes(next.landing) })), partner, now);
    for (const { hero: h, out, hf } of walkers) {
      const known = hf.seen.includes(next.landing);
      const stamina = currentStamina(h.stamina, h.staminaAt, now);
      if (!known) {
        await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: next.landing } } });
        out.explored++;
      }
      out.depth = next.number;
      // A Floor never reached before is worth XP.
      const firstXp = next.number > h.bestFloor ? await boostedXp(tx, h, season, NEW_FLOOR_XP * next.number) : 0;
      const levelUp = firstXp > 0 ? gainXp(h, firstXp) : null;
      if (levelUp) {
        out.xp = firstXp;
        out.levelUp = levelUp.newLevel;
        out.notices.push(t(`A new depth: Floor ${next.number}.`, `Новая глубина: этаж ${next.number}.`));
        await feed(tx, season, h, 'depth', { floor: next.number });
      }
      await trackBounties(tx, h, { type: 'depth', floor: next.number }, out, now);
      await countDeeds(tx, h, {}, out, { depth: next.number });
      await tx.hero.update({
        where: { id: h.id },
        data: {
          floor: next.number, room: next.landing, prevRoom: next.landing, campSince: null,
          ...(known ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }), bestFloor: Math.max(h.bestFloor, next.number),
          ...levelUp?.data,
        },
      });
    }
    if (partner) {
      partnerOut.notices.unshift(t(`${hero.name} leads the Duo down the stairs.`, `${hero.name} ведёт дуэт вниз по лестнице.`));
      await tellPartner(tx, partner, partnerOut, now);
    }
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** Stairs to a landing a Hero has never stood on cost it one Stamina; in a Duo, both must have it. */
function payStairs(walkers: { hero: Hero; known: boolean }[], partner: Hero | null, now: Date): void {
  for (const w of walkers) {
    if (w.known || currentStamina(w.hero.stamina, w.hero.staminaAt, now).stamina >= 1) continue;
    if (partner && w.hero.id === partner.id) throw ApiError.conflict('partner_no_stamina', `${partner.name} is out of Stamina`);
    throw ApiError.conflict('no_stamina', 'Out of Stamina');
  }
}

/**
 * From a lower Floor's landing back up the stairs: free when the Hero comes out at
 * stairs it knows, one Stamina otherwise. Every stairs Room leads to the same
 * landing, so the Hero comes out at stairs it already knows, or at the first
 * stairs Room of the Floor above. A Duo comes out together, where the one going first knows.
 */
export async function ascend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, now, outcome, { finish: true, partnerOut });
    const { floor, room: at } = whereIs(hero, lab);
    if (floor.number === 1 || at !== floor.landing) throw ApiError.conflict('no_stairs_up', 'There are no stairs up here');
    const above = floorOf(lab, floor.number - 1);
    const hf = await heroFloor(tx, hero.id, above.number);
    const stairs = above.rooms.filter((r) => r.type === 'stairs');
    const room = (stairs.find((r) => hf.seen.includes(r.id)) ?? stairs[0]!).id;
    const walkers = [{ hero, hf }];
    if (partner) walkers.push({ hero: partner, hf: await heroFloor(tx, partner.id, above.number) });
    payStairs(walkers.map((w) => ({ hero: w.hero, known: w.hf.seen.includes(room) })), partner, now);
    for (const { hero: h, hf: f } of walkers) {
      const known = f.seen.includes(room);
      const stamina = currentStamina(h.stamina, h.staminaAt, now);
      if (!known) await tx.heroFloor.update({ where: { id: f.id }, data: { seen: { push: room } } });
      await tx.hero.update({
        where: { id: h.id },
        data: {
          floor: above.number, room, prevRoom: room, campSince: null, ...(known ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }),
        },
      });
    }
    if (partner) {
      partnerOut.notices.push(t(`${hero.name} leads the Duo up the stairs.`, `${hero.name} ведёт дуэт вверх по лестнице.`));
      await tellPartner(tx, partner, partnerOut, now);
    }
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** Back to the City: gold becomes safe, health and abilities come back. */
async function goHome(tx: Tx, hero: HeroWithItems, out: Outcome) {
  out.runEnd = { gold: hero.carriedGold };
  if (hero.carriedGold > 0) {
    await trackBounties(tx, hero, { type: 'bank', gold: hero.carriedGold }, out);
    await countDeeds(tx, hero, { banked: hero.carriedGold }, out);
  }
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, campSince: null,
      gold: { increment: hero.carriedGold }, carriedGold: 0, hp: fullHealth(hero), spellUses: uses.spells, healUses: uses.heals,
    },
  });
}

/** Leave from the entrance, or from a Waypoint Room this Hero has woken. A Duo goes home together, and stays a Duo. */
export async function leaveByWaypoint(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, now, outcome, { finish: true, partnerOut });
    const { floor, room: at } = whereIs(hero, lab);
    const room = floor.rooms[at]!;
    const atEntrance = floor.number === 1 && room.type === 'landing';
    if (!atEntrance && !(room.type === 'waypoint' && hero.waypoints.includes(floor.number))) {
      throw ApiError.conflict('not_at_waypoint', 'You can only leave from a Waypoint or the entrance');
    }
    await goHome(tx, hero, outcome);
    if (partner) {
      await goHome(tx, partner, partnerOut);
      partnerOut.notices.unshift(t(`${hero.name} leads the Duo back to the City.`, `${hero.name} ведёт дуэт обратно в город.`));
      await tellPartner(tx, partner, partnerOut, now);
    }
    return hero.id;
  });
  outcome.notices.unshift(t('You are back in the City.', 'Вы вернулись в город.'));
  return respond(heroId, season, outcome);
}

/** A short rest anywhere in the Labyrinth without monsters in the way: half of full health and Stamina back (v0). */
export async function shortRest(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome, true);
    await noFight(tx, hero.id);
    const { floor } = whereIs(hero, lab);
    await restIfDue(tx, hero, now, outcome);
    if (await stillFacing(tx, hero, partner, season, floor, now)) throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
    if (hero.shortRests < 1) throw ApiError.conflict('no_short_rests', 'No short rests left on this Run');
    const full = fullHealth(hero);
    const before = currentStamina(hero.stamina, hero.staminaAt, now).stamina;
    if (hero.hp >= full && before >= STAMINA_MAX) throw ApiError.conflict('rested', 'Already fully rested');
    const hp = Math.min(full, hero.hp + Math.ceil(full * SHORT_REST_SHARE));
    const stamina = addStamina(hero.stamina, hero.staminaAt, Math.ceil(STAMINA_MAX * SHORT_REST_SHARE), now);
    await tx.hero.update({
      where: { id: hero.id },
      data: { hp, stamina: stamina.stamina, staminaAt: stamina.savedAt, shortRests: hero.shortRests - 1 },
    });
    const healed = hp - hero.hp;
    const gained = stamina.stamina - before;
    outcome.notices.push(t(
      `A short rest: ${[healed > 0 && `+${healed} health`, gained > 0 && `+${gained} Stamina`].filter(Boolean).join(', ')}.`,
      `Короткий отдых: ${[healed > 0 && `+${healed} здоровья`, gained > 0 && `+${gained} выносливости`].filter(Boolean).join(', ')}.`,
    ));
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/**
 * Read a Town Portal scroll: home from anywhere, and the portal stays open behind the
 * Hero for a day, to step back through once (from a doorway, to the last safe Room).
 * It takes one Hero: reading it ends a Duo, and the partner goes on alone.
 */
export async function readPortal(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, gameNow(), outcome, true);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, gameNow(), outcome, { finish: true });
    if (hero.location !== 'LABYRINTH' || hero.floor === null || hero.room === null) throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const scroll = stackIn(hero, 'scroll-portal');
    if (!scroll) throw ApiError.conflict('no_scroll', 'You have no Town Portal scroll');
    if (partner) {
      await endDuo(tx, hero, partner, {
        en: `${hero.name} reads a Town Portal and steps home: the Duo is over, you go on alone.`,
        ru: `${hero.name} читает свиток портала и уходит домой: дуэт распался, дальше вы одни.`,
      });
    }
    if (scroll.quantity > 1) await tx.item.update({ where: { id: scroll.id }, data: { quantity: scroll.quantity - 1 } });
    else await tx.item.delete({ where: { id: scroll.id } });
    const floor = hero.floor;
    const room = hero.facing ? (hero.prevRoom ?? floorOf(labyrinthFor(season), floor).landing) : hero.room;
    await goHome(tx, hero, outcome);
    await tx.hero.update({ where: { id: hero.id }, data: { portalFloor: floor, portalRoom: room, portalUntil: new Date(gameNowMs() + PORTAL_MS) } });
    return hero.id;
  });
  outcome.notices.unshift(t(
    'You step through to the City. The portal stays open behind you for a day: step back through it from the Labyrinth gate.',
    'Вы шагаете сквозь портал в город. Он останется открытым сутки: вернуться можно от врат лабиринта.',
  ));
  return respond(heroId, season, outcome);
}

/** Take what a Grave in this Room holds, as far as the Bag allows; its gold always fits. */
export async function lootGrave(player: Player, graveId: string): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, gameNow(), outcome, true);
    await noFight(tx, hero.id);
    // Monsters in the Room guard its Graves: fight them, or Sneak past, first.
    if (hero.location === 'LABYRINTH' && hero.floor !== null
      && await stillFacing(tx, hero, partner, season, floorOf(labyrinthFor(season), hero.floor), gameNow())) {
      throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
    }
    // The Grave's row is the lock: two Heroes looting at once take turns.
    await tx.$queryRaw`SELECT id FROM "Grave" WHERE id = ${graveId} FOR UPDATE`;
    const grave = await tx.grave.findUnique({ where: { id: graveId }, include: { items: true, hero: { select: { playerId: true } } } });
    if (!grave || grave.seasonId !== season.id || grave.expiresAt <= gameNow()) throw ApiError.notFound('no_grave', 'No such Grave');
    if (hero.location !== 'LABYRINTH' || hero.floor !== grave.floor || hero.room !== grave.room) {
      throw ApiError.conflict('not_here', 'That Grave is not in this Room');
    }
    let free = BAG_SLOTS - bagCount(hero);
    for (const item of grave.items) {
      if (free <= 0) break;
      await tx.item.update({ where: { id: item.id }, data: { place: 'BAG', heroId: hero.id, graveId: null } });
      outcome.loot.push(toItemView(item));
      free--;
    }
    if (grave.gold > 0) {
      await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: grave.gold } } });
      outcome.gold = grave.gold;
      await tx.grave.update({ where: { id: grave.id }, data: { gold: 0 } });
    }
    const left = await tx.item.count({ where: { graveId: grave.id } });
    if (left === 0) await tx.grave.delete({ where: { id: grave.id } });
    else outcome.notices.push(t('Your Bag is full; the rest stays in the Grave.', 'Сумка полна; остальное остаётся в могиле.'));
    // Someone else's Grave: the Feed tells the friends who looted whom, naming the best Tier from Rare up.
    const took = outcome.loot.length > 0 || outcome.gold > 0;
    if (took && grave.hero?.playerId !== hero.playerId) {
      const best = outcome.loot.map((i) => i.tier as Tier).sort((a, b) => tierRank(b) - tierRank(a))[0];
      const tier = best && tierRank(best) >= tierRank('rare') ? best : null;
      await feed(tx, season, hero, 'grave-looted', { owner: grave.ownerName, floor: grave.floor, tier });
    }
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/**
 * A Player's choice for its Hero's turn in the fight it is in (docs/design.md → Manual
 * fights). The fight first catches up (a Duo turn left too long goes to the AI); then,
 * if it is this Hero's turn, the choice is played and the fight runs on to the next
 * choice, or to its end, paying both Heroes.
 */
export async function actInFight(player: Player, action: HeroActionView): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero } = await loadActors(tx, player, season.id);
    const fight = await fightOf(tx, hero.id);
    if (!fight) throw ApiError.conflict('no_fight', 'There is no fight going on');
    const heroes = await fightHeroes(tx, fight);
    const floor = floorOf(lab, fight.floor);
    const viewer: HeroKey = fight.heroId === hero.id ? 'hero' : 'ally';
    let step = await advance(tx, fight, heroes, season, floor, now);
    if (step.paused) {
      if (step.paused.turn.hero !== viewer) throw ApiError.conflict('not_your_turn', 'Wait for your turn');
      try {
        step = await advance(tx, fight, heroes, season, floor, now, choiceOf(action, viewer));
      } catch (e) {
        if (e instanceof InvalidChoice) throw ApiError.badRequest('bad_action', e.message);
        throw e;
      }
    }
    await deliver(tx, step, fight, hero.id, outcome, now);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** A Player's secret oath at the Oathstone where its Duo stands (docs/design.md → Trust and greed). */
export async function swearOath(player: Player, choice: OathChoice): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome, true);
    await noFight(tx, hero.id);
    const { floor, room } = whereIs(hero, lab);
    const together = partner && partner.floor === hero.floor && partner.room === hero.room ? partner : null;
    await swear(tx, hero, together, season, floor, room, choice, now, outcome, partnerOut);
    if (together) await tellPartner(tx, together, partnerOut, now);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/** This Player's pick from the Duo Chest, on its turn. */
export async function pickFromChest(player: Player, index: number): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const now = gameNow();
  const outcome = emptyOutcome();
  const partnerOut = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const { hero, partner } = await actors(tx, player, season, now, outcome, true);
    await noFight(tx, hero.id);
    await tendChest(tx, hero, partner, season, now, outcome, { pick: index, partnerOut });
    if (partner) await tellPartner(tx, partner, partnerOut, now);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}
