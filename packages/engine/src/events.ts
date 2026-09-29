import { type CheckResult, check } from './check.js';
import { rollDice, sum } from './dice.js';
import { BLESSING_IDS, type BlessingId, type ChestGrade, rollChestGrade, usableBases } from './economy.js';
import type { ClassId } from './content/classes.js';
import { type Tier, TIERS, tierRank } from './content/loot.js';
import { RIDDLES } from './content/riddles.js';
import { type GearRoll, dropOdds, rollExtraBonusStat, rollGear, rollTier } from './items.js';
import type { Rng } from './rng.js';

// Event rooms (docs/design.md → Event rooms). All numbers are v0. Each function
// is a pure roll; the API decides what the Hero may do and stores the result.

export interface CheckOptions {
  modifier: number;
  advantage: boolean;
  rerollOnes: boolean;
}

const roll = (rng: Rng, dc: number, o: CheckOptions): CheckResult =>
  check(rng, { modifier: o.modifier, dc, edge: o.advantage ? 'advantage' : 'normal', rerollOnes: o.rerollOnes });

// ─── Three chests ─────────────────────────────────────────────────────────

export type ChestContent = { kind: 'item'; tier: Tier } | { kind: 'gold'; amount: number } | { kind: 'mimic' };

/** Chance that one of the two Item chests is a mimic instead. */
export const MIMIC_CHANCE = 0.3;

/** Three closed chests: one with gold, two with an Item each, and maybe a mimic among them. */
export function threeChests(rng: Rng, floor: number): ChestContent[] {
  const chests: ChestContent[] = [
    { kind: 'gold', amount: rng.int(10, 30) * (floor + 1) },
    { kind: 'item', tier: rollTier(rng, dropOdds(Math.min(10, floor + 3))) },
    { kind: 'item', tier: rollTier(rng, dropOdds(floor)) },
  ];
  if (rng.chance(MIMIC_CHANCE)) chests[2] = { kind: 'mimic' };
  for (let i = chests.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [chests[i], chests[j]] = [chests[j]!, chests[i]!];
  }
  return chests;
}

// ─── Shrine ───────────────────────────────────────────────────────────────

export const SHRINE_DC = 12;
/** A curse burns this share of max health (never below 1). */
export const SHRINE_CURSE_HP = 0.25;

/**
 * Praying: a WIS Check. Success grants a random Blessing; failing by 5 or more
 * (or a natural 1) brings a curse, unless the Hero senses it coming (Wizards).
 */
export function prayAtShrine(rng: Rng, o: CheckOptions & { sensesCurses: boolean }): {
  check: CheckResult; outcome: 'blessing' | 'nothing' | 'curse' | 'sensed'; blessing: BlessingId | null;
} {
  const result = roll(rng, SHRINE_DC, o);
  if (result.success) return { check: result, outcome: 'blessing', blessing: rng.pick(BLESSING_IDS) };
  const cursed = result.fumble || result.total <= SHRINE_DC - 5;
  if (!cursed) return { check: result, outcome: 'nothing', blessing: null };
  return { check: result, outcome: o.sensesCurses ? 'sensed' : 'curse', blessing: null };
}

// ─── Goblin gambler ───────────────────────────────────────────────────────

/** Both roll a d20; the Hero must beat the goblin (ties go to the house). */
export function goblinDice(rng: Rng, rerollOnes: boolean): { hero: number; goblin: number; win: boolean } {
  let hero = rng.int(1, 20);
  if (hero === 1 && rerollOnes) hero = rng.int(1, 20);
  const goblin = rng.int(1, 20);
  return { hero, goblin, win: hero > goblin };
}

/** Betting an Item wins one a Tier higher. Mythics and Relics have nowhere higher to go. */
export function nextTier(tier: Tier): Tier | null {
  if (tierRank(tier) >= tierRank('mythic')) return null;
  return TIERS[tierRank(tier) + 1]!;
}

// ─── Wandering merchant ───────────────────────────────────────────────────

export const MERCHANT_MARKUP = 6;
/** The merchant pays this many times the Buyback price. */
export const MERCHANT_BUYS_AT = 2;

