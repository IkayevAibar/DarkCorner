import type { Hero, HeroFloor, Item, Season } from '@prisma/client';
import { type Combatant, type DuoChestView, type FightReplay, type Foe, type ItemView, type LocalizedText, fightReplaySchema } from '@dark/shared';
import {
  BAD_LUCK_PER_FIGHT, BAD_LUCK_PER_MINIBOSS, type ClassId, DEEP_FLOOR, type FightEvent, type FightInput, type Floor, GILDED_GOLD, type HeroCombat, LOOT,
  type MonsterInstance, type PathId, RELIC_CHANCE, type RaceId, type SideResult, type StanceId, type TalentId, type ThreatId, weakeningAt,
  type DeedCounts, KILL_METRIC, type Oath, monsterStrike, weaponStrike, createRng, dropOdds, duoEncounter, fireBomb, heroCombat, monsterById, restUses,
  partnerRaises, simulateFight, spawnEncounter,
} from '@dark/engine';
import { newSeed } from '../lib/seed.js';
import { weakeningFrom } from './chapters.js';
import { monsterOmen } from './difficulty.js';
import { worldSettings } from '../settings.js';
import { feed } from './feed.js';
import { companionFalls, isCompanion, releaseCompanion } from './companion.js';
import { giveStarterKit, portraitUrlOf } from './heroes.js';
import type { HeroWithItems, Tx } from './ledger.js';
import { type Drop, addBadLuck, dropChest, dropGear, dropStack, rollDrop, withGoldFind } from './loot.js';
import { boostedXp, gainXp } from './progression.js';
import { grantRelic } from './relics.js';
import { trackBounties } from './bounties.js';
import { countDeeds } from './deeds.js';
import { trackHunt } from './hunts.js';
import { omenOf } from './omens.js';
import { gameNow, gameNowMs } from '../gameClock.js';

// Fights, death and what one Hero has cleared: shared by Moves and Event rooms.

export const DAY_MS = 24 * 60 * 60 * 1000;
const GRAVE_MS = 48 * 60 * 60 * 1000;

export const t = (en: string, ru: string): LocalizedText => ({ en, ru });

/** What a Labyrinth action brought, for the result screen. */
export interface Outcome {
  fight: FightReplay | null;
  loot: ItemView[];
  gold: number;
  xp: number;
  levelUp: number | null;
  died: boolean;
  notices: LocalizedText[];
  checks: CheckOutcome[];
  duel: { hero: number; goblin: number; win: boolean } | null;
  /** For the Run's tally: Rooms walked into for the first time, and the Floor a descent reached (0 if none). */
  explored: number;
  depth: number;
  /** Set when the action ended the Run: the gold it ended with, banked or left in a Grave. */
  runEnd: { gold: number } | null;
  /** Deeds finished by the action, shown apart from the other lines. */
  deeds: DoneDeed[];
  /** An Oathstone settled: what each swore, from this Hero's side. */
  oath: { mine: Oath; partner: Oath } | null;
  /** A Duo Chest that closed: its last state, from this Hero's side. */
  closedChest: DuoChestView | null;
}

export interface DoneDeed { id: string; title: LocalizedText; gold: number }

/** A Check rolled on screen (traps, Shrines, locks). */
export interface CheckOutcome {
  label: LocalizedText;
  dice: number[];
  natural: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  /** The Lucky charm or Luckstone rolled a failed d20 again: the first natural. */
  rerolled: number | null;
}

export const emptyOutcome = (): Outcome => ({
  fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false, notices: [], checks: [], duel: null, explored: 0, depth: 0, runEnd: null, deeds: [],
  oath: null,
  closedChest: null,
});

// ─── What one Hero knows of a Floor ───────────────────────────────────────

export async function heroFloor(tx: Tx, heroId: string, floor: number): Promise<HeroFloor> {
  return tx.heroFloor.upsert({ where: { heroId_floor: { heroId, floor } }, create: { heroId, floor }, update: {} });
}

export const clearedAt = (hf: HeroFloor | null, room: number): Date | null => {
  const iso = (hf?.cleared as Record<string, string> | undefined)?.[String(room)];
  return iso ? new Date(iso) : null;
};

/** A Room this Hero cleared in the last 24 hours (or `within`) stays clear for it. */
export const isCleared = (hf: HeroFloor | null, room: number, now: Date, within = DAY_MS): boolean => {
  const at = clearedAt(hf, room);
  return at !== null && now.getTime() - at.getTime() < within;
};

