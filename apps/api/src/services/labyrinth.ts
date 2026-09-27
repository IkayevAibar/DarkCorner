import type { Hero, HeroFloor, Player, Season } from '@prisma/client';
import {
  type Combatant, type Direction, type Exit, type FightReplay, type ItemView, type LabyrinthResult, type LabyrinthView,
  type LocalizedText, fightReplaySchema,
} from '@dark/shared';
import {
  BAD_LUCK_PER_FIGHT, BAD_LUCK_PER_MINIBOSS, BAG_SLOTS, type ClassId, type Door, FLOOR_COUNT, type Floor, type Labyrinth,
  type MonsterInstance, RACE_DEFS, type RaceId, STAMINA_MAX, STAMINA_REFILL_MS, THEMES, type TalentId, XP_FOR_LEVEL,
  abilityModifier, check, cluesFor, createRng, currentStamina, doorsOf, generateLabyrinth, heroCombat, monsterById,
  proficiencyBonus, restUses, simulateFight, spawnEncounter,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { feed } from './feed.js';
import { giveStarterKit, portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import { type HeroWithItems, type Tx, lockHero } from './ledger.js';
import { addBadLuck, dropChest, dropGear, dropStack, withGoldFind } from './loot.js';
import { gainXp } from './progression.js';
import { currentSeason } from './seasons.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const GRAVE_MS = 48 * 60 * 60 * 1000;
const REST_MS = 4 * 60 * 60 * 1000;
/** Clues: a WIS Check against this sees through a lie (v0). */
const CLUE_DC = 13;
// Loot (docs/design.md → Where loot comes from; all v0).
/** An Item drops from about 40% of won fights. */
const DROP_CHANCE = 0.4;
/** Iron keys turn up now and then. */
const KEY_CHANCE = 0.03;
/** Treasure Rooms: 1–3 Items, and sometimes a Chest. */
const TREASURE_ITEMS: [number, number][] = [[1, 50], [2, 35], [3, 15]];
const TREASURE_CHEST = 0.25;
const MINIBOSS_CHEST = 0.5;
/** XP for setting foot on a Floor for the first time, per Floor number. */
const NEW_FLOOR_XP = 50;

const t = (en: string, ru: string): LocalizedText => ({ en, ru });

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

async function heroFloor(tx: Tx, heroId: string, floor: number): Promise<HeroFloor> {
  return tx.heroFloor.upsert({ where: { heroId_floor: { heroId, floor } }, create: { heroId, floor }, update: {} });
}

const clearedAt = (hf: HeroFloor | null, room: number): Date | null => {
  const iso = (hf?.cleared as Record<string, string> | undefined)?.[String(room)];
  return iso ? new Date(iso) : null;
};
const isCleared = (hf: HeroFloor | null, room: number, now: Date) => {
  const at = clearedAt(hf, room);
  return at !== null && now.getTime() - at.getTime() < DAY_MS;
};

const bagCount = (hero: HeroWithItems) => hero.items.filter((i) => i.place === 'BAG').length;
const stackIn = (hero: HeroWithItems, base: string) => hero.items.find((i) => i.place === 'BAG' && i.base === base) ?? null;
const wears = (hero: HeroWithItems, uniqueId: string) => hero.items.some((i) => i.place === 'WORN' && i.uniqueId === uniqueId);

// ─── Seeing the Labyrinth ─────────────────────────────────────────────────

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

async function buildView(tx: Tx, hero: HeroWithItems, season: Season, now: Date): Promise<LabyrinthView> {
  const { stamina, savedAt } = currentStamina(hero.stamina, hero.staminaAt, now);
  const potions = hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion').reduce((s, i) => s + i.quantity, 0);
  const portals = hero.items.filter((i) => i.place === 'BAG' && i.base === 'scroll-portal').reduce((s, i) => s + i.quantity, 0);
  const heroPart = {
    name: hero.name,
    portraitUrl: portraitUrlOf(hero),
    banner: hero.banner,
    hp: hero.hp,
    maxHp: hero.maxHp,
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
  };
  const base = { hero: heroPart, waypoints: hero.waypoints, bestFloor: hero.bestFloor };

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
      };
    });

  // The Map: every Room stood in, plus the unknown Rooms next to them (the edge of the
  // fog), and the Doors of the Rooms stood in. Only Fighters see cracked walls.
  const known = new Set(seen);
  const doors = new Map<string, { a: number; b: number; kind: Door['kind'] }>();
  for (const id of seen) {
    for (const { door, to } of doorsOf(floor, id)) {
      if (door.kind === 'cracked' && hero.class !== 'fighter') continue;
      known.add(to);
      doors.set(`${door.a}-${door.b}`, { a: door.a, b: door.b, kind: door.kind });
    }
  }
  // The Eye of the Abyss shows every Special room on the Floor.
  const eye = wears(hero, 'eye-of-the-abyss');
  if (eye) for (const r of floor.rooms) if (r.type === 'vault' || r.type === 'miniboss') known.add(r.id);
  const rooms = [...known].sort((a, b) => a - b).map((id) => {
    const r = floor.rooms[id]!;
    const shown = seen.has(id) || (eye && (r.type === 'vault' || r.type === 'miniboss'));
    return { id, x: r.x, y: r.y, type: shown ? r.type : null, visited: seen.has(id), cleared: isCleared(hf, id, now) };
  });

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
    },
    exits,
    map: { rooms, doors: [...doors.values()] },
    graves: graves.map((g) => ({ id: g.id, owner: g.ownerName, items: g.items.length, gold: g.gold, expiresAt: g.expiresAt.toISOString() })),
  };
}

