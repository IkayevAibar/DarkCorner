import { type GearBase, GEAR_BASES, baseById, isGear } from './content/bases.js';
import type { ClassId } from './content/classes.js';
import { BONUS_COUNT, RADIANT_BOOST, type Tier, tierRank } from './content/loot.js';
import { type Text, text } from './content/text.js';
import { type GearRoll, buybackPrice, rollGear, rollTier } from './items.js';
import type { Rng } from './rng.js';
import { canUse } from './stats.js';

// All numbers here are v0 (docs/design.md → Items and loot, Economy).

// ─── Chests and Keys ──────────────────────────────────────────────────────

export const CHEST_GRADES = ['iron', 'silver', 'gold'] as const;
export type ChestGrade = (typeof CHEST_GRADES)[number];

export const CHEST_ODDS: Record<ChestGrade, [Tier, number][]> = {
  iron: [['uncommon', 70], ['rare', 22], ['epic', 6.5], ['legendary', 1.3], ['mythic', 0.2]],
  silver: [['rare', 70], ['epic', 24], ['legendary', 5], ['mythic', 1]],
  gold: [['epic', 75], ['legendary', 21], ['mythic', 4]],
};

export const chestBase = (grade: ChestGrade): string => `chest-${grade}`;
export const keyBase = (grade: ChestGrade): string => `key-${grade}`;

export function chestGradeOf(base: string): ChestGrade | null {
  const grade = base.startsWith('chest-') ? base.slice('chest-'.length) : null;
  return (CHEST_GRADES as readonly string[]).includes(grade ?? '') ? (grade as ChestGrade) : null;
}

/** What a Chest holds. Chests don't feel the Bad-luck meter or magic find: their odds are printed. */
export function rollChestTier(rng: Rng, grade: ChestGrade): Tier {
  return rollTier(rng, CHEST_ODDS[grade]);
}

/** Which Chest drops when one does: mostly Iron. */
export function rollChestGrade(rng: Rng, floor: number): ChestGrade {
  const odds: [ChestGrade, number][] = floor <= 3 ? [['iron', 85], ['silver', 13], ['gold', 2]]
    : floor <= 6 ? [['iron', 70], ['silver', 25], ['gold', 5]]
    : [['iron', 55], ['silver', 35], ['gold', 10]];
  let r = rng.next() * 100;
  return odds.find(([, w]) => (r -= w) < 0)?.[0] ?? 'iron';
}

// ─── The Bad-luck meter ───────────────────────────────────────────────────

/** At this, the next Item that drops is Legendary or better. */
export const BAD_LUCK_MAX = 120;
export const BAD_LUCK_PER_FIGHT = 1;
export const BAD_LUCK_PER_MINIBOSS = 5;
/** Chance that a meter-forced drop is Mythic rather than Legendary. */
export const BAD_LUCK_MYTHIC = 0.05;

/**
 * The Tier of a dropping Item, with the meter: a full meter forces Legendary or
 * better. `reset` says the meter should go back to 0 (any Legendary-or-better drop).
 */
export function rollLootTier(rng: Rng, opts: { odds: readonly (readonly [Tier, number])[]; magicFind: number; badLuck: number }): {
  tier: Tier; forced: boolean; reset: boolean;
} {
  if (opts.badLuck >= BAD_LUCK_MAX) {
    return { tier: rng.chance(BAD_LUCK_MYTHIC) ? 'mythic' : 'legendary', forced: true, reset: true };
  }
  const tier = rollTier(rng, opts.odds, opts.magicFind);
  return { tier, forced: false, reset: tierRank(tier) >= tierRank('legendary') };
}

// ─── Shops ────────────────────────────────────────────────────────────────

/** What the Shops sell outright, and for how much. */
export const SHOP_BASICS: { base: string; price: number }[] = [
  { base: 'potion', price: 25 },
  { base: 'scroll-identify', price: 20 },
  { base: 'scroll-portal', price: 50 },
  { base: 'scroll-protection', price: 200 },
  { base: 'key-iron', price: 50 },
  { base: 'key-silver', price: 250 },
  { base: 'key-gold', price: 1000 },
];

/** Buyback price for one of a stackable. */
export const STACK_BUYBACK: Record<string, number> = {
  potion: 6, 'scroll-identify': 5, 'scroll-portal': 12, 'scroll-protection': 50,
  'key-iron': 12, 'key-silver': 60, 'key-gold': 250,
  'chest-iron': 15, 'chest-silver': 80, 'chest-gold': 350,
  scrap: 2, essence: 10, soulstone: 60,
};

/** Haggler: Shops pay 10% more and sell for 10% less. */
export const HAGGLE = 0.1;

export const shopBuyPrice = (price: number, haggler: boolean): number => Math.max(1, Math.round(price * (haggler ? 1 - HAGGLE : 1)));
export const shopSellPrice = (price: number, haggler: boolean): number => Math.round(price * (haggler ? 1 + HAGGLE : 1));

