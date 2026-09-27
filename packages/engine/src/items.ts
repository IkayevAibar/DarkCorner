import { type GearBase, GEAR_BASES, baseById, isGear } from './content/bases.js';
import {
  BONUS_COUNT, BONUS_STATS, type BonusStatId, BUYBACK_BASE, DROP_ODDS, IDENTIFIED_BELOW, RADIANT_BOOST, RADIANT_CHANCE,
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

/** Rolls the Tier of an Item dropping on `floor`, with the odds from docs/design.md. */
export function rollDropTier(rng: Rng, floor: number): Tier {
  const band = DROP_ODDS.find((b) => floor >= b.floors[0] && floor <= b.floors[1]) ?? DROP_ODDS[DROP_ODDS.length - 1]!;
  return weightedPick(rng, band.odds);
}

/** A bonus stat value: grows 10% per item level and 18% per Tier step. */
function rollStatValue(rng: Rng, range: [number, number], itemLevel: number, tier: Tier): number {
  const raw = rng.int(range[0], range[1]);
  return Math.max(1, Math.round(raw * (1 + (itemLevel - 1) * 0.1) * (1 + tierRank(tier) * 0.18)));
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

  const pool = [...BONUS_STATS];
  const bonusStats: GearRoll['bonusStats'] = [];
  for (let i = 0; i < BONUS_COUNT[tier] && pool.length > 0; i++) {
    const [def] = pool.splice(rng.int(0, pool.length - 1), 1);
    bonusStats.push({ stat: def!.id, value: rollStatValue(rng, def!.range, itemLevel, tier) });
  }

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
