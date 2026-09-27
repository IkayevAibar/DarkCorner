import { z } from 'zod';

/** Rarity, lowest to highest. Relics sit above the Tiers but share the list for ordering. */
export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'relic'] as const;
export const tierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof tierSchema>;

/** Game content comes from the engine in both languages; the web picks one. */
export const localizedTextSchema = z.object({ en: z.string(), ru: z.string() });
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/**
 * An Item as the web app renders it: a tile, a card, a line in the Feed.
 * Fields that identifying reveals are null while `identified` is false.
 */
export const ITEM_KINDS = ['gear', 'potion', 'scroll', 'key', 'chest', 'material'] as const;
export const itemKindSchema = z.enum(ITEM_KINDS);
export type ItemKind = z.infer<typeof itemKindSchema>;

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
  /** Comes from the Floor it dropped on; scales base damage or armor. */
  itemLevel: z.number().int().min(1),
  identified: z.boolean(),
  /** 1–100. */
  quality: z.number().int().min(1).max(100).nullable(),
  /** Ready-made lines such as "+3 Strength". */
  bonusStats: z.array(localizedTextSchema).nullable(),
  /** The named power of a Legendary, Mythic or Relic. */
  power: localizedTextSchema.nullable(),
  radiant: z.boolean().nullable(),
  /** Forge Upgrade level, 0–10. */
  upgrade: z.number().int().min(0).max(10),
  /** Relics only: "#2 of 3". */
  serial: z.object({ number: z.number().int().min(1), of: z.number().int().min(1) }).nullable(),
  /** Relics only: display names of everyone who has owned this copy, oldest first. */
  owners: z.array(z.string()).nullable(),
  /** Painted art for Legendary-and-above uniques; everything else uses an icon from `base`. */
  art: z.string().nullable(),
  /** What the Shops pay for it (the Buyback price), in gold. */
  worth: z.number().int().min(0),
});
export type ItemView = z.infer<typeof itemViewSchema>;
