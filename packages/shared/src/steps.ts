import { z } from 'zod';
import { itemViewSchema, localizedTextSchema } from './items.js';

// First steps (docs/design.md → First steps): a new Hero's short list of goals,
// each with a small reward that a Player claims once a Season.

export const stepViewSchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  /** How to do it. */
  how: localizedTextSchema,
  /** The reward, in words ("Healing potion ×2", "150 gold"). */
  reward: localizedTextSchema,
  done: z.boolean(),
  claimed: z.boolean(),
});
export type StepView = z.infer<typeof stepViewSchema>;

/** GET /api/steps */
export const stepsViewSchema = z.object({
  steps: z.array(stepViewSchema),
  /** Done and not claimed yet. */
  ready: z.number().int(),
});
export type StepsView = z.infer<typeof stepsViewSchema>;

/** POST /api/steps/claim */
export const stepClaimRequestSchema = z.object({ id: z.string().min(1).max(40) });
export type StepClaimRequest = z.infer<typeof stepClaimRequestSchema>;

export const stepClaimResultSchema = z.object({
  view: stepsViewSchema,
  loot: z.array(itemViewSchema),
  gold: z.number().int(),
});
export type StepClaimResult = z.infer<typeof stepClaimResultSchema>;

/** POST /api/admin/announce: a message from the game's makers, in both languages. */
export const adminAnnounceSchema = z.object({
  en: z.string().trim().min(1).max(1200),
  ru: z.string().trim().min(1).max(1200),
  /** Also as a Notification to every device that wants news. */
  push: z.boolean().default(true),
});
export type AdminAnnounce = z.infer<typeof adminAnnounceSchema>;

export const adminAnnounceResultSchema = z.object({
  /** False when no Discord webhook is set: only the Feed (and phones) got it. */
  discord: z.boolean(),
  /** Players whose devices will get it. */
  notified: z.number().int(),
});
export type AdminAnnounceResult = z.infer<typeof adminAnnounceResultSchema>;
