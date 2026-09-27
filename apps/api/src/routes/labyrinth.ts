import type { FastifyInstance } from 'fastify';
import {
  type LabyrinthResult, enterRequestSchema, eventActionSchema, faceActionSchema, moveRequestSchema, stanceRequestSchema,
} from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import {
  actInEvent, ascend, descend, enterLabyrinth, face, labyrinthState, leaveByWaypoint, lootGrave, moveTo, readPortal, setStance,
} from '../services/labyrinth.js';

export async function labyrinthRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };

  app.get('/api/labyrinth', guard, async (request): Promise<LabyrinthResult> => labyrinthState(request.player!));

  app.post('/api/labyrinth/enter', guard, async (request): Promise<LabyrinthResult> => {
    const { floor, portal } = enterRequestSchema.parse(request.body);
    return enterLabyrinth(request.player!, floor, portal);
  });

  app.post('/api/labyrinth/move', guard, async (request): Promise<LabyrinthResult> => {
    const { to } = moveRequestSchema.parse(request.body);
    return moveTo(request.player!, to);
  });

  app.post('/api/labyrinth/face', guard, async (request): Promise<LabyrinthResult> =>
    face(request.player!, faceActionSchema.parse(request.body)));
  app.post('/api/labyrinth/stance', guard, async (request): Promise<LabyrinthResult> =>
    setStance(request.player!, stanceRequestSchema.parse(request.body).stance));
  app.post('/api/labyrinth/descend', guard, async (request): Promise<LabyrinthResult> => descend(request.player!));
  app.post('/api/labyrinth/ascend', guard, async (request): Promise<LabyrinthResult> => ascend(request.player!));
  app.post('/api/labyrinth/leave', guard, async (request): Promise<LabyrinthResult> => leaveByWaypoint(request.player!));
  app.post('/api/labyrinth/event', guard, async (request): Promise<LabyrinthResult> =>
    actInEvent(request.player!, eventActionSchema.parse(request.body)));
  app.post('/api/labyrinth/portal', guard, async (request): Promise<LabyrinthResult> => readPortal(request.player!));

  app.post<{ Params: { id: string } }>('/api/labyrinth/graves/:id/loot', guard, async (request): Promise<LabyrinthResult> =>
    lootGrave(request.player!, request.params.id));
}
