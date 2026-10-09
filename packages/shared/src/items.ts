import { z } from 'zod';
import { classIdSchema } from './classes.js';

/** Rarity, lowest to highest. Relics sit above the Tiers but share the list for ordering. */
export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'relic'] as const;
export const tierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof tierSchema>;

/** Bonus stat kinds (engine: content/loot.ts). */
export const BONUS_STAT_IDS = [
  'str', 'dex', 'con', 'int', 'wis', 'cha', 'maxHp', 'armor', 'damage', 'crit', 'spellPower', 'healing', 'escape', 'goldFind', 'magicFind', 'lifeSteal',
] as const;
export const bonusStatIdSchema = z.enum(BONUS_STAT_IDS);
export type BonusStatId = z.infer<typeof bonusStatIdSchema>;

/** Game content comes from the engine in both languages; the web picks one. */
export const localizedTextSchema = z.object({ en: z.string(), ru: z.string() });
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/**
 * An Item as the web app renders it: a tile, a card, a line in the Feed.
 * Fields that identifying reveals are null while `identified` is false.
 */
export const ITEM_KINDS = ['gear', 'potion', 'scroll', 'bomb', 'key', 'chest', 'material'] as const;
export const itemKindSchema = z.enum(ITEM_KINDS);
export type ItemKind = z.infer<typeof itemKindSchema>;

/** Where a piece of gear is worn; rings fit either ring slot. */
export const GEAR_SLOTS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring'] as const;

/**
 * What a piece of gear does in a fight, with its Quality, Upgrades and Radiant
 * applied, so two Items can be compared. While Unidentified it shows the base
 * type at an average Quality.
 */
export const gearFactsSchema = z.object({
  slot: z.enum(GEAR_SLOTS),
  /** Proficiency group, e.g. "blade", "heavy" armor or "shield"; null when anyone may wear it. */
  group: z.string().nullable(),
  /** The Classes that may wear it; null means all of them. */
  classes: z.array(classIdSchema).nullable(),
  /** Weapons: damage before the ability modifier. `percent` is the Quality/Upgrade/Radiant scaling. */
  damage: z.object({
    dice: z.number().int(), sides: z.number().int(), min: z.number().int(), max: z.number().int(), percent: z.number().int(),
    hits: z.enum(['slash', 'pierce', 'bludgeon']),
  }).nullable(),
  /** Body armor: its Armor Class before DEX, and the most DEX that still counts (null: all of it). Shields and helms: what they add. */
  armor: z.object({ ac: z.number().int(), body: z.boolean(), maxDex: z.number().int().nullable() }).nullable(),
  /** Heavy body armor: Sneaking at disadvantage. */
  heavy: z.boolean(),
  /** Weapons: 2 when held in both hands, so nothing goes in the off-hand beside it (and its Bonus stats count twice). */
  hands: z.union([z.literal(1), z.literal(2)]).default(1),
  /** A light weapon (a dagger): it goes in either hand, and in the off-hand strikes once more each turn. */
  light: z.boolean().default(false),
});
export type GearFactsView = z.infer<typeof gearFactsSchema>;

export const itemViewSchema = z.object({
  id: z.string(),
  /** Only gear has Quality, Bonus stats and Upgrades; the rest stack. */
  kind: itemKindSchema,
  /** Stack size; always 1 for gear. */
  quantity: z.number().int().min(1),
  /** For stackables the Tier is a color hint: a Silver chest shows as Rare. */
  tier: tierSchema,
  /** Base type such as "longsword" or "helm". */
  base: z.string(),
  /** Icon key for the base, e.g. "sword" (see apps/web/src/components/items/icons.ts). */
  icon: z.string(),
  name: localizedTextSchema,
  /** Comes from the Floor it dropped on; makes Bonus stats bigger (+10% a level) and the price higher. */
  itemLevel: z.number().int().min(1),
  identified: z.boolean(),
  /** 1–100. */
  quality: z.number().int().min(1).max(100).nullable(),
  /** Ready-made lines such as "+3 Strength", Radiant and Upgrades counted in. */
  bonusStats: z.array(localizedTextSchema).nullable(),
  /** Which Bonus stat each of those lines is, in the same order: what the card explains when one is tapped. */
  bonusStatIds: z.array(bonusStatIdSchema).nullable().default(null),
  /** The named power of a Legendary, Mythic or Relic. */
  power: localizedTextSchema.nullable(),
  radiant: z.boolean().nullable(),
  /** Forge Upgrade level, 0–10. */
  upgrade: z.number().int().min(0).max(10),
  /** Relics only: "#2 of 3". */
  serial: z.object({ number: z.number().int().min(1), of: z.number().int().min(1) }).nullable(),
  /** Relics only: display names of everyone who has owned this copy, oldest first. */
  owners: z.array(z.string()).nullable(),
  /** Painted art: a unique's own once identified, otherwise its base's (every gear type is being painted); null falls back to an icon from `base`. */
  art: z.string().nullable(),
  /** What the Shops pay for it (the Buyback price), in gold. */
  worth: z.number().int().min(0),
  /** Gear only: its fight numbers. */
  gear: gearFactsSchema.nullable(),
  /** Stackables only: what using one does. */
  about: localizedTextSchema.nullable(),
});
export type ItemView = z.infer<typeof itemViewSchema>;