export async function markCleared(tx: Tx, hf: HeroFloor, room: number, now: Date): Promise<void> {
  const fresh = await tx.heroFloor.findUniqueOrThrow({ where: { id: hf.id } });
  const cleared = { ...(fresh.cleared as Record<string, string>), [String(room)]: now.toISOString() };
  await tx.heroFloor.update({ where: { id: hf.id }, data: { cleared } });
}

/** Back to the last safe Room after a Retreat, an escape or a lost fight; landing in a Camp starts its rest. */
export function fallBack(hero: Pick<Hero, 'prevRoom'>, floor: Floor, now: Date): { room: number; campSince: Date | null } {
  const room = hero.prevRoom ?? floor.landing;
  return { room, campSince: floor.rooms[room]!.type === 'camp' ? now : null };
}

// ─── Fights ───────────────────────────────────────────────────────────────

export function combatant(key: string, m: MonsterInstance): Combatant {
  const def = monsterById(m.id);
  return {
    key, name: def.name, art: def.art, hp: m.hp, maxHp: m.maxHp, ac: m.ac, boss: def.role === 'boss' || def.role === 'miniboss' || def.role === 'warden', banner: null,
    elite: m.elite, powers: m.powers.map((p) => p.id), strike: monsterStrike(def), kin: def.kin, class: null,
  };
}

/** A monster's card for the Player: what it is, and how hard it hits. */
export function foeOf(m: MonsterInstance): Foe {
  const def = monsterById(m.id);
  const multi = m.powers.find((p) => p.id === 'multiattack');
  return {
    key: m.key, kin: def.kin, role: def.role, about: def.about, attack: m.attack, damage: m.damage, damageFactor: m.damageFactor,
    attacks: multi?.id === 'multiattack' ? multi.attacks : 1,
  };
}

/** What a fight Room holds: a group, a Mini-boss, the Boss, or the Twin Wardens (a Duo's, behind a Twin door). */
export type FightKind = 'fight' | 'miniboss' | 'boss' | 'twin';

/** The Twin Wardens wake again for a Hero a week after it beat them (v0). */
export const WARDENS_MS = 7 * DAY_MS;

/** The monsters waiting for one Hero in a Room: personal, and the same group all day. */
export function monstersFor(season: Season, hero: Pick<Hero, 'id'>, floor: Floor, roomId: number, kind: FightKind, now: Date) {
  const spawnSeed = `${season.seed}:${hero.id}:${floor.number}:${roomId}:${Math.floor(now.getTime() / DAY_MS)}`;
  return { spawnSeed, monsters: spawnEncounter(createRng(spawnSeed), floor.number, kind, weakeningAt(weakeningFrom(season), now), monsterOmen(season, now)) };
}

/** The Bond rings two Heroes join: pairs of which each wears a half. */
export function joinedBonds(mine: Pick<Item, 'place' | 'bond'>[], theirs: Pick<Item, 'place' | 'bond'>[]): Set<string> {
  const worn = (items: Pick<Item, 'place' | 'bond'>[]) => new Set(items.filter((i) => i.place === 'WORN' && i.bond).map((i) => i.bond!));
  const other = worn(theirs);
  return new Set([...worn(mine)].filter((bond) => other.has(bond)));
}

/** The Hero as it fights: its row, with its worn gear. Beside its Duo partner, a joined Bond ring counts its Bonus stats twice. */
export function combatOf(hero: HeroWithItems, partner: HeroWithItems | null = null): HeroCombat {
  const joined = partner ? joinedBonds(hero.items, partner.items) : new Set<string>();
  const worn = hero.items.filter((i) => i.place === 'WORN').map((i) => ({
    base: i.base, slot: i.slot, quality: i.quality, upgrade: i.upgrade, radiant: i.radiant,
    bonusStats: i.bonusStats as { stat: string; value: number }[], uniqueId: i.uniqueId, joined: i.bond !== null && joined.has(i.bond),
  }));
  return heroCombat({
    name: hero.name, class: hero.class as ClassId, race: hero.race as RaceId, level: hero.level,
    talents: hero.talents as TalentId[], path: hero.path as PathId | null,
    scores: { str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha },
    maxHp: hero.maxHp, hp: hero.hp, worn,
  });
}

