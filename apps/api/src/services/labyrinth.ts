import type { Hero, HeroFloor, Player, Season } from '@prisma/client';
import { type Direction, type EventAction, type Exit, type FaceAction, type Facing, KIT_BASES, type LabyrinthResult, type LabyrinthView, type Stance } from '@dark/shared';
import {
  BAG_SLOTS, type ClassId, type Door, FLOOR_COUNT, type Floor, LOOT, type Labyrinth, RACE_DEFS, type RaceId, STAMINA_MAX,
  type PathId, STAMINA_REFILL_MS, type StanceId, THEMES, XP_FOR_LEVEL, abilityModifier, check, cluesFor, createRng, currentStamina, doorsOf,
  PATH_MASTERY, type ThreatId, type Tier, dropOdds, fightOdds, generateLabyrinth, onPath, proficiencyBonus, recoveredHealth, restUses, sneakCheck,
  threatOf, tierRank, baseById, heroFeatures, itemAbout, SHORT_RESTS, SHORT_REST_RECHARGE_MS, SHORT_REST_SHARE, addStamina, monsterById,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { bossVictory } from './boss.js';
import { trackBounties } from './bounties.js';
import { omenOf, omenView } from './omens.js';
import { enterEvent, eventAction, eventView, withLuck } from './events.js';
import { feed } from './feed.js';
import {
  DAY_MS, type FightKind, type Outcome, combatOf, combatant, emptyOutcome, fallBack, fight, fightInput, heroFloor, isCleared, markCleared,
  monstersFor, t,
} from './fights.js';
import { fullHealth, portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import { type HeroWithItems, type Tx, lockHero, stackTotal, takeStack } from './ledger.js';
import { dropChest, dropGear, withGoldFind } from './loot.js';
import { boostedXp, gainXp } from './progression.js';
import { currentSeason } from './seasons.js';
import { enterVault, vaultState } from './vaults.js';

const HOUR_MS = 60 * 60 * 1000;
const REST_MS = 4 * HOUR_MS;
/** Clues: a WIS Check against this sees through a lie (v0). */
const CLUE_DC = 13;
/** Secret Doors: a WIS Check against this spots one, a new try each day (v0). */
const SECRET_DC = 14;
/** A hidden room's hoard comes back a week after it is taken (v0). */
const HOARD_MS = 7 * DAY_MS;

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
 * last day, or the Boss when its lair isn't quiet for this Hero.
 */
async function monstersWaiting(tx: Tx, hero: Hero, season: Season, floor: Floor, roomId: number, now: Date): Promise<FightKind | null> {
  const type = floor.rooms[roomId]!.type;
  if (type !== 'fight' && type !== 'miniboss' && type !== 'boss') return null;
  if (type === 'miniboss') {
    const claim = await tx.specialClaim.findUnique({ where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } } });
    return claim && now.getTime() - claim.claimedAt.getTime() < DAY_MS ? null : 'miniboss';
  }
  const hf = await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: floor.number } } });
  return isCleared(hf, roomId, now) ? null : type;
}

/**
 * A Hero that is still marked as facing monsters that are gone (a Mini-boss someone
 * else beat meanwhile) stops facing them, and the Room becomes its last safe one.
 */
async function stillFacing(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, now: Date): Promise<FightKind | null> {
  if (!hero.facing || hero.room === null) return null;
  const kind = await monstersWaiting(tx, hero, season, floor, hero.room, now);
  if (!kind) {
    await tx.hero.update({ where: { id: hero.id }, data: { facing: false, prevRoom: hero.room } });
    hero.facing = false;
    hero.prevRoom = hero.room;
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
    case 'event':
      return room.event !== 'merchant' && !isCleared(hf, roomId, now);
    default:
      return false;
  }
}

/** Free to walk into: a Room the Hero has stood in, with nothing new in it today. */
const freeToEnter = (floor: Floor, roomId: number, hf: HeroFloor | null, now: Date): boolean =>
  (hf?.seen.includes(roomId) ?? false) && !somethingNew(floor, roomId, hf, now);

/** Fight Rooms can be snuck past; Mini-bosses only by a Thief who has grown into its Path (Ghost); the Boss never. */
const canSneak = (hero: Hero, kind: FightKind): boolean =>
  kind === 'fight' || (kind === 'miniboss' && onPath({ path: hero.path as PathId | null, level: hero.level }, 'thief', PATH_MASTERY));

