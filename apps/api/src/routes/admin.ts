import type { FastifyInstance } from 'fastify';
import {
  type AdminPlayersResponse, type AdminSeasonView, type RollLogView, adminGrantSchema, adminPlayerDecisionSchema,
  adminSeasonActionSchema,
} from '@dark/shared';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { requireAdmin } from '../lib/session.js';
import { adminSeasonView, grant, rollLog } from '../services/admin.js';
import { toAdminPlayer } from '../services/players.js';
import { announceVault, discardSeason, endSeason, openGateNow, startSeason } from '../services/seasonLife.js';
import { runDueJobs } from '../services/scheduler.js';
import { currentSeason } from '../services/seasons.js';

export async function adminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireAdmin };

  app.get('/api/admin/players', guard, async (): Promise<AdminPlayersResponse> => {
    const players = await prisma.player.findMany({ orderBy: [{ approvedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }] });
    return { players: players.map(toAdminPlayer) };
  });

  app.post<{ Params: { id: string } }>('/api/admin/players/:id', guard, async (request) => {
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

  app.get('/api/admin/season', guard, async (): Promise<AdminSeasonView> => adminSeasonView());

  /** Season controls. Jobs that fall due are run straight away, so the result shows at once. */
  app.post('/api/admin/season', guard, async (request): Promise<AdminSeasonView> => {
    const { action, minutes } = adminSeasonActionSchema.parse(request.body);
    const season = await currentSeason();
    if (action === 'start') await startSeason();
    if (action === 'end') await endSeason(season.id);
    if (action === 'discard') await discardSeason(season.id);
    if (action === 'gate') await openGateNow();
    if (action === 'vault') {
      const announced = await announceVault(season, new Date(), minutes ?? 0);
      if (!announced) throw ApiError.conflict('no_vault_floor', 'No Floor has been reached by enough Heroes yet');
    }
    await runDueJobs();
    return adminSeasonView();
  });

  app.post('/api/admin/grant', guard, async (request) => {
    await grant(adminGrantSchema.parse(request.body));
    return { ok: true };
  });

  app.get<{ Querystring: { kind?: string; player?: string; limit?: string } }>('/api/admin/rolls', guard, async (request): Promise<RollLogView> =>
    rollLog({ kind: request.query.kind, playerId: request.query.player, limit: request.query.limit ? Number(request.query.limit) : undefined }));
}