/** Three rare wares, identified, mostly usable by the Hero's Class. */
export function merchantWares(rng: Rng, opts: { floor: number; classId: ClassId }): GearRoll[] {
  const usable = usableBases(opts.classId);
  const odds: [Tier, number][] = [['rare', 60], ['epic', 35], ['legendary', 5]];
  return [0, 1, 2].map(() => {
    const tier = rollTier(rng, odds);
    const baseId = tier === 'legendary' ? undefined : rng.pick(usable).id;
    return rollGear(rng, { tier, itemLevel: Math.max(1, opts.floor), baseId, identified: true });
  });
}

// ─── Trapped corridor ─────────────────────────────────────────────────────

export const trapDc = (floor: number): number => 11 + Math.ceil(floor / 2);

/** A DEX Check to get through unhurt. Rogues disarm it without a roll. */
export function springTrap(rng: Rng, o: CheckOptions & { floor: number; disarms: boolean }): {
  check: CheckResult | null; damage: number;
} {
  if (o.disarms) return { check: null, damage: 0 };
  const result = roll(rng, trapDc(o.floor), o);
  return { check: result, damage: result.success ? 0 : sum(rollDice(rng, 2, 6)) + o.floor };
}

// ─── Cursed altar ─────────────────────────────────────────────────────────

export const ALTAR_SUCCESS = 0.4;
/** Only these can go up a Tier at the altar: Epic and above would need a named unique. */
export const ALTAR_TIERS: Tier[] = ['common', 'uncommon', 'rare'];

/**
 * The offering: 40% the Item rises one Tier and gains a Bonus stat, 60% it is
 * destroyed. `stat` is the new Bonus stat, rolled at the new Tier.
 */
export function offerAtAltar(rng: Rng, item: Pick<GearRoll, 'tier' | 'itemLevel' | 'bonusStats'>): {
  success: boolean; tier: Tier; stat: GearRoll['bonusStats'][number] | null;
} {
  if (!ALTAR_TIERS.includes(item.tier)) throw new Error(`the altar refuses ${item.tier} Items`);
  if (!rng.chance(ALTAR_SUCCESS)) return { success: false, tier: item.tier, stat: null };
  const tier = nextTier(item.tier)!;
  const stat = rollExtraBonusStat(rng, tier, item.itemLevel, item.bonusStats.map((b) => b.stat));
  return { success: true, tier, stat };
}

// ─── Locked cache ─────────────────────────────────────────────────────────

/** Two Items with the odds of three Floors deeper, plus gold. */
export function cacheContents(rng: Rng, floor: number, magicFind: number): { tiers: Tier[]; gold: number } {
  const odds = dropOdds(Math.min(10, floor + 3));
  return { tiers: [rollTier(rng, odds, magicFind), rollTier(rng, odds, magicFind)], gold: rng.int(20, 50) * (floor + 1) };
}

// ─── Lockpicking ──────────────────────────────────────────────────────────

/** Until the minigame lands, picking the lock is a DEX Check (Rogues with advantage). */
export const LOCKPICK_DC = 14;

export function pickLock(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; chest: ChestGrade | null } {
  const result = roll(rng, LOCKPICK_DC, o);
  return { check: result, chest: result.success ? rollChestGrade(rng, Math.min(10, o.floor + 3)) : null };
}

// ─── Fountain ─────────────────────────────────────────────────────────────

export type FountainOutcome = 'foul' | 'clean' | 'glowing' | 'spirit';

/**
 * Drinking: a plain d20 shown on screen. 1–4 foul (a fifth of full health
 * lost), 5–12 clean (half of it back), 13–19 glowing (all of it, and rest uses),
 * 20 a spirit (all of it, and a Blessing).
 */
export function drinkFountain(rng: Rng, o: Pick<CheckOptions, 'rerollOnes'>): { check: CheckResult; outcome: FountainOutcome } {
  const result = check(rng, { modifier: 0, dc: 5, rerollOnes: o.rerollOnes });
  const n = result.roll.natural;
  const outcome: FountainOutcome = n <= 4 ? 'foul' : n <= 12 ? 'clean' : n <= 19 ? 'glowing' : 'spirit';
  return { check: result, outcome };
}

// ─── Prisoner ─────────────────────────────────────────────────────────────