// ─── Results ──────────────────────────────────────────────────────────────

interface Outcome {
  fight: FightReplay | null;
  loot: ItemView[];
  gold: number;
  xp: number;
  levelUp: number | null;
  died: boolean;
  notices: LocalizedText[];
}

const emptyOutcome = (): Outcome => ({ fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false, notices: [] });

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
  };
}

/** A Hero sitting in a Camp for four hours gets up fully rested (and the clock starts again). */
async function restIfDue(tx: Tx, hero: Hero, now: Date): Promise<void> {
  if (!hero.campSince || now.getTime() - hero.campSince.getTime() < REST_MS) return;
  const uses = restUses(hero.class as ClassId, hero.level);
  const rested = { hp: hero.maxHp, spellUses: uses.spells, healUses: uses.heals, campSince: now };
  await tx.hero.update({ where: { id: hero.id }, data: rested });
  Object.assign(hero, rested);
}

// ─── Actions ──────────────────────────────────────────────────────────────

export async function labyrinthState(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const hero = await prisma.$transaction(async (tx) => {
    const h = await loadHero(tx, player, season.id);
    await restIfDue(tx, h, new Date());
    return h;
  });
  return respond(hero.id, season, emptyOutcome());
}

/** From the City into the Labyrinth: at the entrance of Floor 1, or at a Waypoint already reached. */
export async function enterLabyrinth(player: Player, floorNumber: number): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.location !== 'CITY') throw ApiError.conflict('already_inside', 'Already in the Labyrinth');
    if (floorNumber !== 1 && !hero.waypoints.includes(floorNumber)) {
      throw ApiError.conflict('no_waypoint', 'You have not reached that Waypoint yet');
    }
    const floor = floorOf(lab, floorNumber);
    const room = floorNumber === 1 ? floor.landing : floor.rooms.find((r) => r.type === 'waypoint')!.id;
    await heroFloor(tx, hero.id, floorNumber);
    await tx.heroFloor.update({
      where: { heroId_floor: { heroId: hero.id, floor: floorNumber } },
      data: { seen: { push: room } },
    });
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        location: 'LABYRINTH', floor: floorNumber, room, prevRoom: room, deathless: true, lucky: true, campSince: null,
        bestFloor: Math.max(hero.bestFloor, floorNumber),
      },
    });
    return hero.id;
  });
  return respond(heroId, season, emptyOutcome());
}

