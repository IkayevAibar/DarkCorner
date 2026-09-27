import { type GearBase, GEAR_BASES, baseById, isGear } from './content/bases.js';
import {
  BONUS_COUNT, BONUS_STATS, type BonusStatDef, type BonusStatId, BUYBACK_BASE, DROP_ODDS, IDENTIFIED_BELOW, RADIANT_BOOST, RADIANT_CHANCE,
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

/** A fresh set of Bonus stats for a Tier: new rolls, no kind twice. Used by drops and Reforge. */
export function rollBonusStats(rng: Rng, tier: Tier, itemLevel: number): GearRoll['bonusStats'] {
  const pool = [...BONUS_STATS];
  const out: GearRoll['bonusStats'] = [];
  for (let i = 0; i < BONUS_COUNT[tier] && pool.length > 0; i++) {
    const [def] = pool.splice(rng.int(0, pool.length - 1), 1);
    out.push({ stat: def!.id, value: rollStatValue(rng, def!, itemLevel, tier) });
  }
  return out;
}

/** One more Bonus stat, of a kind the Item doesn't have yet (the Cursed altar). */
export function rollExtraBonusStat(rng: Rng, tier: Tier, itemLevel: number, have: readonly string[]): GearRoll['bonusStats'][number] | null {
  const pool = BONUS_STATS.filter((d) => !have.includes(d.id));
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

/** Quality 1–100 → 85%–115% of the base damage or armor. */
export const qualityFactor = (quality: number): number => 0.85 + (0.3 * (quality - 1)) / 99;

export function itemName(roll: Pick<GearRoll, 'base' | 'suffix' | 'uniqueId'>): Text {
  if (roll.uniqueId) return uniqueById(roll.uniqueId).name;
  const base = baseById(roll.base).name;
  if (roll.suffix === null) return base;
  const suffix = SUFFIXES[roll.suffix]!;
  return { en: `${base.en} ${suffix.en}`, ru: `${base.ru} ${suffix.ru}` };
}

/** The Bonus stat lines as players read them, Radiant boost included. */
export function bonusLines(roll: Pick<GearRoll, 'bonusStats' | 'radiant'>): Text[] {
  return roll.bonusStats.map(({ stat, value }) => {
    const def = BONUS_STATS.find((d) => d.id === stat)!;
    const shown = roll.radiant ? Math.round(value * RADIANT_BOOST) : value;
    return { en: def.label.en.replace('{n}', String(shown)), ru: def.label.ru.replace('{n}', String(shown)) };
  });
}

/** What the Shops pay (the Buyback price). */
export function buybackPrice(roll: Pick<GearRoll, 'tier' | 'itemLevel' | 'radiant'>): number {
  return Math.round(BUYBACK_BASE[roll.tier] * (1 + roll.itemLevel / 10) * (roll.radiant ? 1.5 : 1));
}