/** What the Player sees before choosing: who waits, how dangerous in each Stance, and the Sneak Check. */
function facingView(hero: HeroWithItems, season: Season, floor: Floor, roomId: number, kind: FightKind, now: Date): Facing {
  const { monsters, spawnSeed } = monstersFor(season, hero, floor, roomId, kind, now);
  const combat = combatOf(hero);
  const lean = omenOf(season, now)?.sneak ?? 0;
  const rate = (stance: StanceId) =>
    threatOf(fightOdds(`${spawnSeed}:threat:${stance}`, fightInput(hero, combat, monsters, { stance, escapeBonus: lean })));
  const sneak = canSneak(hero, kind) ? sneakCheck(combat, floor.number, monsters.length, lean) : null;
  return {
    kind,
    monsters: monsters.map((m) => combatant(m.key, m)),
    foes: monsters.map((m) => {
      const def = monsterById(m.id);
      const multi = m.powers.find((p) => p.id === 'multiattack');
      return {
        key: m.key, kin: def.kin, role: def.role, about: def.about, attack: m.attack, damage: m.damage, damageFactor: m.damageFactor,
        attacks: multi?.id === 'multiattack' ? multi.attacks : 1,
      };
    }),
    threat: { bold: rate('bold'), steady: rate('steady'), wary: rate('wary') },
    sneak: sneak ? { modifier: sneak.modifier, dc: sneak.dc, edge: sneak.edge ?? 'normal' } : null,
  };
}

// ─── Seeing the Labyrinth ─────────────────────────────────────────────────

/**
 * Whether the Hero knows a secret Door is there: it has been through it, wears
 * the Eye of the Abyss, or spots it today (a WIS Check, Rogues and Elves with
 * advantage; the same answer all day).
 */
function spotsSecret(hero: HeroWithItems, floor: Floor, door: Door, seen: ReadonlySet<number>, now: Date): boolean {
  const hidden = floor.rooms[door.a]!.type === 'hidden' ? door.a : door.b;
  if (seen.has(hidden) || wears(hero, 'eye-of-the-abyss')) return true;
  const race = RACE_DEFS[hero.race as RaceId];
  const rng = createRng(`${hero.id}:secret:${floor.number}:${door.a}-${door.b}:${Math.floor(now.getTime() / DAY_MS)}`);
  return check(rng, {
    modifier: abilityModifier(hero.wis) + (hero.class === 'rogue' ? proficiencyBonus(hero.level) : 0),
    dc: SECRET_DC,
    edge: hero.class === 'rogue' || race.clueAdvantage ? 'advantage' : 'normal',
    rerollOnes: race.rerollOnes,
  }).success;
}

function canPass(door: Door, hero: HeroWithItems): boolean {
  if (door.kind === 'cracked') return hero.class === 'fighter';
  if (door.kind === 'locked') return hero.class === 'rogue' || stackIn(hero, 'key-iron') !== null;
  return true;
}