/** One Move: through a Door into the next Room, for one Stamina, and whatever waits there. */
export async function moveTo(player: Player, to: number): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();

  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.location !== 'LABYRINTH' || hero.floor === null || hero.room === null) {
      throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    }
    await restIfDue(tx, hero, now);
    const floor = floorOf(lab, hero.floor);
    const exit = doorsOf(floor, hero.room).find((d) => d.to === to);
    if (!exit) throw ApiError.badRequest('no_door', 'No Door leads there');
    if (!canPass(exit.door, hero)) {
      throw ApiError.conflict(exit.door.kind === 'cracked' ? 'wall' : 'locked', 'You cannot get through that Door');
    }
    const target = floor.rooms[to]!;
    if (target.type === 'boss' && (!season.bossGateAt || season.bossGateAt > now)) {
      throw ApiError.conflict('boss_gate_closed', 'The Boss gate is still sealed');
    }
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');

    // A locked Door without a Rogue costs one Iron key.
    if (exit.door.kind === 'locked' && hero.class !== 'rogue') {
      const key = stackIn(hero, 'key-iron')!;
      if (key.quantity > 1) await tx.item.update({ where: { id: key.id }, data: { quantity: key.quantity - 1 } });
      else await tx.item.delete({ where: { id: key.id } });
    }

    const hf = await heroFloor(tx, hero.id, floor.number);
    await tx.heroFloor.update({
      where: { id: hf.id },
      data: hf.seen.includes(to) ? {} : { seen: { push: to } },
    });
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        stamina: stamina.stamina - 1,
        staminaAt: stamina.savedAt,
        room: to,
        campSince: target.type === 'camp' ? now : null,
      },
    });

    await resolveRoom(tx, { ...hero, room: to }, season, floor, to, hf, now, outcome);
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

async function resolveRoom(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, roomId: number, hf: HeroFloor, now: Date, out: Outcome) {
  const room = floor.rooms[roomId]!;
  switch (room.type) {
    case 'fight':
      if (!isCleared(hf, roomId, now)) await fight(tx, hero, season, floor, roomId, 'fight', out);
      break;
    case 'miniboss': {
      const claim = await tx.specialClaim.findUnique({ where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } } });
      if (claim && now.getTime() - claim.claimedAt.getTime() < DAY_MS) {
        out.notices.push(t('The Mini-boss here lies defeated. It will be back tomorrow.', 'Мини-босс здесь повержен. Он вернётся завтра.'));
      } else {
        await fight(tx, hero, season, floor, roomId, 'miniboss', out);
      }
      break;
    }
    case 'boss':
      await fight(tx, hero, season, floor, roomId, 'boss', out);
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
    case 'treasure':
      if (!isCleared(hf, roomId, now)) {
        const rng = createRng(newSeed());
        let r = rng.next() * 100;
        const count = TREASURE_ITEMS.find(([, w]) => (r -= w) < 0)?.[0] ?? 1;
        await dropGear(tx, hero, season, { floor: floor.number, count, source: 'treasure' }, out);
        if (rng.chance(TREASURE_CHEST)) await dropChest(tx, hero, season, floor.number, out);
        const gold = withGoldFind(hero, rng.int(5, 15) * (floor.number + 1));
        await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
        out.gold += gold;
        await markCleared(tx, hf, roomId, now);
      }
      break;
    case 'event':
      out.notices.push(t('Something strange is here… (Event rooms open in week 4.)', 'Здесь что-то странное… (Комнаты-события появятся на 4-й неделе.)'));
      break;
    case 'vault':
      out.notices.push(t('A sealed Vault. (Vaults open in week 5.)', 'Запечатанная сокровищница. (Откроется на 5-й неделе.)'));
      break;
    default:
      break;
  }
}

async function markCleared(tx: Tx, hf: HeroFloor, room: number, now: Date) {
  const cleared = { ...(hf.cleared as Record<string, string>), [String(room)]: now.toISOString() };
  await tx.heroFloor.update({ where: { id: hf.id }, data: { cleared } });
}

