import type { Player } from '@prisma/client';
import { prisma } from '../db.js';
import { gameNow } from '../gameClock.js';
import type { SoloRequest } from '../router.js';
import { playerStatus } from '../services/players.js';
import { ApiError } from './errors.js';

/**
 * Solo has one Player, made with the World, and it is always signed in: no
 * sign-in hub, no approval (the server's lib/session.ts, without them).
 *
 * The scenarios ported from the server play several Players at once; they send a
 * `solo_player=<id>` cookie, which only tests ever do.
 */
export async function currentPlayer(request?: Pick<SoloRequest, 'headers'>): Promise<Player | null> {
  const chosen = /(?:^|;\s*)solo_player=([^;]+)/.exec(request?.headers.cookie ?? '')?.[1];
  if (chosen) return prisma.player.findUnique({ where: { id: decodeURIComponent(chosen) } });
  return prisma.player.findFirst({ orderBy: { createdAt: 'asc' } });
}

/** preHandler: the World's Player. */
export async function requirePlayer(request: SoloRequest): Promise<void> {
  const player = await currentPlayer(request);
  if (!player) throw ApiError.unauthorized();
  request.player = player;
  // "Who's online" in the Tavern: a heartbeat at most once a minute.
  const now = gameNow();
  if (!player.lastSeenAt || now.getTime() - player.lastSeenAt.getTime() > 60_000) {
    await prisma.player.update({ where: { id: player.id }, data: { lastSeenAt: now } });
  }
}

/** preHandler: the World's Player, who is approved from the start. */
export async function requireApproved(request: SoloRequest): Promise<void> {
  await requirePlayer(request);
  const status = playerStatus(request.player!);
  if (status !== 'approved') throw ApiError.forbidden(`player_${status}`, 'An admin has not approved this player');
}

/** preHandler: admins only. The solo Player is not one. */
export async function requireAdmin(request: SoloRequest): Promise<void> {
  await requirePlayer(request);
  if (!request.player!.isAdmin) throw ApiError.forbidden('not_admin', 'Admins only');
}