/** Everything a fight needs from the Hero apart from the dice: also used to rate the Threat. */
export function fightInput(hero: HeroWithItems, combat: HeroCombat, monsters: MonsterInstance[], opts: {
  stance?: StanceId;
  surprise?: 'hero' | 'monsters' | null;
  /** The Floor a Fire bomb is thrown on; null for none. */
  bombFloor?: number | null;
  /** Added to Escape rolls: the day's Omen. */
  escapeBonus?: number;
  /** The Player was shown the fight as Trivial. */
  spare?: boolean;
} = {}): FightInput {
  const potions = hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion').reduce((s, i) => s + i.quantity, 0);
  return {
    hero: combat,
    monsters,
    uses: { spells: hero.spellUses, heals: hero.healUses },
    potions,
    runPowers: { deathless: hero.deathless, lucky: hero.lucky },
    stance: opts.stance ?? (hero.stance as StanceId),
    surprise: opts.surprise ?? null,
    bomb: opts.bombFloor ? fireBomb(opts.bombFloor) : null,
    gold: hero.carriedGold,
    escapeBonus: opts.escapeBonus ?? 0,
    spare: opts.spare ?? false,
  };
}

/** A Hero as the fight scene draws it, under `key` ('hero' for the one watching, 'ally' for its Duo partner). */
export function heroCombatant(key: 'hero' | 'ally', hero: HeroWithItems, combat: HeroCombat): Combatant {
  return {
    key, name: { en: hero.name, ru: hero.name }, art: portraitUrlOf(hero), hp: combat.hp, maxHp: combat.maxHp, ac: combat.ac,
    boss: false, banner: hero.banner, elite: null, powers: [], strike: weaponStrike(combat.weapon?.base), kin: null, class: hero.class as ClassId,
  };
}

export interface Fought {
  seed: string;
  events: FightEvent[];
  xp: number;
  defeated: string[];
}

/**
 * Pays one Hero out after a fight, from its own side of it: potions drunk, gold a
 * thief ran off with, death and its Grave, XP and health, then on a win the Room,
 * the Bad-luck meter, gold, drops, bounties, the Hunt and Deeds. `key` is which side
 * of the fight it was on; the Hero alone always keeps its dice of old.
 */
