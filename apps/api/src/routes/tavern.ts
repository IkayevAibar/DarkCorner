import type { FastifyInstance } from 'fastify';
import type { HallView, TavernView } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { hallView, tavernView } from '../services/tavern.js';

/** The Tavern's Feed and who's online, and the Hall of Fame. */
export async function tavernRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  app.get('/api/tavern', guard, async (): Promise<TavernView> => tavernView());
  app.get('/api/hall', guard, async (): Promise<HallView> => hallView());
}
