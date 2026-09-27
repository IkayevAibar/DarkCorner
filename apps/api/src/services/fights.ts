import type { Hero, HeroFloor, Season } from '@prisma/client';
import { type Combatant, type FightReplay, type ItemView, type LocalizedText, fightReplaySchema } from '@dark/shared';
import {
  BAD_LUCK_PER_FIGHT, BAD_LUCK_PER_MINIBOSS, type ClassId, DEEP_FLOOR, type FightInput, type Floor, GILDED_GOLD, type HeroCombat, LOOT, type MonsterInstance,
  type PathId, RELIC_CHANCE, type RaceId, type StanceId, type TalentId, weakeningAt,
  createRng, fireBomb, heroCombat, monsterById, restUses, simulateFight, spawnEncounter,
} from '@dark/engine';
import { newSeed } from '../lib/seed.js';
import { feed } from './feed.js';
import { giveStarterKit, portraitUrlOf } from './heroes.js';
import type { HeroWithItems, Tx } from './ledger.js';
import { addBadLuck, dropChest, dropGear, dropStack, withGoldFind } from './loot.js';
import { boostedXp, gainXp } from './progression.js';
import { grantRelic } from './relics.js';

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
}

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
  fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false, notices: [], checks: [], duel: null,
});

// ─── What one Hero knows of a Floor ───────────────────────────────────────

export async function heroFloor(tx: Tx, heroId: string, floor: number): Promise<HeroFloor> {
  return tx.heroFloor.upsert({ where: { heroId_floor: { heroId, floor } }, create: { heroId, floor }, update: {} });
}

const clearedAt = (hf: HeroFloor | null, room: number): Date | null => {
  const iso = (hf?.cleared as Record<string, string> | undefined)?.[String(room)];
  return iso ? new Date(iso) : null;
};

/** A Room this Hero cleared in the last 24 hours stays clear for it. */
export const isCleared = (hf: HeroFloor | null, room: number, now: Date): boolean => {
  const at = clearedAt(hf, room);
  return at !== null && now.getTime() - at.getTime() < DAY_MS;
};

export async function markCleared(tx: Tx, hf: HeroFloor, room: number, now: Date): Promise<void> {
  const fresh = await tx.heroFloor.findUniqueOrThrow({ where: { id: hf.id } });
  const cleared = { ...(fresh.cleared as Record<string, string>), [String(room)]: now.toISOString() };
  await tx.heroFloor.update({ where: { id: hf.id }, data: { cleared } });
}

// ─── Fights ───────────────────────────────────────────────────────────────

export function combatant(key: string, m: MonsterInstance): Combatant {
  const def = monsterById(m.id);
  return {
    key, name: def.name, art: def.art, hp: m.hp, maxHp: m.maxHp, ac: m.ac, boss: def.role === 'boss' || def.role === 'miniboss', banner: null,
    elite: m.elite, powers: m.powers.map((p) => p.id),
  };
}

export type FightKind = 'fight' | 'miniboss' | 'boss';

/** The monsters waiting for one Hero in a Room: personal, and the same group all day. */
export function monstersFor(season: Season, hero: Pick<Hero, 'id'>, floor: Floor, roomId: number, kind: FightKind, now: Date) {
  const spawnSeed = `${season.seed}:${hero.id}:${floor.number}:${roomId}:${Math.floor(now.getTime() / DAY_MS)}`;
  return { spawnSeed, monsters: spawnEncounter(createRng(spawnSeed), floor.number, kind, weakeningAt(season.startsAt, now)) };
}

