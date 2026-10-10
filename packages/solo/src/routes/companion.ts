import { z } from 'zod';
import type { LabyrinthResult } from '@dark/shared';
import type { App } from '../router.js';
import { requireApproved } from '../lib/session.js';
import {
  type CompanionView, companionView, dismissCompanion, giveToCompanion, hireCompanion, takeFromCompanion,
} from '../services/companion.js';
import { takeWholeChest } from '../services/labyrinth.js';

/**
 * The Companion (docs/design.md → The solo game → The Companion): hired at the Tavern,
 * dressed from the Bag, let go at the Tavern. Solo only: the server has none.
 */

const hireSchema = z.object({ offer: z.number().int().min(0) });
const itemSchema = z.object({ itemId: z.string().min(1) });

export async function companionRoutes(app: App) {
  const guard = { preHandler: requireApproved };

  app.get('/api/companion', guard, async (request): Promise<CompanionView> => companionView(request.player!));
  app.post('/api/companion/hire', guard, async (request): Promise<CompanionView> =>
    hireCompanion(request.player!, hireSchema.parse(request.body).offer));
  app.post('/api/companion/dismiss', guard, async (request): Promise<CompanionView> => dismissCompanion(request.player!));
  app.post('/api/companion/give', guard, async (request): Promise<CompanionView> =>
    giveToCompanion(request.player!, itemSchema.parse(request.body).itemId));
  app.post('/api/companion/take', guard, async (request): Promise<CompanionView> =>
    takeFromCompanion(request.player!, itemSchema.parse(request.body).itemId));
  /** Every Item left in the Duo Chest at once, at a price in the Companion's loyalty. */
  app.post('/api/labyrinth/chest/all', guard, async (request): Promise<LabyrinthResult> => takeWholeChest(request.player!));
}
