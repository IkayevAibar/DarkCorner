import { z } from 'zod';
import { playerSchema } from './auth.js';

export const adminPlayerSchema = playerSchema.extend({
  discordId: z.string(),
  createdAt: z.string(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

/** GET /api/admin/players */
export const adminPlayersResponseSchema = z.object({ players: z.array(adminPlayerSchema) });
export type AdminPlayersResponse = z.infer<typeof adminPlayersResponseSchema>;

/** POST /api/admin/players/:id — `reset` puts a Player back to pending. */
export const adminPlayerDecisionSchema = z.object({ decision: z.enum(['approve', 'ban', 'reset']) });
export type AdminPlayerDecision = z.infer<typeof adminPlayerDecisionSchema>;