function combatant(key: string, m: MonsterInstance): Combatant {
  const def = monsterById(m.id);
  return { key, name: def.name, art: def.art, hp: m.hp, maxHp: m.maxHp, ac: m.ac, boss: def.role === 'boss' || def.role === 'miniboss', banner: null };
}

async function fight(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, roomId: number, kind: 'fight' | 'miniboss' | 'boss', out: Outcome) {
  const now = new Date();
  // Personal monsters: the same Room shows the same group to one Hero for a day.
  const spawnSeed = `${season.seed}:${hero.id}:${floor.number}:${roomId}:${Math.floor(now.getTime() / DAY_MS)}`;
  const monsters = spawnEncounter(createRng(spawnSeed), floor.number, kind);

  const worn = hero.items.filter((i) => i.place === 'WORN').map((i) => ({
    base: i.base, quality: i.quality, upgrade: i.upgrade, radiant: i.radiant,
    bonusStats: i.bonusStats as { stat: string; value: number }[], uniqueId: i.uniqueId,
  }));
  const combat = heroCombat({
    name: hero.name, class: hero.class as ClassId, race: hero.race as RaceId, level: hero.level,
    talents: hero.talents as TalentId[], scores: { str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha },
    maxHp: hero.maxHp, hp: hero.hp, worn,
  });
  const potionStacks = hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion');
  const seed = newSeed();
  const result = simulateFight(createRng(seed), {
    hero: combat,
    monsters,
    uses: { spells: hero.spellUses, heals: hero.healUses },
    potions: potionStacks.reduce((s, i) => s + i.quantity, 0),
    runPowers: { deathless: hero.deathless, lucky: hero.lucky },
  });
  await tx.rollLog.create({
    data: { playerId: hero.playerId, kind: 'fight', seed, detail: { floor: floor.number, room: roomId, kind, outcome: result.outcome, spawnSeed } },
  });

  out.fight = fightReplaySchema.parse({
    map: floor.rooms[roomId]!.map,
    hero: {
      key: 'hero', name: { en: hero.name, ru: hero.name }, art: portraitUrlOf(hero), hp: combat.hp, maxHp: combat.maxHp, ac: combat.ac,
      boss: false, banner: hero.banner,
    },
    monsters: monsters.map((m) => combatant(m.key, m)),
    events: result.events,
    outcome: result.outcome,
  });

  // Potions drunk come out of the Bag.
  let drink = result.potionsUsed;
  for (const stack of potionStacks) {
    if (drink <= 0) break;
    const used = Math.min(drink, stack.quantity);
    drink -= used;
    if (used === stack.quantity) await tx.item.delete({ where: { id: stack.id } });
    else await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity - used } });
  }

  if (result.outcome === 'dead') {
    await die(tx, hero, season, floor.number, roomId, out);
    return;
  }

  const rng = createRng(`${seed}:after`);
  const levelUp = gainXp(rng, { ...hero, hp: result.hp }, result.xp);
  out.xp = result.xp;
  out.levelUp = levelUp.newLevel;
  await tx.hero.update({
    where: { id: hero.id },
    data: {
      hp: result.hp,
      spellUses: result.uses.spells,
      healUses: result.uses.heals,
      deathless: result.runPowers.deathless,
      lucky: result.runPowers.lucky,
      ...levelUp.data,
      ...(result.outcome === 'victory' ? { prevRoom: roomId } : { room: hero.prevRoom ?? floor.landing }),
    },
  });

  if (result.outcome === 'survived') {
    out.notices.push(t('Barely alive, you crawl back to the last Room you cleared.', 'Едва живы, вы отползаете в последнюю зачищенную комнату.'));
    return;
  }

  // Victory: the Room stays clear for a day, the Bad-luck meter ticks, and there is loot.
  if (kind === 'fight') {
    const hf = await heroFloor(tx, hero.id, floor.number);
    await markCleared(tx, hf, roomId, now);
  } else {
    await tx.specialClaim.upsert({
      where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } },
      create: { seasonId: season.id, floor: floor.number, room: roomId, heroId: hero.id },
      update: { heroId: hero.id, claimedAt: now },
    });
  }
  await addBadLuck(tx, hero, kind === 'fight' ? BAD_LUCK_PER_FIGHT : BAD_LUCK_PER_MINIBOSS);
  const baseGold = monsters.reduce((s, m) => s + createRng(`${seed}:gold:${m.key}`).int(1, 4) * (floor.number + 1), 0) * (kind === 'fight' ? 1 : 10);
  const gold = withGoldFind(hero, baseGold);
  out.gold += gold;
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
  const drops = kind === 'fight' ? (rng.chance(DROP_CHANCE) ? 1 : 0) : 2;
  if (drops > 0) await dropGear(tx, hero, season, { floor: floor.number, count: drops, source: kind }, out);
  if (kind === 'fight' && rng.chance(KEY_CHANCE)) await dropStack(tx, hero, season, 'key-iron', 1, out);
  if (kind === 'miniboss' && rng.chance(MINIBOSS_CHEST)) await dropChest(tx, hero, season, floor.number, out);
}

