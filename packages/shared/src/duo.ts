import { z } from 'zod';
import { classIdSchema } from './classes.js';
import { duoPartnerSchema } from './labyrinth.js';

// Duos (docs/design.md → Duos): two Players' Heroes walking the same Rooms and
// fighting side by side, while both Players are online.

/** A Hero as an invite shows it. */
export const duoHeroSchema = z.object({
  heroId: z.string(),
  name: z.string(),
  portraitUrl: z.string(),
  banner: z.string(),
  class: classIdSchema,
  level: z.number().int(),
});
export type DuoHero = z.infer<typeof duoHeroSchema>;

export const duoInviteSchema = z.object({
  id: z.string(),
  from: duoHeroSchema,
  to: duoHeroSchema,
  /** Invites last ten minutes. */
  expiresAt: z.string(),
});
export type DuoInvite = z.infer<typeof duoInviteSchema>;

/** GET /api/duo, and what every Duo action returns. */
export const duoStateSchema = z.object({
  partner: duoPartnerSchema.nullable(),
  incoming: z.array(duoInviteSchema),
  outgoing: duoInviteSchema.nullable(),
  /** Heroes of Players online now, in the City, not in a Duo: who could be invited. */
  candidates: z.array(duoHeroSchema),
  /** This Hero is in the Labyrinth (its partner may have led the Duo in). */
  inside: z.boolean(),
});
export type DuoState = z.infer<typeof duoStateSchema>;

/** POST /api/duo/invite */
export const duoInviteRequestSchema = z.object({ heroId: z.string().min(1).max(40) });
/** POST /api/duo/accept and /api/duo/decline */
export const duoAnswerRequestSchema = z.object({ inviteId: z.string().min(1).max(40) });