/** What the Shops pay for one Item (a whole stack counts each piece). */
export function sellValue(item: { base: string; tier: Tier; itemLevel: number; radiant: boolean; quantity: number }): number {
  const base = baseById(item.base);
  if (isGear(base)) return buybackPrice(item);
  return (STACK_BUYBACK[item.base] ?? 1) * item.quantity;
}

/** Gear in the Shops costs this many times its Buyback price. */
export const SHOP_GEAR_MARKUP = 4;
export const SHOP_STOCK = { common: 4, uncommon: 2 } as const;

/** Today's gear in the Shops for one Hero: Commons and Uncommons it can use, at its depth. */
export function shopStock(rng: Rng, opts: { classId: ClassId; itemLevel: number }): GearRoll[] {
  const usable = GEAR_BASES.filter((b) => canUse(opts.classId, b));
  const out: GearRoll[] = [];
  for (const [tier, count] of Object.entries(SHOP_STOCK) as [Tier, number][]) {
    for (let i = 0; i < count; i++) {
      out.push(rollGear(rng, { tier, itemLevel: opts.itemLevel, baseId: rng.pick(usable).id, identified: true, radiant: false }));
    }
  }
  return out;
}

// ─── The Forge ────────────────────────────────────────────────────────────

export const MAX_UPGRADE = 10;
/** Chance of success for each step, in percent; index = the level being reached. */
export const UPGRADE_CHANCE = [0, 95, 90, 85, 80, 70, 60, 50, 40, 30, 20] as const;
/** Failing on the way to this level or lower only costs the gold and Materials. */
export const UPGRADE_SAFE_UNTIL = 5;

export interface MaterialCost {
  base: string;
  quantity: number;
}

export interface ForgeCost {
  gold: number;
  materials: MaterialCost[];
}

const TIER_COST: Record<Tier, number> = { common: 1, uncommon: 1.5, rare: 2.5, epic: 4, legendary: 7, mythic: 12, relic: 15 };

/** Gold grows with the square of the level and with the Tier; Materials move from Scrap to Soulstone. */
export function upgradeCost(tier: Tier, to: number): ForgeCost {
  const gold = Math.round(20 * to * to * TIER_COST[tier]);
  const materials: MaterialCost = to <= 3 ? { base: 'scrap', quantity: 1 + to }
    : to <= 7 ? { base: 'essence', quantity: to - 2 }
    : { base: 'soulstone', quantity: to - 7 };
  return { gold, materials: [materials] };
}

export type UpgradeOutcome = 'success' | 'failed' | 'dropped' | 'saved' | 'destroyed';

/**
 * One Upgrade attempt. `roll` is a d100 (success when roll ≤ chance). Past +5 a
 * failure either drops a level or destroys the Item; a Protection scroll turns
 * destroying into dropping (and is only used up when it does).
 */
export function rollUpgrade(rng: Rng, current: number, protect: boolean): {
  outcome: UpgradeOutcome; level: number; roll: number; chance: number; protectionUsed: boolean;
} {
  const to = current + 1;
  if (to > MAX_UPGRADE) throw new Error('already at the top');
  const chance = UPGRADE_CHANCE[to]!;
  const roll = rng.int(1, 100);
  if (roll <= chance) return { outcome: 'success', level: to, roll, chance, protectionUsed: false };
  if (to <= UPGRADE_SAFE_UNTIL) return { outcome: 'failed', level: current, roll, chance, protectionUsed: false };
  if (rng.chance(0.5)) return { outcome: 'dropped', level: current - 1, roll, chance, protectionUsed: false };
  if (protect) return { outcome: 'saved', level: current - 1, roll, chance, protectionUsed: true };
  return { outcome: 'destroyed', level: current, roll, chance, protectionUsed: false };
}

/** Reforge costs by Tier; Commons have no Bonus stats to reroll. */
export const REFORGE_COST: Record<Tier, ForgeCost | null> = {
  common: null,
  uncommon: { gold: 100, materials: [{ base: 'scrap', quantity: 3 }] },
  rare: { gold: 250, materials: [{ base: 'essence', quantity: 1 }] },
  epic: { gold: 600, materials: [{ base: 'essence', quantity: 3 }] },
  legendary: { gold: 2000, materials: [{ base: 'soulstone', quantity: 1 }] },
  mythic: { gold: 6000, materials: [{ base: 'soulstone', quantity: 3 }] },
  relic: { gold: 10000, materials: [{ base: 'soulstone', quantity: 5 }] },
};

export const canReforge = (tier: Tier): boolean => BONUS_COUNT[tier] > 0 && REFORGE_COST[tier] !== null;

