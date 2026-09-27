import type { FastifyInstance } from 'fastify';
import type { BountiesView, HallView, TavernView } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { bountiesView, swapBounty } from '../services/bounties.js';
import { hallView, tavernView } from '../services/tavern.js';

/** The Tavern's Feed and who's online, and the Hall of Fame. */
export async function tavernRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  app.get('/api/tavern', guard, async (): Promise<TavernView> => tavernView());
  app.get('/api/hall', guard, async (): Promise<HallView> => hallView());
  app.get('/api/tavern/bounties', guard, async (request): Promise<BountiesView> => bountiesView(request.player!));
  app.post<{ Params: { id: string } }>('/api/tavern/bounties/:id/swap', guard, async (request): Promise<BountiesView> =>
    swapBounty(request.player!, request.params.id));
}