export async function settle(tx: Tx, hero: HeroWithItems, key: 'hero' | 'ally', side: SideResult, fought: Fought, monsters: MonsterInstance[],
  season: Season, floor: Floor, roomId: number, kind: FightKind, out: Outcome,
  opts: { bonusDrops?: number; clears?: boolean; threat?: ThreatId | null; share?: number; pool?: Drop[] }) {
  const now = gameNow();
  const omen = omenOf(season, now);
  const suffix = key === 'hero' ? '' : `:${key}`;
  // Potions drunk come out of the Bag.
  let drink = side.potionsUsed;
  for (const stack of hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion')) {
    if (drink <= 0) break;
    const used = Math.min(drink, stack.quantity);
    drink -= used;
    if (used === stack.quantity) {
      await tx.item.delete({ where: { id: stack.id } });
      hero.items.splice(hero.items.indexOf(stack), 1);
    } else {
      await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity - used } });
      stack.quantity -= used;
    }
  }

  if (kind === 'boss') await feed(tx, season, hero, 'boss-attempt', { outcome: side.outcome });

  // A cutpurse that got away took its gold for good.
  if (side.goldStolen > 0) {
    hero.carriedGold = Math.max(0, hero.carriedGold - side.goldStolen);
    await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: hero.carriedGold } });
    out.notices.push(t(`A thief got away with ${side.goldStolen} of your gold.`, `Вор ушёл с вашим золотом: ${side.goldStolen}.`));
  }

  // A Companion (solo) takes no XP, gold or loot of its own: its level is its Hero's (companion.ts).
  const companion = isCompanion(hero);
  if (side.outcome === 'dead') {
    // A Companion falls its own way: back in the morning, or in Iron mode for good.
    if (companion) await companionFalls(tx, hero, season, floor.number, roomId, out);
    // Nobody can Sneak past the Boss, so a Grave in its lair could never be reached: it lies on the doorstep.
    else await die(tx, hero, season, floor.number, kind === 'boss' ? (hero.prevRoom ?? floor.landing) : roomId, out);
    return;
  }

  const rng = createRng(`${fought.seed}:after${suffix}`);
  // A Duo splits what its fight pays: each Hero takes a share (DUO.share) of the XP and gold.
  const share = opts.share ?? 1;
  const xp = companion ? 0 : await boostedXp(tx, hero, season, Math.round(fought.xp * share * (omen?.xp ?? 1)));
  const levelUp = gainXp(hero, xp);
  out.xp += xp;
  out.levelUp = levelUp.newLevel ?? out.levelUp;
  const after = {
    hp: side.hp,
    spellUses: side.uses.spells,
    healUses: side.uses.heals,
    deathless: side.runPowers.deathless,
    lucky: side.runPowers.lucky,
    facing: false,
    ...levelUp.data,
    ...(side.outcome === 'victory' ? { prevRoom: roomId } : fallBack(hero, floor, now)),
  };
  await tx.hero.update({ where: { id: hero.id }, data: after });
  Object.assign(hero, after);
  // Going down and living through it is a Deed's worth; a natural 20 that stands the Hero up, another.
  const mine = (e: FightEvent) => ('actor' in e && e.actor ? e.actor : 'hero') === key;
  if (!companion && fought.events.some((e) => e.type === 'down' && mine(e))) {
    await countDeeds(tx, hero, { saved: 1, rose: fought.events.some((e) => e.type === 'rise' && mine(e)) ? 1 : 0 }, out);
  }
  // So is standing a fallen partner back up.
  if (!companion) await countDeeds(tx, hero, { raised: partnerRaises(fought.events, key) }, out);

  if (side.outcome === 'survived') {
    out.notices.push(t('Barely alive, you crawl back to the last safe Room.', 'Едва живы, вы отползаете в последнюю безопасную комнату.'));
    return;
  }
  if (side.outcome === 'escaped') {
    out.notices.push(t('You break away and run back to the last safe Room.', 'Вы вырываетесь и бежите в последнюю безопасную комнату.'));
    return;
  }

  // The Boss pays out on its own terms (boss.ts).
  if (kind === 'boss') return;

  // Victory: the Room stays clear for a day (the Twin Wardens, a week), the Bad-luck meter ticks, and there is loot.
  if (kind === 'fight' || kind === 'twin') {
    if (opts.clears !== false) await markCleared(tx, await heroFloor(tx, hero.id, floor.number), roomId, now);
  } else {
    await tx.specialClaim.upsert({
      where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } },
      create: { seasonId: season.id, floor: floor.number, room: roomId, heroId: hero.id },
      update: { heroId: hero.id, claimedAt: now },
    });
  }
  if (companion) {
    // Nothing is a Companion's to find but its part of the Wardens' hoard, which goes into the Duo Chest.
    if (opts.pool) {
      const elites = monsters.filter((m) => fought.defeated.includes(m.key) && m.elite !== null).length;
      for (let i = 0; i < LOOT.minibossItems + elites; i++) {
        opts.pool.push(await rollDrop(tx, hero, season, { floor: floor.number, source: kind, odds: dropOdds(Math.min(10, floor.number + 2)) }));
      }
    }
    return;
  }
  await addBadLuck(tx, hero, kind === 'fight' ? BAD_LUCK_PER_FIGHT : BAD_LUCK_PER_MINIBOSS);
  // Gold from every monster that fell (a thief that ran pays nothing); Gilded elites pay triple.
  const fallen = monsters.filter((m) => fought.defeated.includes(m.key));
  const baseGold = fallen.reduce((s, m) => s + createRng(`${fought.seed}:gold${suffix}:${m.key}`).int(1, 4) * (floor.number + 1) * (m.elite === 'gilded' ? GILDED_GOLD : 1), 0)
    * (kind === 'fight' ? 1 : 10);
  const gold = withGoldFind(hero, Math.round(baseGold * share * (omen?.gold ?? 1)));
  out.gold += gold;
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
  hero.carriedGold += gold;
  // Every elite that fell drops one more Item.
  const elites = fallen.filter((m) => m.elite !== null).length;
  const drops = (kind === 'fight' ? (rng.chance(LOOT.fightDrop) ? 1 : 0) : LOOT.minibossItems) + elites + (opts.bonusDrops ?? 0);
  // The Twin Wardens' hoard has the odds of two Floors deeper (their Bond rings come apart: twins.ts).
  const odds = kind === 'twin' ? { odds: dropOdds(Math.min(10, floor.number + 2)) } : {};
  // Items for a Duo Chest are rolled with this Hero's luck and split later (trust.ts).
  if (opts.pool) for (let i = 0; i < drops; i++) opts.pool.push(await rollDrop(tx, hero, season, { floor: floor.number, source: kind, ...odds }));
  else if (drops > 0) await dropGear(tx, hero, season, { floor: floor.number, count: drops, source: kind, ...odds }, out);
  if (kind === 'fight' && rng.chance(LOOT.fightKey)) await dropStack(tx, hero, season, 'key-iron', 1, out);
  if (kind === 'miniboss' && rng.chance(LOOT.minibossChest)) await dropChest(tx, hero, season, floor.number, out);
  if (kind === 'miniboss' && floor.number >= DEEP_FLOOR && rng.chance(RELIC_CHANCE.deepMiniboss)) {
    await grantRelic(tx, hero, season, floor.number, 'miniboss', out);
  }
  const kins = fallen.map((m) => monsterById(m.id).kin);
  await trackBounties(tx, hero, {
    type: 'fight-won', floor: floor.number, kins, elites, threat: opts.threat ?? null, miniboss: kind === 'miniboss',
  }, out);
  await trackHunt(tx, season, hero, kins, out, now);
  const kills: DeedCounts = {};
  for (const kin of kins) {
    const metric = KILL_METRIC[kin];
    if (metric) kills[metric] = (kills[metric] ?? 0) + 1;
  }
  await countDeeds(tx, hero, {
    ...kills, minibosses: kind === 'miniboss' ? 1 : 0, twins: kind === 'twin' ? 1 : 0, elites, deadly: opts.threat === 'deadly' ? 1 : 0,
  }, out);
}