/** What Salvage gives, before the Upgrade bonus. Relics can't be salvaged. */
const SALVAGE: Record<Tier, { base: string; min: number; max: number } | null> = {
  common: { base: 'scrap', min: 1, max: 2 },
  uncommon: { base: 'scrap', min: 2, max: 4 },
  rare: { base: 'essence', min: 1, max: 2 },
  epic: { base: 'essence', min: 2, max: 4 },
  legendary: { base: 'soulstone', min: 1, max: 1 },
  mythic: { base: 'soulstone', min: 2, max: 3 },
  relic: null,
};

/** The range Salvage can give: one more Material for every 3 Upgrade levels. */
export function salvageRange(tier: Tier, upgrade: number): { base: string; min: number; max: number } | null {
  const s = SALVAGE[tier];
  if (!s) return null;
  const extra = Math.floor(upgrade / 3);
  return { base: s.base, min: s.min + extra, max: s.max + extra };
}

export function rollSalvage(rng: Rng, tier: Tier, upgrade: number): MaterialCost | null {
  const range = salvageRange(tier, upgrade);
  return range ? { base: range.base, quantity: rng.int(range.min, range.max) } : null;
}

export interface Recipe {
  id: string;
  makes: string;
  materials: MaterialCost[];
}

/** Forge crafting: Keys and Protection scrolls from Materials. */
export const RECIPES: Recipe[] = [
  { id: 'key-iron', makes: 'key-iron', materials: [{ base: 'scrap', quantity: 6 }] },
  { id: 'key-silver', makes: 'key-silver', materials: [{ base: 'essence', quantity: 4 }] },
  { id: 'key-gold', makes: 'key-gold', materials: [{ base: 'soulstone', quantity: 2 }] },
  { id: 'scroll-protection', makes: 'scroll-protection', materials: [{ base: 'essence', quantity: 3 }] },
];

// ─── The Market ───────────────────────────────────────────────────────────

export const MARKET_TAX = 0.05;
export const MARKET_DAYS = 7;
export const MARKET_MAX_PRICE = 10_000_000;

/** What the seller receives when a listing sells: the price minus a 5% tax (rounded up). */
export const marketPayout = (price: number): number => price - Math.ceil(price * MARKET_TAX);

// ─── Blessings ────────────────────────────────────────────────────────────

export const BLESSING_IDS = ['fortune', 'greed', 'providence'] as const;
export type BlessingId = (typeof BLESSING_IDS)[number];

export interface BlessingDef {
  id: BlessingId;
  name: Text;
  description: Text;
  /** At the Temple. Shrines grant them for free. */
  price: number;
  magicFind: number;
  goldFind: number;
  /** Multiplies what the Bad-luck meter gains. */
  badLuck: number;
}

/** A Blessing lasts this long, and a new one replaces the old. */
export const BLESSING_MS = 3 * 60 * 60 * 1000;

export const BLESSINGS: Record<BlessingId, BlessingDef> = {
  fortune: {
    id: 'fortune', name: text('Blessing of Fortune', 'Благословение удачи'),
    description: text('+25% magic find for 3 hours.', '+25% к удаче в добыче на 3 часа.'),
    price: 150, magicFind: 25, goldFind: 0, badLuck: 1,
  },
  greed: {
    id: 'greed', name: text('Blessing of Greed', 'Благословение алчности'),
    description: text('+50% gold find for 3 hours.', '+50% к золоту на 3 часа.'),
    price: 100, magicFind: 0, goldFind: 50, badLuck: 1,
  },
  providence: {
    id: 'providence', name: text('Blessing of Providence', 'Благословение провидения'),
    description: text('Your Bad-luck meter fills twice as fast for 3 hours.', 'Счётчик невезения наполняется вдвое быстрее 3 часа.'),
    price: 200, magicFind: 0, goldFind: 0, badLuck: 2,
  },
};

/** Magic find, gold find and meter speed from worn gear, an active Blessing and Relics. */
export function luckOf(opts: {
  worn: { bonusStats: { stat: string; value: number }[]; radiant: boolean; uniqueId: string | null }[];
  blessing: BlessingId | null;
}): { magicFind: number; goldFind: number; badLuckRate: number } {
  const sum = (stat: string) => opts.worn.reduce((t, g) => t + g.bonusStats
    .filter((b) => b.stat === stat)
    .reduce((s, b) => s + (g.radiant ? Math.round(b.value * RADIANT_BOOST) : b.value), 0), 0);
  const blessing = opts.blessing ? BLESSINGS[opts.blessing] : null;
  const crown = opts.worn.some((g) => g.uniqueId === 'first-kings-crown') ? 2 : 1;
  return {
    magicFind: sum('magicFind') + (blessing?.magicFind ?? 0),
    goldFind: sum('goldFind') + (blessing?.goldFind ?? 0),
    badLuckRate: crown * (blessing?.badLuck ?? 1),
  };
}

/** Gear a Class can use, for merchants and Shops. */
export const usableBases = (classId: ClassId): GearBase[] => GEAR_BASES.filter((b) => canUse(classId, b));
