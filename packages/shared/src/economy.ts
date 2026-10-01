import { z } from 'zod';
import { abilityIdSchema, blessingIdSchema, heroSchema, talentIdSchema } from './heroes.js';
import { itemViewSchema, localizedTextSchema, tierSchema } from './items.js';

// The City's trades: Shops, the Forge, the Market and the Temple, plus Chests
// and identifying. Every action answers with the whole Hero, so screens redraw
// from one source.

/** Materials a Forge action needs, and how many the Hero has (Bag and Storage). */
export const materialNeedSchema = z.object({
  base: z.string(),
  name: localizedTextSchema,
  quantity: z.number().int(),
  have: z.number().int(),
});

export const forgeCostSchema = z.object({ gold: z.number().int(), materials: z.array(materialNeedSchema) });
export type ForgeCost = z.infer<typeof forgeCostSchema>;

// ─── Shops ────────────────────────────────────────────────────────────────

export const shopOfferSchema = z.object({
  /** A base id for the basics ("potion"), or "stock-<n>" for today's gear. */
  id: z.string(),
  item: itemViewSchema,
  price: z.number().int(),
  /** Today's gear sells once per Hero per day. */
  soldOut: z.boolean(),
});
export type ShopOffer = z.infer<typeof shopOfferSchema>;

export const shopViewSchema = z.object({
  basics: z.array(shopOfferSchema),
  stock: z.array(shopOfferSchema),
  /** What the Shops pay this Hero for an Item: its Buyback price (`worth`) times this, a Haggler's and Charisma's better deal in. */
  sellRate: z.number(),
  /** When today's gear changes. */
  restocksAt: z.string(),
  hero: heroSchema,
});
export type ShopView = z.infer<typeof shopViewSchema>;

export const shopBuyRequestSchema = z.object({ offer: z.string(), quantity: z.number().int().min(1).max(99).default(1) });
export const sellRequestSchema = z.object({ quantity: z.number().int().min(1).optional() });

/** Buying or selling: the gold that changed hands (negative when spent). */
export const tradeResultSchema = z.object({ gold: z.number().int(), hero: heroSchema });
export type TradeResult = z.infer<typeof tradeResultSchema>;

// ─── Chests and identifying ───────────────────────────────────────────────

export const chestGradeSchema = z.enum(['iron', 'silver', 'gold']);

export const openChestResultSchema = z.object({
  grade: chestGradeSchema,
  prize: itemViewSchema,
  /** What the Chest could have held, for the Spin's strip. */
  odds: z.array(z.object({ tier: tierSchema, percent: z.number() })),
  hero: heroSchema,
});
export type OpenChestResult = z.infer<typeof openChestResultSchema>;

export const identifyResultSchema = z.object({
  item: itemViewSchema,
  /** Wizards identify without a scroll. */
  free: z.boolean(),
  hero: heroSchema,
});
export type IdentifyResult = z.infer<typeof identifyResultSchema>;

// ─── The Forge ────────────────────────────────────────────────────────────

export const upgradeOutcomeSchema = z.enum(['success', 'failed', 'dropped', 'saved', 'destroyed']);

/** GET /api/forge/items/:id — what the Forge can do with one Item, and what it costs. */
export const forgeQuoteSchema = z.object({
  item: itemViewSchema,
  upgrade: z.object({
    to: z.number().int(),
    /** Percent. */
    chance: z.number().int(),
    cost: forgeCostSchema,
    /** A failure could destroy the Item (past +5); a Protection scroll prevents that. */
    risky: z.boolean(),
    protectionScrolls: z.number().int(),
    /** The Item as it would be at `to`: its numbers, for showing what the level changes. */
    preview: itemViewSchema,
  }).nullable(),
  reforge: forgeCostSchema.nullable(),
  salvage: z.object({ base: z.string(), name: localizedTextSchema, min: z.number().int(), max: z.number().int() }).nullable(),
  /** Why nothing is possible, e.g. "identify_first". */
  blocked: z.string().nullable(),
});
export type ForgeQuote = z.infer<typeof forgeQuoteSchema>;

export const upgradeRequestSchema = z.object({ protect: z.boolean().default(false) });