/** How often the chained figure is a doppelganger instead (v0). */
export const PRISONER_TRAP = 0.2;

/** Freeing the prisoner: thanks (an Item with the odds of two Floors deeper, and gold), or a doppelganger. */
export function freePrisoner(rng: Rng, floor: number): { trap: boolean; tier: Tier | null; gold: number } {
  if (rng.chance(PRISONER_TRAP)) return { trap: true, tier: null, gold: 0 };
  return { trap: false, tier: rollTier(rng, dropOdds(Math.min(10, floor + 2))), gold: rng.int(10, 30) * (floor + 1) };
}

// ─── Library ──────────────────────────────────────────────────────────────

export const libraryDc = (floor: number): number => 11 + Math.ceil(floor / 2);

/**
 * Reading a tome: an INT Check. Success teaches (XP, 60 per Floor number);
 * failing by 5 or more, or a natural 1, the pages bite (a tenth of full health).
 */
export function readTome(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; xp: number; curse: boolean } {
  const result = roll(rng, libraryDc(o.floor), o);
  if (result.success) return { check: result, xp: 60 * o.floor, curse: false };
  return { check: result, xp: 0, curse: result.fumble || result.total <= libraryDc(o.floor) - 5 };
}

// ─── Bone pile ────────────────────────────────────────────────────────────

/** How often the bones rise when searched (v0). */
export const BONES_RISE = 0.35;

/** Searching: an old adventurer's gold and maybe an Item, or the bones rise and fight. */
export function searchBones(rng: Rng, floor: number): { rise: boolean; gold: number; tier: Tier | null } {
  const gold = rng.int(10, 40) * (floor + 1);
  const tier = rng.chance(0.5) ? rollTier(rng, dropOdds(floor)) : null;
  return { rise: rng.chance(BONES_RISE), gold, tier };
}


// ─── Goblin cookpot ───────────────────────────────────────────────────────

export const cookpotDc = (floor: number): number => 10 + Math.ceil(floor / 2);
/** Stamina a good bowl gives back (v0). */
export const COOKPOT_STAMINA = 3;

/** Tasting the stew: a CON Check. Success fills (a third of full health and some Stamina); failing, it was not meat. */
export function tasteStew(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; good: boolean } {
  const result = roll(rng, cookpotDc(o.floor), o);
  return { check: result, good: result.success };
}

// ─── Webbed body ──────────────────────────────────────────────────────────

export const webDc = (floor: number): number => 11 + Math.ceil(floor / 2);

/**
 * Cutting a cocooned body down: a DEX Check. Its purse, and half the time an Item
 * with the odds of a Floor deeper, either way; failing, the web's owner drops first.
 */
export function cutWeb(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; gold: number; tier: Tier | null } {
  const result = roll(rng, webDc(o.floor), o);
  return { check: result, gold: rng.int(10, 30) * (o.floor + 1), tier: rng.chance(0.5) ? rollTier(rng, dropOdds(Math.min(10, o.floor + 1))) : null };
}

// ─── Sarcophagus ──────────────────────────────────────────────────────────

export const sarcophagusDc = (floor: number): number => 11 + Math.ceil(floor / 2);

/**
 * Prying the lid: a STR Check. The grave goods either way: gold and an Item with the
 * odds of two Floors deeper; failing, the lid grinds loud enough to wake its Mummy first.
 */
export function pryLid(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; gold: number; tier: Tier } {
  const result = roll(rng, sarcophagusDc(o.floor), o);
  return { check: result, gold: rng.int(20, 50) * (o.floor + 1), tier: rollTier(rng, dropOdds(Math.min(10, o.floor + 2))) };
}

// ─── Devil's bargain ──────────────────────────────────────────────────────

/** Gold costs this share of full health (v0). */
export const BARGAIN_GOLD_PRICE = 0.2;
/** The devil only offers Items worth the blood, and asks more for better ones (v0). */
export const BARGAIN_ITEM_ODDS: [Tier, number][] = [['rare', 60], ['epic', 30], ['legendary', 9], ['mythic', 1]];
export const BARGAIN_ITEM_PRICE: Partial<Record<Tier, number>> = { rare: 0.25, epic: 0.35, legendary: 0.5, mythic: 0.6 };