/** Rogues and Elves (with advantage) may see through a lying Clue; the result is stable per Door. */
function seesThrough(hero: Hero, floor: number, door: Door, from: number): boolean {
  const race = RACE_DEFS[hero.race as RaceId];
  if (hero.class !== 'rogue' && !race.clueAdvantage) return false;
  const rng = createRng(`${hero.id}:clue:${floor}:${door.a}-${door.b}:${from}`);
  return check(rng, {
    modifier: abilityModifier(hero.wis) + proficiencyBonus(hero.level),
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

async function buildView(tx: Tx, hero: HeroWithItems, season: Season, now: Date): Promise<LabyrinthView> {
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
      class: hero.class as ClassId, level: hero.level, path: hero.path as PathId | null, int: hero.int, wis: hero.wis,
      spellUses: hero.spellUses, healUses: hero.healUses,
    }),
    // What the Bag lends the belt, in the order a Run reaches for it.
    kit: KIT_BASES.map((base) => ({ base, count: stackTotal(hero, base), name: baseById(base).name, about: itemAbout(base)! }))
      .filter((k) => k.count > 0),
    shortRests: { left: hero.shortRests, of: SHORT_RESTS, backAt: restsBackAt(hero, now) },
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
  };

  if (hero.location === 'CITY' || hero.floor === null || hero.room === null) {
    return { ...base, location: 'city', floor: null, room: null, exits: [], map: null, graves: [] };
  }

  const lab = labyrinthFor(season);
  const floor = floorOf(lab, hero.floor);
  const room = floor.rooms[hero.room]!;
  const hf = await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: hero.floor } } });
  const seen = new Set(hf?.seen ?? []);

  const exits: Exit[] = doorsOf(floor, room.id)
    .filter(({ door }) => door.kind !== 'cracked' || hero.class === 'fighter')
    .filter(({ door }) => door.kind !== 'secret' || spotsSecret(hero, floor, door, seen, now))
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
        suspicious: !truth && clue.lie && seesThrough(hero, floor.number, door, room.id),
        passable: canPass(door, hero),
        visited: seen.has(to),
        free: freeToEnter(floor, to, hf, now),
      };
    });

  // The Map: every Room stood in, plus the unknown Rooms next to them (the edge of the
  // fog), and the Doors of the Rooms stood in. Only Fighters see cracked walls.
  const known = new Set(seen);
  const doors = new Map<string, { a: number; b: number; kind: Door['kind'] }>();
  for (const id of seen) {
    for (const { door, to } of doorsOf(floor, id)) {
      if (door.kind === 'cracked' && hero.class !== 'fighter') continue;
      if (door.kind === 'secret' && !spotsSecret(hero, floor, door, seen, now)) continue;
      known.add(to);
      doors.set(`${door.a}-${door.b}`, { a: door.a, b: door.b, kind: door.kind });
    }
  }
  // The Eye of the Abyss shows every Special room on the Floor.
  const eye = wears(hero, 'eye-of-the-abyss');
  const special = (type: string) => type === 'vault' || type === 'miniboss' || type === 'hidden';
  if (eye) for (const r of floor.rooms) if (special(r.type)) known.add(r.id);
  const rooms = [...known].sort((a, b) => a - b).map((id) => {
    const r = floor.rooms[id]!;
    const shown = seen.has(id) || (eye && special(r.type));
    return { id, x: r.x, y: r.y, type: shown ? r.type : null, visited: seen.has(id), cleared: isCleared(hf, id, now) };
  });

  const waiting = hero.facing ? await monstersWaiting(tx, hero, season, floor, room.id, now) : null;

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
      restedAt: room.type === 'camp' && hero.campSince ? new Date(hero.campSince.getTime() + REST_MS).toISOString() : null,
      eventView: room.type === 'event' ? await eventView(tx, hero, season, floor, room.id, now) : null,
      vault: room.type === 'vault' ? await vaultView(tx, season, floor.number, room.id, now) : null,
      facing: waiting ? facingView(hero, season, floor, room.id, waiting, now) : null,
    },
    exits,
    map: { rooms, doors: [...doors.values()] },
    graves: graves.map((g) => ({ id: g.id, owner: g.ownerName, items: g.items.length, gold: g.gold, expiresAt: g.expiresAt.toISOString() })),
  };
}

async function vaultView(tx: Tx, season: Season, floor: number, room: number, now: Date) {
  const v = await vaultState(tx, season.id, floor, room, now);
  return { state: v.state, opensAt: v.opensAt?.toISOString() ?? null };
}

// ─── Results ──────────────────────────────────────────────────────────────

async function respond(heroId: string, season: Season, outcome: Outcome): Promise<LabyrinthResult> {
  const now = new Date();
  const hero = await prisma.hero.findUniqueOrThrow({ where: { id: heroId }, include: { items: true } });
  return {
    view: await buildView(prisma, hero, season, now),
    fight: outcome.fight,
    loot: outcome.loot,
    gold: outcome.gold,
    xp: outcome.xp,
    levelUp: outcome.levelUp,
    died: outcome.died,
    notices: outcome.notices,
    checks: outcome.checks,
    duel: outcome.duel,
  };
}

/**
 * Waiting heals. Four hours in a Camp is a long rest: full health and every use back
 * (and the clock starts again). Anywhere else in the Labyrinth health comes back
 * slowly, hour by hour, so a Hero left at death's door can still walk out.
 */