/** Death: everything carried goes into a Grave here; the Hero wakes at the Temple with a Starter kit. */
async function die(tx: Tx, hero: HeroWithItems, season: Season, floorNumber: number, roomId: number, out: Outcome) {
  const grave = await tx.grave.create({
    data: {
      seasonId: season.id, floor: floorNumber, room: roomId, heroId: hero.id, ownerName: hero.name,
      gold: hero.carriedGold, expiresAt: new Date(Date.now() + GRAVE_MS),
    },
  });
  await tx.item.updateMany({
    where: { heroId: hero.id, place: { in: ['WORN', 'BAG'] } },
    data: { place: 'GRAVE', heroId: null, slot: null, graveId: grave.id },
  });
  const uses = restUses(hero.class as ClassId, hero.level);
  const updated = await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, hp: hero.maxHp, carriedGold: 0,
      spellUses: uses.spells, healUses: uses.heals, deathless: true, lucky: true, campSince: null,
    },
  });
  await giveStarterKit(tx, updated, season.id);
  out.died = true;
  await feed(tx, season, hero, 'death', { floor: floorNumber, grave: grave.id });
  out.notices.push(t(
    'You died. Everything you carried lies in a Grave for 48 hours. You wake at the Temple with a Starter kit.',
    'Вы погибли. Всё, что было при вас, лежит в могиле 48 часов. Вы очнулись в Храме с начальным снаряжением.',
  ));
}

/** Down the stairs to the next Floor's landing, for one Stamina. */
export async function descend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.floor === null || hero.room === null) throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const floor = floorOf(lab, hero.floor);
    if (floor.rooms[hero.room]!.type !== 'stairs' || hero.floor >= FLOOR_COUNT) {
      throw ApiError.conflict('no_stairs', 'There are no stairs down here');
    }
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');
    const next = floorOf(lab, hero.floor + 1);
    const hf = await heroFloor(tx, hero.id, next.number);
    if (!hf.seen.includes(next.landing)) {
      await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: next.landing } } });
    }
    // A Floor never reached before is worth XP.
    const firstTime = next.number > hero.bestFloor;
    const levelUp = firstTime ? gainXp(createRng(newSeed()), hero, NEW_FLOOR_XP * next.number) : null;
    if (levelUp) {
      outcome.xp = NEW_FLOOR_XP * next.number;
      outcome.levelUp = levelUp.newLevel;
      outcome.notices.push(t(`A new depth: Floor ${next.number}.`, `Новая глубина: этаж ${next.number}.`));
      await feed(tx, season, hero, 'depth', { floor: next.number });
    }
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        floor: next.number, room: next.landing, prevRoom: next.landing, campSince: null,
        stamina: stamina.stamina - 1, staminaAt: stamina.savedAt, bestFloor: Math.max(hero.bestFloor, next.number),
        ...levelUp?.data,
      },
    });
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

/**
 * From a lower Floor's landing back up the stairs, for one Stamina. Every stairs
 * Room leads to the same landing, so the Hero comes out at stairs it already
 * knows, or at the first stairs Room of the Floor above.
 */
