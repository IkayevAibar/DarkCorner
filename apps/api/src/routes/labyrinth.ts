import type { FastifyInstance } from 'fastify';
import {
  type LabyrinthResult, chestPickRequestSchema, enterRequestSchema, eventActionSchema, faceActionSchema, fightActionRequestSchema, moveRequestSchema, walkRequestSchema,
  oathRequestSchema, stanceRequestSchema,
} from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import {
  actInEvent, actInFight, ascend, descend, enterLabyrinth, face, labyrinthState, leaveByWaypoint, lootGrave, moveTo, pickFromChest, readPortal, setStance, walkRoute,
  shortRest, swearOath,
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

  /** A Route picked on the Map, walked Door by Door until it ends or something happens. */
  app.post('/api/labyrinth/walk', guard, async (request): Promise<LabyrinthResult> => {
    const { route } = walkRequestSchema.parse(request.body);
    return walkRoute(request.player!, route);
  });

  app.post('/api/labyrinth/face', guard, async (request): Promise<LabyrinthResult> =>
    face(request.player!, faceActionSchema.parse(request.body)));
  /** A choice for the Hero's turn in a fight played turn by turn. */
  app.post('/api/labyrinth/fight', guard, async (request): Promise<LabyrinthResult> =>
    actInFight(request.player!, fightActionRequestSchema.parse(request.body).action));
  /** A secret oath at an Oathstone: share, or take. */
  app.post('/api/labyrinth/oath', guard, async (request): Promise<LabyrinthResult> =>
    swearOath(request.player!, oathRequestSchema.parse(request.body).choice));
  /** A pick from the Duo Chest, on this Player's turn. */
  app.post('/api/labyrinth/chest', guard, async (request): Promise<LabyrinthResult> =>
    pickFromChest(request.player!, chestPickRequestSchema.parse(request.body).index));
  app.post('/api/labyrinth/stance', guard, async (request): Promise<LabyrinthResult> =>
    setStance(request.player!, stanceRequestSchema.parse(request.body).stance));
  app.post('/api/labyrinth/descend', guard, async (request): Promise<LabyrinthResult> => descend(request.player!));
  app.post('/api/labyrinth/ascend', guard, async (request): Promise<LabyrinthResult> => ascend(request.player!));
  app.post('/api/labyrinth/leave', guard, async (request): Promise<LabyrinthResult> => leaveByWaypoint(request.player!));
  app.post('/api/labyrinth/event', guard, async (request): Promise<LabyrinthResult> =>
    actInEvent(request.player!, eventActionSchema.parse(request.body)));
  app.post('/api/labyrinth/portal', guard, async (request): Promise<LabyrinthResult> => readPortal(request.player!));
  app.post('/api/labyrinth/short-rest', guard, async (request): Promise<LabyrinthResult> => shortRest(request.player!));

  app.post<{ Params: { id: string } }>('/api/labyrinth/graves/:id/loot', guard, async (request): Promise<LabyrinthResult> =>
    lootGrave(request.player!, request.params.id));
}
