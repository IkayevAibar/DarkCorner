import { z } from 'zod';
import { playerSchema } from './auth.js';

export const adminPlayerSchema = playerSchema.extend({
  discordId: z.string(),
  createdAt: z.string(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

/** GET /api/admin/players */
export const adminPlayersResponseSchema = z.object({
  players: z.array(adminPlayerSchema),
  /** Open: everyone who signs in is let in at once. Shut: new Players wait for an admin. */
  gateOpen: z.boolean(),
});
export type AdminPlayersResponse = z.infer<typeof adminPlayersResponseSchema>;

/** POST /api/admin/gate — opening it also lets in everyone waiting. */
export const adminGateSchema = z.object({ open: z.boolean() });
export type AdminGate = z.infer<typeof adminGateSchema>;

/** POST /api/admin/players/:id — `reset` puts a Player back to pending. */
export const adminPlayerDecisionSchema = z.object({ decision: z.enum(['approve', 'ban', 'reset']) });
export type AdminPlayerDecision = z.infer<typeof adminPlayerDecisionSchema>;