/**
 * Fights what waits in a Room (or the given monsters, e.g. a mimic), then pays out:
 * XP, gold, the Bad-luck meter and drops on a win; a Grave on a death.
 */
export async function fight(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, roomId: number, kind: FightKind, out: Outcome, opts: {
  monsters?: MonsterInstance[];
  /** Extra Items on a win, on top of the usual drops. */
  bonusDrops?: number;
  /** Whether winning clears the Room (Event rooms track themselves). */
  clears?: boolean;
  /** A failed Sneak: the monsters act first. */
  surprise?: 'hero' | 'monsters';
  /** A Fire bomb goes off before the first round (the caller has taken it from the Bag). */
  bomb?: boolean;
  /** The Threat the Player saw before choosing to fight: for bounties, and a Trivial fight never kills. */
  threat?: ThreatId | null;
} = {}): Promise<'victory' | 'survived' | 'escaped' | 'dead'> {
  const now = gameNow();
  const spawned = opts.monsters ? null : monstersFor(season, hero, floor, roomId, kind, now);
  const monsters = opts.monsters ?? spawned!.monsters;
  const spawnSeed = spawned?.spawnSeed ?? null;

  const combat = combatOf(hero);
  const seed = newSeed();
  const omen = omenOf(season, now);
  const input = fightInput(hero, combat, monsters, {
    surprise: opts.surprise, bombFloor: opts.bomb ? floor.number : null, escapeBonus: omen?.sneak ?? 0, spare: opts.threat === 'trivial',
  });
  const result = simulateFight(createRng(seed), input);
  await tx.rollLog.create({
    data: {
      playerId: hero.playerId, kind: 'fight', seed,
      detail: { floor: floor.number, room: roomId, kind, outcome: result.outcome, spawnSeed, stance: input.stance, surprise: input.surprise, bomb: Boolean(opts.bomb) },
    },
  });

  out.fight = fightReplaySchema.parse({
    map: floor.rooms[roomId]!.map,
    hero: heroCombatant('hero', hero, combat),
    monsters: monsters.map((m) => combatant(m.key, m)),
    events: result.events,
    outcome: result.outcome,
  });
  await settle(tx, hero, 'hero', result, { seed, events: result.events, xp: result.xp, defeated: result.defeated }, monsters, season, floor, roomId, kind, out, opts);
  return result.outcome;
}

/**
 * Who waits for a Duo in a Room: one group for the pair, the same all day, tougher than either
 * would meet alone. The Twin Wardens are a Duo's own, and need no toughening.
 */