export async function ascend(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const now = new Date();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.floor === null || hero.room === null) throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const floor = floorOf(lab, hero.floor);
    if (hero.floor === 1 || hero.room !== floor.landing) throw ApiError.conflict('no_stairs_up', 'There are no stairs up here');
    const stamina = currentStamina(hero.stamina, hero.staminaAt, now);
    if (stamina.stamina < 1) throw ApiError.conflict('no_stamina', 'Out of Stamina');
    const above = floorOf(lab, hero.floor - 1);
    const hf = await heroFloor(tx, hero.id, above.number);
    const stairs = above.rooms.filter((r) => r.type === 'stairs');
    const room = (stairs.find((r) => hf.seen.includes(r.id)) ?? stairs[0]!).id;
    if (!hf.seen.includes(room)) await tx.heroFloor.update({ where: { id: hf.id }, data: { seen: { push: room } } });
    await tx.hero.update({
      where: { id: hero.id },
      data: { floor: above.number, room, prevRoom: room, campSince: null, stamina: stamina.stamina - 1, staminaAt: stamina.savedAt },
    });
    return hero.id;
  });
  return respond(heroId, season, emptyOutcome());
}

/** Back to the City: gold becomes safe, health and abilities come back. */
async function goHome(tx: Tx, hero: Hero) {
  const uses = restUses(hero.class as ClassId, hero.level);
  await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, campSince: null,
      gold: { increment: hero.carriedGold }, carriedGold: 0, hp: hero.maxHp, spellUses: uses.spells, healUses: uses.heals,
    },
  });
}

/** Leave from a Waypoint Room this Hero has woken. */
export async function leaveByWaypoint(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const lab = labyrinthFor(season);
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.floor === null || hero.room === null) throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const room = floorOf(lab, hero.floor).rooms[hero.room]!;
    const atEntrance = hero.floor === 1 && room.type === 'landing';
    if (!atEntrance && !(room.type === 'waypoint' && hero.waypoints.includes(hero.floor))) {
      throw ApiError.conflict('not_at_waypoint', 'You can only leave from a Waypoint or the entrance');
    }
    await goHome(tx, hero);
    return hero.id;
  });
  return respond(heroId, season, { ...emptyOutcome(), notices: [t('You are back in the City.', 'Вы вернулись в город.')] });
}

/** Read a Town Portal scroll: home from anywhere. */
export async function readPortal(player: Player): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    if (hero.location !== 'LABYRINTH') throw ApiError.conflict('not_inside', 'Enter the Labyrinth first');
    const scroll = stackIn(hero, 'scroll-portal');
    if (!scroll) throw ApiError.conflict('no_scroll', 'You have no Town Portal scroll');
    if (scroll.quantity > 1) await tx.item.update({ where: { id: scroll.id }, data: { quantity: scroll.quantity - 1 } });
    else await tx.item.delete({ where: { id: scroll.id } });
    await goHome(tx, hero);
    return hero.id;
  });
  return respond(heroId, season, { ...emptyOutcome(), notices: [t('The portal closes behind you. You are in the City.', 'Портал закрылся за спиной. Вы в городе.')] });
}

/** Take what a Grave in this Room holds, as far as the Bag allows; its gold always fits. */
export async function lootGrave(player: Player, graveId: string): Promise<LabyrinthResult> {
  const season = await currentSeason();
  const outcome = emptyOutcome();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await loadHero(tx, player, season.id);
    const grave = await tx.grave.findUnique({ where: { id: graveId }, include: { items: true } });
    if (!grave || grave.seasonId !== season.id || grave.expiresAt <= new Date()) throw ApiError.notFound('no_grave', 'No such Grave');
    if (hero.floor !== grave.floor || hero.room !== grave.room) throw ApiError.conflict('not_here', 'That Grave is not in this Room');
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
    else outcome.notices.push(t('Your Bag is full; the rest stays in the Grave.', 'Сумка полна; остальное осталось в могиле.'));
    return hero.id;
  });
  return respond(heroId, season, outcome);
}