async function restIfDue(tx: Tx, hero: HeroWithItems, now: Date): Promise<void> {
  if (hero.campSince && now.getTime() - hero.campSince.getTime() >= REST_MS) {
    const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
    const rested = { hp: fullHealth(hero), spellUses: uses.spells, healUses: uses.heals, campSince: now, hpAt: now };
    await tx.hero.update({ where: { id: hero.id }, data: rested });
    Object.assign(hero, rested);
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
  const hero = await prisma.$transaction(async (tx) => {
    const h = await loadHero(tx, player, season.id);
    const now = new Date();
    await restIfDue(tx, h, now);
    if (h.location === 'LABYRINTH' && h.floor !== null) await stillFacing(tx, h, season, floorOf(labyrinthFor(season), h.floor), now);
    return h;
  });
  return respond(hero.id, season, emptyOutcome());
}

/** From the City into the Labyrinth: at the entrance of Floor 1, or at a Waypoint already reached. */
export async function enterLabyrinth(player: Player, floorNumber: number, viaPortal = false): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.location !== 'CITY') throw ApiError.conflict('already_inside', 'Already in the Labyrinth');
    if (season.status === 'PLANNED') throw ApiError.conflict('season_not_started', 'The Season has not started yet');
    const now = new Date();
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
          portalFloor: null, portalRoom: null, portalUntil: null, ...restsOnEntry(hero, now),
        },
      });
      return hero.id;
    }
    if (floorNumber !== 1 && !hero.waypoints.includes(floorNumber)) {
      throw ApiError.conflict('no_waypoint', 'You have not reached that Waypoint yet');
    }
    const floor = floorOf(lab, floorNumber);
    const room = floorNumber === 1 ? floor.landing : floor.rooms.find((r) => r.type === 'waypoint')!.id;
    const hf = await heroFloor(tx, hero.id, floorNumber);
    if (!hf.seen.includes(room)) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: room } } });
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        location: 'LABYRINTH', floor: floorNumber, room, prevRoom: room, deathless: true, lucky: true, campSince: null,
        bestFloor: Math.max(hero.bestFloor, floorNumber), ...restsOnEntry(hero, now),
      },
    });
    return hero.id;
  });
  return respond(heroId, season, emptyOutcome());
}

/** One Move: through a Door into the next Room (one Stamina unless it is known and nothing new waits there), and whatever does. */
export async function moveTo(player: Player, to: number): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();

  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room: from } = whereIs(hero, lab);
    await restIfDue(tx, hero, now);
    if (await stillFacing(tx, hero, season, floor, now)) {
      throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
    }
    const exit = doorsOf(floor, from).find((d) => d.to === to);
    if (!exit) throw ApiError.badRequest('no_door', 'No Door leads there');
    if (exit.door.kind === 'secret') {
      const known = await tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: hero.id, floor: floor.number } } });
      if (!spotsSecret(hero, floor, exit.door, new Set(known?.seen ?? []), now)) throw ApiError.badRequest('no_door', 'No Door leads there');
    }
    if (!canPass(exit.door, hero)) {
      throw ApiError.conflict(exit.door.kind === 'cracked' ? 'wall' : 'locked', 'You cannot get through that Door');
    }
    const target = floor.rooms[to]!;
    if (target.type === 'boss' && (!season.bossGateAt || season.bossGateAt > now)) {
      throw ApiError.conflict('boss_gate_closed', 'The Boss gate is still sealed');
    }
    // Walking back through known Rooms is free, unless something new waits in one today.
    const hf = await heroFloor(tx, hero.id, floor.number);
    const known = hf.seen.includes(to);
    const free = freeToEnter(floor, to, hf, now);
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (!free && stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');

    // A locked Door without a Rogue costs one Iron key.
    if (exit.door.kind === 'locked' && hero.class !== 'rogue') {
      const key = stackIn(hero, 'key-iron')!;
      if (key.quantity > 1) await tx.item.update({ where: { id: key.id }, data: { quantity: key.quantity - 1 } });
      else await tx.item.delete({ where: { id: key.id } });
    }

    if (!known) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: to } } });
    // Monsters stop the Hero in the doorway: the Player sees them and chooses (face()).
    // Any other Room becomes the last safe one.
    const waiting = await monstersWaiting(tx, hero, season, floor, to, now);
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        ...(free ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }), room: to, campSince: target.type === 'camp' ? now : null,
        facing: waiting !== null, ...(waiting ? {} : { prevRoom: to }),
      },
    });
    hero.room = to;
    hero.facing = waiting !== null;

    if (!waiting) await resolveRoom(tx, hero, season, floor, to, hf, now, outcome);
    // A sharp eye catches a way into a hidden room.
    const seenNow = new Set([...hf.seen, to]);
    for (const { door } of doorsOf(floor, to)) {
      const hidden = floor.rooms[door.a]!.type === 'hidden' ? door.a : door.b;
      if (door.kind === 'secret' && !seenNow.has(hidden) && spotsSecret(hero, floor, door, seenNow, now)) {
        outcome.notices.push(t('A thin draft through a crack in the stones: a secret Door!', 'Тонкий сквозняк из трещины в камнях: потайная дверь!'));
      }
    }
    return hero.id;
  });
  return respond(heroId, season, outcome);
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
    case 'waypoint':
      if (!hero.waypoints.includes(floor.number)) {
        await tx.hero.update({ where: { id: hero.id }, data: { waypoints: { push: floor.number } } });
        out.notices.push(t('The Waypoint hums awake. You can now enter the Labyrinth here.', 'Путевой камень пробудился. Теперь сюда можно входить из города.'));
      }
      break;
    case 'camp':
      out.notices.push(t('A safe Camp. Wait here four hours and you will be fully rested.', 'Безопасный лагерь. Подождите здесь четыре часа — и вы полностью отдохнёте.'));
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
 * an ambush), or Retreat to the last safe Room for free.
 */
