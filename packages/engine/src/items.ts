import { type GearBase, GEAR_BASES, baseById, isGear, isTwoHanded } from './content/bases.js';
import {
  BOND_STATS, BONUS_COUNT, BONUS_STATS, type BonusStatDef, type BonusStatId, BUYBACK_BASE, DROP_ODDS, IDENTIFIED_BELOW, RADIANT_BOOST, RADIANT_CHANCE,
  SUFFIXES, type Tier, tierRank, uniqueById, uniquesOfTier,
} from './content/loot.js';
import { type Text } from './content/text.js';
import type { Rng } from './rng.js';

/** Everything that makes one piece of gear itself. Stored as-is; views are built from it. */
export interface GearRoll {
  base: string;
  tier: Tier;
  itemLevel: number;
  /** 1–100: scales base damage or armor from 85% to 115%. */
  quality: number;
  bonusStats: { stat: BonusStatId; value: number }[];
  /** Index into SUFFIXES for Uncommon–Epic names; null for Commons and uniques. */
  suffix: number | null;
  /** Legendary, Mythic and Relic items are named uniques. */
  uniqueId: string | null;
  radiant: boolean;
  identified: boolean;
}

function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng.next() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

/** The Tier odds for Items dropping on `floor` (docs/design.md). */
export function dropOdds(floor: number): [Tier, number][] {
  const band = DROP_ODDS.find((b) => floor >= b.floors[0] && floor <= b.floors[1]) ?? DROP_ODDS[DROP_ODDS.length - 1]!;
  return band.odds;
}

/**
 * Rolls the Tier of an Item dropping on `floor`. Magic find (a percentage) makes
 * every Rare-or-better weight that much heavier.
 */
export function rollDropTier(rng: Rng, floor: number, magicFind = 0): Tier {
  return rollTier(rng, dropOdds(floor), magicFind);
}

/** Picks a Tier from weighted odds; `magicFind` % boosts Rare and better. */
export function rollTier(rng: Rng, odds: readonly (readonly [Tier, number])[], magicFind = 0): Tier {
  const boost = 1 + Math.max(0, magicFind) / 100;
  return weightedPick(rng, odds.map(([tier, w]) => [tier, tierRank(tier) >= tierRank('rare') ? w * boost : w] as const));
}

/**
 * Stats that grow with Tier only. Ability scores and armor live on the d20, where every
 * point counts; life steal stacks across a whole kit into a Hero nothing can wear down.
 */
export const D20_STATS: readonly BonusStatId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'armor', 'lifeSteal'];

/**
 * A bonus stat value (v0): Tier-only stats gain a point at Epic and another at Relic;
 * the rest grow 10% per item level and 18% per Tier step.
 */
function rollStatValue(rng: Rng, def: BonusStatDef, itemLevel: number, tier: Tier): number {
  const raw = rng.int(def.range[0], def.range[1]);
  if (D20_STATS.includes(def.id)) return raw + Math.floor(tierRank(tier) / 3);
  return Math.max(1, Math.round(raw * (1 + (itemLevel - 1) * 0.1) * (1 + tierRank(tier) * 0.18)));
}

/** The Bonus stats a base can roll: a Bond ring's count in a fight; anything else, any. */
export const bonusPoolOf = (base: string): readonly BonusStatId[] | null => (isGear(baseById(base)) && (baseById(base) as GearBase).paired ? BOND_STATS : null);
const poolOf = (only: readonly BonusStatId[] | null) => (only ? BONUS_STATS.filter((d) => only.includes(d.id)) : BONUS_STATS);

/** A fresh set of Bonus stats for a Tier: new rolls, no kind twice, from `only` if given. Used by drops and Reforge. */
export function rollBonusStats(rng: Rng, tier: Tier, itemLevel: number, only: readonly BonusStatId[] | null = null): GearRoll['bonusStats'] {
  const pool = [...poolOf(only)];
  const out: GearRoll['bonusStats'] = [];
  for (let i = 0; i < BONUS_COUNT[tier] && pool.length > 0; i++) {
    const [def] = pool.splice(rng.int(0, pool.length - 1), 1);
    out.push({ stat: def!.id, value: rollStatValue(rng, def!, itemLevel, tier) });
  }
  return out;
}

/** One more Bonus stat, of a kind the Item doesn't have yet (the Cursed altar), from `only` if given. */
export function rollExtraBonusStat(rng: Rng, tier: Tier, itemLevel: number, have: readonly string[], only: readonly BonusStatId[] | null = null): GearRoll['bonusStats'][number] | null {
  const pool = poolOf(only).filter((d) => !have.includes(d.id));
  if (pool.length === 0) return null;
  const def = rng.pick(pool);
  return { stat: def.id, value: rollStatValue(rng, def, itemLevel, tier) };
}

export interface RollGearOptions {
  tier: Tier;
  itemLevel: number;
  /** A specific base; otherwise one is picked at random (uniques bring their own). */
  baseId?: string;
  /** A specific unique for Legendary and above; otherwise one of that Tier at random. */
  uniqueId?: string;
  radiant?: boolean;
  /** Starter kits and shop stock come identified whatever their Tier. */
  identified?: boolean;
  quality?: number;
}

