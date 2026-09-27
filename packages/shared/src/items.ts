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
export const itemViewSchema = z.object({
  id: z.string(),
  tier: tierSchema,
  /** Base type such as "longsword" or "helm"; picks the icon and the type line. */
  base: z.string(),
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