/** Today's two offers, each for a share of full health: a purse of gold, or an Item of a Tier shown up front. */
export function devilOffers(rng: Rng, floor: number): { gold: number; goldPrice: number; tier: Tier; itemPrice: number } {
  const tier = rollTier(rng, BARGAIN_ITEM_ODDS);
  return { gold: rng.int(30, 60) * (floor + 1), goldPrice: BARGAIN_GOLD_PRICE, tier, itemPrice: BARGAIN_ITEM_PRICE[tier]! };
}

/** Health a share of full health costs; always at least 1. */
export const bloodPrice = (fullHealth: number, share: number): number => Math.max(1, Math.round(fullHealth * share));

export const banishDc = (floor: number): number => 12 + Math.ceil(floor / 2);
/** A banishment teaches this much XP per Floor number (v0). */
export const BANISH_XP = 60;

/** Banishing the devil instead: a WIS Check. Failing, it breaks the circle and fights. */
export function banishDevil(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; xp: number } {
  const result = roll(rng, banishDc(o.floor), o);
  return { check: result, xp: result.success ? BANISH_XP * o.floor : 0 };
}

// ─── Whispering skulls (the lair) ─────────────────────────────────────────

export const skullsDc = (floor: number): number => 11 + Math.ceil(floor / 2);
/** Listening well teaches this much XP per Floor number; badly, the screams burn this share of full health (v0). */
export const SKULLS_XP = 50;
export const SKULLS_SCREAM = 0.15;

/** Listening to those who came for the Dragon before: a WIS Check. Success shows the way to its chamber. */
export function listenToSkulls(rng: Rng, o: CheckOptions & { floor: number }): { check: CheckResult; xp: number } {
  const result = roll(rng, skullsDc(o.floor), o);
  return { check: result, xp: result.success ? SKULLS_XP * o.floor : 0 };
}

// ─── Spilled hoard (the lair) ─────────────────────────────────────────────

/** Handfuls a Hero may grab, and the chance the Dragon's kin notice after that many (v0). */
export const HOARD_HANDFULS = [1, 2, 3] as const;
export const HOARD_WAKE: Record<(typeof HOARD_HANDFULS)[number], number> = { 1: 0.2, 2: 0.45, 3: 0.7 };

/** Pushing one's luck: every handful is gold, and makes the kin likelier to notice. */
export function grabHoard(rng: Rng, floor: number, handfuls: (typeof HOARD_HANDFULS)[number]): { gold: number; noticed: boolean } {
  let gold = 0;
  for (let i = 0; i < handfuls; i++) gold += rng.int(30, 60) * (floor + 1);
  return { gold, noticed: rng.chance(HOARD_WAKE[handfuls]) };
}

// ─── Fallen champion (the lair) ───────────────────────────────────────────

/** The champion's gear is Epic or better; taking it wakes the champion's shade half the time (v0). */
export const CHAMPION_ODDS: [Tier, number][] = [['epic', 70], ['legendary', 25], ['mythic', 5]];
export const CHAMPION_SHADE = 0.5;

export function takeChampionGear(rng: Rng): { tier: Tier; shade: boolean } {
  return { tier: rollTier(rng, CHAMPION_ODDS), shade: rng.chance(CHAMPION_SHADE) };
}

// ─── Riddling statue ──────────────────────────────────────────────────────

/** A right answer teaches this much XP per Floor number; a wrong one burns this share of full health (v0). */
export const STATUE_XP = 50;
export const STATUE_GAZE = 0.15;

/**
 * Today's riddle for a Hero in a Room: which one, and three answers (its own and two
 * others') in a shuffled order. `right` is the place of the true answer.
 */
export function statueRiddle(rng: Rng): { riddle: number; answers: number[]; right: number } {
  const riddle = rng.int(0, RIDDLES.length - 1);
  const others = RIDDLES.map((_, i) => i).filter((i) => i !== riddle);
  const answers = [riddle];
  while (answers.length < 3) answers.push(others.splice(rng.int(0, others.length - 1), 1)[0]!);
  for (let i = answers.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [answers[i], answers[j]] = [answers[j]!, answers[i]!];
  }
  return { riddle, answers, right: answers.indexOf(riddle) };
}
