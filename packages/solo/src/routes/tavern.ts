import type { App as FastifyInstance } from '../router.js';
import type { BountiesView, HallView, LodgingView, RankingsView, TavernView } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { bountiesView, swapBounty } from '../services/bounties.js';
import { lodgingView, takeLodging } from '../services/lodging.js';
import { rankingsView } from '../services/rankings.js';
import { hallView, tavernView } from '../services/tavern.js';

/** The Tavern's Feed and who's online, its Rankings, a bed for the night, and the Hall of Fame. */
export async function tavernRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  app.get('/api/tavern', guard, async (): Promise<TavernView> => tavernView());
  app.get('/api/hall', guard, async (): Promise<HallView> => hallView());
  app.get('/api/tavern/rankings', guard, async (request): Promise<RankingsView> => rankingsView(request.player!));
  app.get('/api/tavern/lodging', guard, async (request): Promise<LodgingView> => lodgingView(request.player!));
  app.post('/api/tavern/lodging', guard, async (request): Promise<LodgingView> => takeLodging(request.player!));
  app.get('/api/tavern/bounties', guard, async (request): Promise<BountiesView> => bountiesView(request.player!));
  app.post<{ Params: { id: string } }>('/api/tavern/bounties/:id/swap', guard, async (request): Promise<BountiesView> =>
    swapBounty(request.player!, request.params.id));
}