export async function face(player: Player, action: FaceAction): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room } = whereIs(hero, lab);
    const kind = await stillFacing(tx, hero, season, floor, now);
    if (!kind) throw ApiError.conflict('not_facing', 'There is nothing here to face');

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
        const input = sneakCheck(combatOf(hero), floor.number, monsters.length, omenOf(season, now)?.sneak ?? 0);
        const seed = newSeed();
        const rng = createRng(seed);
        const { check: result } = await withLuck(tx, hero, t('Sneak past', 'Прокрасться мимо'), () => ({ check: check(rng, input) }), outcome);
        await tx.rollLog.create({ data: { playerId: hero.playerId, kind: 'sneak', seed, detail: { floor: floor.number, room, success: result.success } } });
        slipped = result.success;
      }
      if (slipped) {
        await tx.hero.update({ where: { id: hero.id }, data: { facing: false } });
        if (!action.smoke) outcome.notices.push(t('You slip past unseen.', 'Вы незаметно прокрадываетесь мимо.'));
        await trackBounties(tx, hero, { type: 'sneak' }, outcome, now);
        return hero.id;
      }
      outcome.notices.push(t('They spot you! The monsters strike first.', 'Вас заметили! Монстры бьют первыми.'));
      await fightHere(tx, hero, season, floor, room, kind, outcome, { surprise: 'hero' });
      return hero.id;
    }

    if (action.bomb) await takeStack(tx, hero, 'bomb-fire', 1, 'no_bomb');
    // The Threat the Player was shown, for bounties that ask for a hard fight.
    const { monsters, spawnSeed } = monstersFor(season, hero, floor, room, kind, now);
    const threat = threatOf(fightOdds(`${spawnSeed}:threat:${hero.stance}`, fightInput(hero, combatOf(hero), monsters, { escapeBonus: omenOf(season, now)?.sneak ?? 0 })));
    await fightHere(tx, hero, season, floor, room, kind, outcome, { bomb: action.bomb, threat });
    return hero.id;
  });
  return respond(heroId, season, outcome);
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
  const now = new Date();
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

/** Down the stairs to the next Floor's landing: one Stamina the first time, free after. */
export async function descend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room } = whereIs(hero, lab);
    if (floor.rooms[room]!.type !== 'stairs' || floor.number >= FLOOR_COUNT) {
      throw ApiError.conflict('no_stairs', 'There are no stairs down here');
    }
    const next = floorOf(lab, floor.number + 1);
    const hf = await heroFloor(tx, hero.id, next.number);
    const known = hf.seen.includes(next.landing);
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (!known && stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');
    if (!known) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: next.landing } } });
    // A Floor never reached before is worth XP.
    const firstXp = next.number > hero.bestFloor ? await boostedXp(tx, hero, season, NEW_FLOOR_XP * next.number) : 0;
    const levelUp = firstXp > 0 ? gainXp(hero, firstXp) : null;
    if (levelUp) {
      outcome.xp = firstXp;
      outcome.levelUp = levelUp.newLevel;
      outcome.notices.push(t(`A new depth: Floor ${next.number}.`, `Новая глубина: этаж ${next.number}.`));
      await feed(tx, season, hero, 'depth', { floor: next.number });
    }
    await trackBounties(tx, hero, { type: 'depth', floor: next.number }, outcome, now);
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        floor: next.number, room: next.landing, prevRoom: next.landing, campSince: null,
        ...(known ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }), bestFloor: Math.max(hero.bestFloor, next.number),
        ...levelUp?.data,
      },
    });
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/**
 * From a lower Floor's landing back up the stairs: free when the Hero comes out at
 * stairs it knows, one Stamina otherwise. Every stairs Room leads to the same
 * landing, so the Hero comes out at stairs it already knows, or at the first
 * stairs Room of the Floor above.
 */