export function duoMonstersFor(season: Season, a: Pick<Hero, 'id'>, b: Pick<Hero, 'id'>, floor: Floor, roomId: number, kind: 'fight' | 'miniboss' | 'twin', now: Date) {
  const pair = [a.id, b.id].sort().join(':');
  const spawnSeed = `${season.seed}:duo:${pair}:${floor.number}:${roomId}:${Math.floor(now.getTime() / DAY_MS)}`;
  const rng = createRng(spawnSeed);
  const monsters = kind === 'twin'
    ? spawnEncounter(rng, floor.number, 'twin', 0, monsterOmen(season, now))
    : duoEncounter(rng, floor.number, kind, weakeningAt(weakeningFrom(season), now), monsterOmen(season, now));
  return { spawnSeed, monsters };
}

/** A Duo's fight input: the one acting as the Hero, its partner alongside. */
export function duoInput(hero: HeroWithItems, partner: HeroWithItems, monsters: MonsterInstance[], opts: {
  stance?: StanceId; surprise?: 'hero' | null; bombFloor?: number | null; escapeBonus?: number;
} = {}): FightInput {
  const potions = partner.items.filter((i) => i.place === 'BAG' && i.base === 'potion').reduce((s, i) => s + i.quantity, 0);
  return {
    ...fightInput(hero, combatOf(hero, partner), monsters, opts),
    ally: {
      hero: combatOf(partner, hero), uses: { spells: partner.spellUses, heals: partner.healUses }, potions,
      runPowers: { deathless: partner.deathless, lucky: partner.lucky }, stance: partner.stance as StanceId, gold: partner.carriedGold,
      // A Companion follows its Hero out of a fight (companion.ts): the Duo may retreat mid-fight.
      follows: isCompanion(partner),
    },
  };
}

/**
 * Death: everything carried goes into a Grave here; the Hero wakes at the Temple with a
 * Starter kit. In Iron mode (solo, docs/plan-solo-offline.md, decision 6) a Hero lives
 * once: it falls for good, and the next Hero keeps the City's gold and Storage.
 */
export async function die(tx: Tx, hero: HeroWithItems, season: Season, floorNumber: number, roomId: number, out: Outcome): Promise<void> {
  const grave = await tx.grave.create({
    data: {
      seasonId: season.id, floor: floorNumber, room: roomId, heroId: hero.id, ownerName: hero.name,
      gold: hero.carriedGold, expiresAt: new Date(gameNowMs() + GRAVE_MS),
    },
  });
  await tx.item.updateMany({
    where: { heroId: hero.id, place: { in: ['WORN', 'BAG'] } },
    data: { place: 'GRAVE', heroId: null, slot: null, graveId: grave.id },
  });
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  const updated = await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, hp: hero.maxHp, carriedGold: 0,
      spellUses: uses.spells, healUses: uses.heals, deathless: true, lucky: true, campSince: null, facing: false,
    },
  });
  out.died = true;
  out.runEnd = { gold: hero.carriedGold };
  await feed(tx, season, hero, 'death', { floor: floorNumber, grave: grave.id });
  if (worldSettings().iron) {
    // Its Companion leaves too: what it wore goes to Storage, for the next Hero.
    await releaseCompanion(tx, hero);
    // Fallen: retired with no health left, which is how the Heroes it leaves behind tell it from a Retire.
    await tx.hero.update({ where: { id: hero.id }, data: { retiredAt: gameNow(), hp: 0, partnerId: null } });
    await tx.hero.updateMany({ where: { partnerId: hero.id }, data: { partnerId: null } });
    out.notices.push(t(
      `You died, and in Iron mode a Hero lives once: ${hero.name}'s story ends here. What you carried lies in a Grave for two nights. Make a new Hero in the City, where your gold and Storage wait.`,
      `Вы погибли, а в железном режиме герой живёт один раз: история ${hero.name} окончена. Всё, что было при вас, две ночи лежит в могиле. Создайте нового героя в городе: там ждут ваше золото и хранилище.`,
    ));
    return;
  }
  await giveStarterKit(tx, updated, season.id);
  out.notices.push(t(
    'You died. Everything you carried lies in a Grave for two nights. You wake at the Temple with a Starter kit.',
    'Вы погибли. Всё, что было при вас, две ночи лежит в могиле. Вы очнулись в храме с начальным снаряжением.',
  ));
}
