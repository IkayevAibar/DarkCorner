import type { App as FastifyInstance } from '../router.js';
import { type DuoState, duoAnswerRequestSchema, duoInviteRequestSchema } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { acceptDuo, declineDuo, duoState, inviteToDuo, leaveDuo } from '../services/duo.js';

/** Duos: two Heroes walking the Labyrinth together (docs/design.md → Duos). */
export async function duoRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };

  app.get('/api/duo', guard, async (request): Promise<DuoState> => duoState(request.player!));
  app.post('/api/duo/invite', guard, async (request): Promise<DuoState> =>
    inviteToDuo(request.player!, duoInviteRequestSchema.parse(request.body).heroId));
  app.post('/api/duo/accept', guard, async (request): Promise<DuoState> =>
    acceptDuo(request.player!, duoAnswerRequestSchema.parse(request.body).inviteId));
  app.post('/api/duo/decline', guard, async (request): Promise<DuoState> =>
    declineDuo(request.player!, duoAnswerRequestSchema.parse(request.body).inviteId));
  app.post('/api/duo/leave', guard, async (request): Promise<DuoState> => leaveDuo(request.player!));
}
