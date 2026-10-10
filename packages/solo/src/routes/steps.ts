import type { App as FastifyInstance } from '../router.js';
import { type StepClaimResult, type StepsView, stepClaimRequestSchema } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { claimStep, stepsView } from '../services/steps.js';

/** First steps: the goals of a new Hero's first hour, and their rewards. */
export async function stepsRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };

  app.get('/api/steps', guard, async (request): Promise<StepsView> => stepsView(request.player!));
  app.post('/api/steps/claim', guard, async (request): Promise<StepClaimResult> =>
    claimStep(request.player!, stepClaimRequestSchema.parse(request.body).id));
}