/** The Hero as it fights: its row, with its worn gear. */
export function combatOf(hero: HeroWithItems): HeroCombat {
  const worn = hero.items.filter((i) => i.place === 'WORN').map((i) => ({
    base: i.base, quality: i.quality, upgrade: i.upgrade, radiant: i.radiant,
    bonusStats: i.bonusStats as { stat: string; value: number }[], uniqueId: i.uniqueId,
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
  };
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
} = {}): Promise<'victory' | 'survived' | 'escaped' | 'dead'> {
  const now = new Date();
  const spawned = opts.monsters ? null : monstersFor(season, hero, floor, roomId, kind, now);
  const monsters = opts.monsters ?? spawned!.monsters;
  const spawnSeed = spawned?.spawnSeed ?? null;

  const combat = combatOf(hero);
  const potionStacks = hero.items.filter((i) => i.place === 'BAG' && i.base === 'potion');
  const seed = newSeed();
  const input = fightInput(hero, combat, monsters, { surprise: opts.surprise, bombFloor: opts.bomb ? floor.number : null });
  const result = simulateFight(createRng(seed), input);
  await tx.rollLog.create({
    data: {
      playerId: hero.playerId, kind: 'fight', seed,
      detail: { floor: floor.number, room: roomId, kind, outcome: result.outcome, spawnSeed, stance: input.stance, surprise: input.surprise, bomb: Boolean(opts.bomb) },
    },
  });

  out.fight = fightReplaySchema.parse({
    map: floor.rooms[roomId]!.map,
    hero: {
      key: 'hero', name: { en: hero.name, ru: hero.name }, art: portraitUrlOf(hero), hp: combat.hp, maxHp: combat.maxHp, ac: combat.ac,
      boss: false, banner: hero.banner, elite: null, powers: [],
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
    if (used === stack.quantity) {
      await tx.item.delete({ where: { id: stack.id } });
      hero.items.splice(hero.items.indexOf(stack), 1);
    } else {
      await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity - used } });
      stack.quantity -= used;
    }
  }

  if (kind === 'boss') await feed(tx, season, hero, 'boss-attempt', { outcome: result.outcome });

  // A cutpurse that got away took its gold for good.
  if (result.goldStolen > 0) {
    hero.carriedGold = Math.max(0, hero.carriedGold - result.goldStolen);
    await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: hero.carriedGold } });
    out.notices.push(t(`A thief got away with ${result.goldStolen} of your gold.`, `Вор ушёл с вашим золотом: ${result.goldStolen}.`));
  }

  if (result.outcome === 'dead') {
    await die(tx, hero, season, floor.number, roomId, out);
    return 'dead';
  }

  const rng = createRng(`${seed}:after`);
  const xp = await boostedXp(tx, hero, season, result.xp);
  const levelUp = gainXp(rng, { ...hero, hp: result.hp }, xp);
  out.xp += xp;
  out.levelUp = levelUp.newLevel ?? out.levelUp;
  const after = {
    hp: result.hp,
    spellUses: result.uses.spells,
    healUses: result.uses.heals,
    deathless: result.runPowers.deathless,
    lucky: result.runPowers.lucky,
    facing: false,
    ...levelUp.data,
    ...(result.outcome === 'victory' ? { prevRoom: roomId } : { room: hero.prevRoom ?? floor.landing }),
  };
  await tx.hero.update({ where: { id: hero.id }, data: after });
  Object.assign(hero, after);

  if (result.outcome === 'survived') {
    out.notices.push(t('Barely alive, you crawl back to the last safe Room.', 'Едва живы, вы отползаете в последнюю безопасную комнату.'));
    return 'survived';
  }
  if (result.outcome === 'escaped') {
    out.notices.push(t('You break away and run back to the last safe Room.', 'Вы вырываетесь и бежите в последнюю безопасную комнату.'));
    return 'escaped';
  }

  // The Boss pays out on its own terms (boss.ts).
  if (kind === 'boss') return 'victory';

  // Victory: the Room stays clear for a day, the Bad-luck meter ticks, and there is loot.
  if (kind === 'fight') {
    if (opts.clears !== false) await markCleared(tx, await heroFloor(tx, hero.id, floor.number), roomId, now);
  } else {
    await tx.specialClaim.upsert({
      where: { seasonId_floor_room: { seasonId: season.id, floor: floor.number, room: roomId } },
      create: { seasonId: season.id, floor: floor.number, room: roomId, heroId: hero.id },
      update: { heroId: hero.id, claimedAt: now },
    });
  }
  await addBadLuck(tx, hero, kind === 'fight' ? BAD_LUCK_PER_FIGHT : BAD_LUCK_PER_MINIBOSS);
  // Gold from every monster that fell (a thief that ran pays nothing); Gilded elites pay triple.
  const fallen = monsters.filter((m) => result.defeated.includes(m.key));
  const baseGold = fallen.reduce((s, m) => s + createRng(`${seed}:gold:${m.key}`).int(1, 4) * (floor.number + 1) * (m.elite === 'gilded' ? GILDED_GOLD : 1), 0)
    * (kind === 'fight' ? 1 : 10);
  const gold = withGoldFind(hero, baseGold);
  out.gold += gold;
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
  hero.carriedGold += gold;
  // Every elite that fell drops one more Item.
  const elites = fallen.filter((m) => m.elite !== null).length;
  const drops = (kind === 'fight' ? (rng.chance(LOOT.fightDrop) ? 1 : 0) : LOOT.minibossItems) + elites + (opts.bonusDrops ?? 0);
  if (drops > 0) await dropGear(tx, hero, season, { floor: floor.number, count: drops, source: kind }, out);
  if (kind === 'fight' && rng.chance(LOOT.fightKey)) await dropStack(tx, hero, season, 'key-iron', 1, out);
  if (kind === 'miniboss' && rng.chance(LOOT.minibossChest)) await dropChest(tx, hero, season, floor.number, out);
  if (kind === 'miniboss' && floor.number >= DEEP_FLOOR && rng.chance(RELIC_CHANCE.deepMiniboss)) {
    await grantRelic(tx, hero, season, floor.number, 'miniboss', out);
  }
  return 'victory';
}

/** Death: everything carried goes into a Grave here; the Hero wakes at the Temple with a Starter kit. */
export async function die(tx: Tx, hero: HeroWithItems, season: Season, floorNumber: number, roomId: number, out: Outcome): Promise<void> {
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
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  const updated = await tx.hero.update({
    where: { id: hero.id },
    data: {
      location: 'CITY', floor: null, room: null, prevRoom: null, hp: hero.maxHp, carriedGold: 0,
      spellUses: uses.spells, healUses: uses.heals, deathless: true, lucky: true, campSince: null, facing: false,
    },
  });
  await giveStarterKit(tx, updated, season.id);
  out.died = true;
  await feed(tx, season, hero, 'death', { floor: floorNumber, grave: grave.id });
  out.notices.push(t(
    'You died. Everything you carried lies in a Grave for 48 hours. You wake at the Temple with a Starter kit.',
    'Вы погибли. Всё, что было при вас, лежит в могиле 48 часов. Вы очнулись в храме с начальным снаряжением.',
  ));
}
