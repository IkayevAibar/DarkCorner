import type { FastifyInstance } from 'fastify';
import { type AdminPlayersResponse, adminPlayerDecisionSchema } from '@dark/shared';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { requireAdmin } from '../lib/session.js';
import { toAdminPlayer } from '../services/players.js';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/admin/players', { preHandler: requireAdmin }, async (): Promise<AdminPlayersResponse> => {
    const players = await prisma.player.findMany({ orderBy: [{ approvedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }] });
    return { players: players.map(toAdminPlayer) };
  });

  app.post<{ Params: { id: string } }>('/api/admin/players/:id', { preHandler: requireAdmin }, async (request) => {
    const { decision } = adminPlayerDecisionSchema.parse(request.body);
    const target = await prisma.player.findUnique({ where: { id: request.params.id } });
    if (!target) throw ApiError.notFound('player_not_found', 'No such player');
    if (target.id === request.player!.id && decision !== 'approve') {
      throw ApiError.badRequest('cannot_demote_self', 'You cannot ban or reset yourself');
    }
    const now = new Date();
    const data = {
      approve: { approvedAt: target.approvedAt ?? now, bannedAt: null },
      ban: { bannedAt: now },
      reset: { approvedAt: null, bannedAt: null },
    }[decision];
    const player = await prisma.player.update({ where: { id: target.id }, data });
    return { player: toAdminPlayer(player) };
  });
}