export async function ascend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room: at } = whereIs(hero, lab);
    if (floor.number === 1 || at !== floor.landing) throw ApiError.conflict('no_stairs_up', 'There are no stairs up here');
    const above = floorOf(lab, floor.number - 1);
    const hf = await heroFloor(tx, hero.id, above.number);
    const stairs = above.rooms.filter((r) => r.type === 'stairs');
    const room = (stairs.find((r) => hf.seen.includes(r.id)) ?? stairs[0]!).id;
    const known = hf.seen.includes(room);
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (!known && stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');
    if (!known) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: room } } });
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        floor: above.number, room, prevRoom: room, campSince: null, ...(known ? {} : { stamina: stamina.stamina - 1, staminaAt: stamina.savedAt }),
      },
    });
    return hero.id;
  });
  return respond(heroId, season, emptyOutcome());
}

/** Back to the City: gold becomes safe, health and abilities come back. */
async function goHome(tx: Tx, hero: HeroWithItems, out: Outcome) {
  if (hero.carriedGold > 0) await trackBounties(tx, hero, { type: 'bank', gold: hero.carriedGold }, out);
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, campSince: null,
      gold: { increment: hero.carriedGold }, carriedGold: 0, hp: fullHealth(hero), spellUses: uses.spells, healUses: uses.heals,
    },
  });
}

/** Leave from the entrance, or from a Waypoint Room this Hero has woken. */
export async function leaveByWaypoint(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor, room: at } = whereIs(hero, lab);
    const room = floor.rooms[at]!;
    const atEntrance = floor.number === 1 && room.type === 'landing';
    if (!atEntrance && !(room.type === 'waypoint' && hero.waypoints.includes(floor.number))) {
      throw ApiError.conflict('not_at_waypoint', 'You can only leave from a Waypoint or the entrance');
    }
    await goHome(tx, hero, outcome);
    return hero.id;
  });
  outcome.notices.unshift(t('You are back in the City.', 'Вы вернулись в город.'));
  return respond(heroId, season, outcome);
}

/** A short rest anywhere in the Labyrinth without monsters in the way: half of full health and Stamina back (v0). */
export async function shortRest(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const { floor } = whereIs(hero, lab);
    await restIfDue(tx, hero, now);
    if (await stillFacing(tx, hero, season, floor, now)) throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
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
 */
export async function readPortal(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.location !== 'LABYRINTH' || hero.floor === null || hero.room === null) throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const scroll = stackIn(hero, 'scroll-portal');
    if (!scroll) throw ApiError.conflict('no_scroll', 'You have no Town Portal scroll');
    if (scroll.quantity > 1) await tx.item.update({ where: { id: scroll.id }, data: { quantity: scroll.quantity - 1 } });
    else await tx.item.delete({ where: { id: scroll.id } });
    const floor = hero.floor;
    const room = hero.facing ? (hero.prevRoom ?? floorOf(labyrinthFor(season), floor).landing) : hero.room;
    await goHome(tx, hero, outcome);
    await tx.hero.update({ where: { id: hero.id }, data: { portalFloor: floor, portalRoom: room, portalUntil: new Date(Date.now() + PORTAL_MS) } });
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
    const hero = await loadHero(tx, player, season.id);
    // Monsters in the Room guard its Graves: fight them, or Sneak past, first.
    if (hero.location === 'LABYRINTH' && hero.floor !== null
      && await stillFacing(tx, hero, season, floorOf(labyrinthFor(season), hero.floor), new Date())) {
      throw ApiError.conflict('facing', 'Fight, Sneak past or Retreat first');
    }
    // The Grave's row is the lock: two Heroes looting at once take turns.
    await tx.$queryRaw`SELECT id FROM "Grave" WHERE id = ${graveId} FOR UPDATE`;
    const grave = await tx.grave.findUnique({ where: { id: graveId }, include: { items: true, hero: { select: { playerId: true } } } });
    if (!grave || grave.seasonId !== season.id || grave.expiresAt <= new Date()) throw ApiError.notFound('no_grave', 'No such Grave');
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
