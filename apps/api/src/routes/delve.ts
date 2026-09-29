import type { FastifyInstance } from 'fastify';
import { type DelveResult, delveFightRequestSchema } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { claimDelvePrize, delveFight, delveState, startDelve, stopDelve } from '../services/delve.js';

/** The Daily Delve at the Well. */
export async function delveRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };

  app.get('/api/delve', guard, async (request): Promise<DelveResult> => delveState(request.player!));
  app.post('/api/delve/start', guard, async (request): Promise<DelveResult> => startDelve(request.player!));
  app.post('/api/delve/fight', guard, async (request): Promise<DelveResult> =>
    delveFight(request.player!, delveFightRequestSchema.parse(request.body ?? {}).boon));
  app.post('/api/delve/stop', guard, async (request): Promise<DelveResult> => stopDelve(request.player!));
  app.post('/api/delve/claim', guard, async (request): Promise<DelveResult> => claimDelvePrize(request.player!));
}
