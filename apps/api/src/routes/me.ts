import type { FastifyInstance } from 'fastify';
import { type MeResponse, updateMeRequestSchema } from '@dark/shared';
import { prisma } from '../db.js';
import { requirePlayer } from '../lib/session.js';
import { toPlayerView } from '../services/players.js';

export async function meRoutes(app: FastifyInstance) {
  app.get('/api/me', { preHandler: requirePlayer }, async (request): Promise<MeResponse> => ({
    player: toPlayerView(request.player!),
  }));

  app.patch('/api/me', { preHandler: requirePlayer }, async (request): Promise<MeResponse> => {
    const body = updateMeRequestSchema.parse(request.body);
    const player = await prisma.player.update({ where: { id: request.player!.id }, data: { locale: body.locale } });
    return { player: toPlayerView(player) };
  });
}
