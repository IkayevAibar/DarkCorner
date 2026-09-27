import type { FastifyInstance } from 'fastify';
import { type HeroResponse, equipRequestSchema, moveItemRequestSchema } from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { equipItem, moveItem, unequipItem } from '../services/inventory.js';

export async function itemRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  type ById = { Params: { id: string } };

  app.post<ById>('/api/items/:id/equip', guard, async (request): Promise<HeroResponse> => {
    const { slot } = equipRequestSchema.parse(request.body);
    return { hero: await equipItem(request.player!, request.params.id, slot) };
  });

  app.post<ById>('/api/items/:id/unequip', guard, async (request): Promise<HeroResponse> => ({
    hero: await unequipItem(request.player!, request.params.id),
  }));

  app.post<ById>('/api/items/:id/move', guard, async (request): Promise<HeroResponse> => {
    const { to } = moveItemRequestSchema.parse(request.body);
    return { hero: await moveItem(request.player!, request.params.id, to) };
  });
}