export function rollGear(rng: Rng, opts: RollGearOptions): GearRoll {
  const { tier, itemLevel } = opts;
  let uniqueId: string | null = null;
  let base: GearBase;

  if (tier === 'legendary' || tier === 'mythic' || tier === 'relic') {
    const unique = opts.uniqueId ? uniqueById(opts.uniqueId) : rng.pick(uniquesOfTier(tier));
    if (unique.tier !== tier) throw new Error(`unique "${unique.id}" is ${unique.tier}, not ${tier}`);
    uniqueId = unique.id;
    base = baseById(unique.base) as GearBase;
  } else {
    const picked = opts.baseId ? baseById(opts.baseId) : rng.pick(GEAR_BASES);
    if (!isGear(picked)) throw new Error(`"${picked.id}" is not gear`);
    base = picked;
  }

  const bonusStats = rollBonusStats(rng, tier, itemLevel);

  return {
    base: base.id,
    tier,
    itemLevel,
    quality: opts.quality ?? rng.int(1, 100),
    bonusStats,
    suffix: uniqueId || tier === 'common' ? null : rng.int(0, SUFFIXES.length - 1),
    uniqueId,
    radiant: opts.radiant ?? rng.chance(RADIANT_CHANCE),
    identified: opts.identified ?? tierRank(tier) < tierRank(IDENTIFIED_BELOW),
  };
}

/**
 * A pair of Bond rings (v0), from the Twin Wardens on `floor`: Rare or Epic, as the odds
 * two Floors deeper weigh those two, and identified. Each half rolls its own Quality and
 * Bonus stats, from the ones that count in a fight.
 */
export function rollBondRings(rng: Rng, floor: number): [GearRoll, GearRoll] {
  const tier = rollTier(rng, dropOdds(Math.min(10, floor + 2)).filter(([t]) => t === 'rare' || t === 'epic'));
  const half = (): GearRoll => ({
    base: 'bond-ring',
    tier,
    itemLevel: Math.max(1, floor),
    quality: rng.int(1, 100),
    bonusStats: rollBonusStats(rng, tier, Math.max(1, floor), BOND_STATS),
    suffix: null,
    uniqueId: null,
    radiant: rng.chance(RADIANT_CHANCE),
    identified: true,
  });
  return [half(), half()];
}

/** Bond rings (v0): while the two Heroes of a Duo each wear a half of one pair, each half's Bonus stats count this many times in their fights. */
export const BOND_FACTOR = 2;

/** A two-handed weapon fills the off-hand too (v0): its Bonus stats count this many times, like a weapon and an off-hand together. */
export const TWO_HANDED_FACTOR = 2;

/**
 * Forge Upgrades and Bonus stats (v0): every level adds this share to a piece's percentage
 * and max-health Bonus stats, and at each milestone level its d20 ones (abilities, armor,
 * life steal) gain +1, as does a helm's or shield's armor.
 */
export const UPGRADE_BONUS_STEP = 0.05;
export const UPGRADE_MILESTONES = [5, 10] as const;
/** The +1s an Upgrade level has reached. */
export const upgradeSteps = (upgrade: number): number => UPGRADE_MILESTONES.filter((level) => upgrade >= level).length;

/** A piece of gear as far as its Bonus stats go. */
export interface StatGear {
  /** Its base: a two-handed weapon's Bonus stats count twice. */
  base?: string;
  bonusStats: { stat: string; value: number }[];
  radiant: boolean;
  upgrade?: number;
  /** A Bond ring whose other half the Hero's Duo partner wears. */
  joined?: boolean;
}

/**
 * A piece's Bonus stats as they count everywhere (fights, Checks, health, luck, prices):
 * Radiant's +10%, then its Upgrades, twice over for a two-handed weapon, and twice over
 * for a joined Bond ring.
 */
export function effectiveStats(gear: StatGear): { stat: BonusStatId; value: number }[] {
  const upgrade = gear.upgrade ?? 0;
  const hands = gear.base !== undefined && isTwoHanded(gear.base) ? TWO_HANDED_FACTOR : 1;
  return gear.bonusStats.map(({ stat, value }) => {
    const id = stat as BonusStatId;
    const shown = gear.radiant ? Math.round(value * RADIANT_BOOST) : value;
    const grown = D20_STATS.includes(id) ? shown + upgradeSteps(upgrade) : Math.round(shown * (1 + UPGRADE_BONUS_STEP * upgrade));
    return { stat: id, value: grown * hands * (gear.joined ? BOND_FACTOR : 1) };
  });
}

/** One Bonus stat's total across a set of worn gear. */
export const statTotal = (worn: readonly StatGear[], stat: BonusStatId): number =>
  worn.reduce((total, gear) => total + effectiveStats(gear).filter((b) => b.stat === stat).reduce((s, b) => s + b.value, 0), 0);

/** Quality 1–100 → 85%–115% of the base damage or armor. */
export const qualityFactor = (quality: number): number => 0.85 + (0.3 * (quality - 1)) / 99;

export function itemName(roll: Pick<GearRoll, 'base' | 'suffix' | 'uniqueId'>): Text {
  if (roll.uniqueId) return uniqueById(roll.uniqueId).name;
  const base = baseById(roll.base).name;
  if (roll.suffix === null) return base;
  const suffix = SUFFIXES[roll.suffix]!;
  return { en: `${base.en} ${suffix.en}`, ru: `${base.ru} ${suffix.ru}` };
}

/** The Bonus stat lines as players read them, Radiant, Upgrades and two hands included. */
export function bonusLines(roll: Pick<GearRoll, 'bonusStats' | 'radiant'> & { upgrade?: number; base?: string }): Text[] {
  return effectiveStats(roll).map(({ stat, value }) => {
    const def = BONUS_STATS.find((d) => d.id === stat)!;
    return { en: def.label.en.replace('{n}', String(value)), ru: def.label.ru.replace('{n}', String(value)) };
  });
}

/** What the Shops pay (the Buyback price). */
export function buybackPrice(roll: Pick<GearRoll, 'tier' | 'itemLevel' | 'radiant'>): number {
  return Math.round(BUYBACK_BASE[roll.tier] * (1 + roll.itemLevel / 10) * (roll.radiant ? 1.5 : 1));
}