export const upgradeResultSchema = z.object({
  outcome: upgradeOutcomeSchema,
  /** The d100 rolled: success when it is at most `chance`. */
  roll: z.number().int(),
  chance: z.number().int(),
  /** Null when the Item was destroyed. */
  item: itemViewSchema.nullable(),
  hero: heroSchema,
});
export type UpgradeResult = z.infer<typeof upgradeResultSchema>;

export const reforgeResultSchema = z.object({
  item: itemViewSchema,
  /** The Bonus stat lines it had before. */
  before: z.array(localizedTextSchema),
  hero: heroSchema,
});
export type ReforgeResult = z.infer<typeof reforgeResultSchema>;

export const salvageResultSchema = z.object({
  got: z.object({ base: z.string(), name: localizedTextSchema, quantity: z.number().int() }),
  hero: heroSchema,
});
export type SalvageResult = z.infer<typeof salvageResultSchema>;

export const recipeViewSchema = z.object({
  id: z.string(),
  makes: z.object({ base: z.string(), name: localizedTextSchema, icon: z.string() }),
  materials: z.array(materialNeedSchema),
  canCraft: z.boolean(),
});

export const forgeViewSchema = z.object({ recipes: z.array(recipeViewSchema), hero: heroSchema });
export type ForgeView = z.infer<typeof forgeViewSchema>;

export const craftRequestSchema = z.object({ recipe: z.string(), quantity: z.number().int().min(1).max(20).default(1) });

// ─── The Market ───────────────────────────────────────────────────────────

export const listingSchema = z.object({
  id: z.string(),
  item: itemViewSchema,
  price: z.number().int(),
  seller: z.string(),
  mine: z.boolean(),
  expiresAt: z.string(),
  /** Past its 7 days: only the seller sees it, to take it back. */
  expired: z.boolean(),
});
export type Listing = z.infer<typeof listingSchema>;

export const marketViewSchema = z.object({
  /** Everyone else's live listings, newest first. */
  listings: z.array(listingSchema),
  mine: z.array(listingSchema),
  taxPercent: z.number(),
  days: z.number().int(),
  hero: heroSchema,
});
export type MarketView = z.infer<typeof marketViewSchema>;

export const listRequestSchema = z.object({ itemId: z.string(), price: z.number().int().min(1).max(10_000_000) });

// ─── The Temple ───────────────────────────────────────────────────────────


export const templeViewSchema = z.object({
  blessings: z.array(z.object({
    id: blessingIdSchema, name: localizedTextSchema, description: localizedTextSchema, price: z.number().int(),
  })),
  hero: heroSchema,
});
export type TempleView = z.infer<typeof templeViewSchema>;

export const blessRequestSchema = z.object({ blessing: blessingIdSchema });

/** GET /api/academy — every Talent, whether this Hero knows it, and what the next one costs here. */
export const academyViewSchema = z.object({
  /** The level a Hero needs to study here. */
  minLevel: z.number().int(),
  /** The most Talents a Hero learns here. */
  max: z.number().int(),
  /** Talents learned here, in order. */
  learned: z.array(talentIdSchema),
  /** What the next Talent costs in City gold, or null once all are learned. */
  price: z.number().int().nullable(),
  /** Every Talent, and whether this Hero knows it (from any source). */
  talents: z.array(z.object({ id: talentIdSchema, name: localizedTextSchema, description: localizedTextSchema, known: z.boolean() })),
  hero: heroSchema,
});
export type AcademyView = z.infer<typeof academyViewSchema>;

/** POST /api/academy/learn — a Talent the Hero doesn't know yet → AcademyView. */
export const learnTalentRequestSchema = z.object({ talent: talentIdSchema });

/** GET /api/training — the Training grounds: what was trained, what the next costs, and any training under way. */
export const trainingViewSchema = z.object({
  /** The most times a Hero trains here. */
  max: z.number().int(),
  /** How long a training takes. */
  hours: z.number().int(),
  /** Abilities trained here, in order (each +1, already in the Hero's scores). */
  trained: z.array(abilityIdSchema),
  /** What the next training costs in City gold, or null once all are done. */
  price: z.number().int().nullable(),
  /** The training under way: its ability and when the +1 lands; null when none. */
  current: z.object({ ability: abilityIdSchema, until: z.string() }).nullable(),
  hero: heroSchema,
});
export type TrainingView = z.infer<typeof trainingViewSchema>;

/** POST /api/training/start — an ability below 20 → TrainingView. */
export const trainRequestSchema = z.object({ ability: abilityIdSchema });
