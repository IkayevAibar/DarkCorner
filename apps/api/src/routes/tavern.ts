import type { FastifyInstance } from 'fastify';
import type { BountiesView, HallView, RankingsView, TavernView } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { bountiesView, swapBounty } from '../services/bounties.js';
import { rankingsView } from '../services/rankings.js';
import { hallView, tavernView } from '../services/tavern.js';

/** The Tavern's Feed and who's online, its Rankings, and the Hall of Fame. */
export async function tavernRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  app.get('/api/tavern', guard, async (): Promise<TavernView> => tavernView());
  app.get('/api/hall', guard, async (): Promise<HallView> => hallView());
  app.get('/api/tavern/rankings', guard, async (request): Promise<RankingsView> => rankingsView(request.player!));
  app.get('/api/tavern/bounties', guard, async (request): Promise<BountiesView> => bountiesView(request.player!));
  app.post<{ Params: { id: string } }>('/api/tavern/bounties/:id/swap', guard, async (request): Promise<BountiesView> =>
    swapBounty(request.player!, request.params.id));
}
