import type { Player } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { env, ssoEnabled } from '../env.js';
import { playerStatus, upsertPlayer } from '../services/players.js';
import { ApiError } from './errors.js';
import { SSO_COOKIE, type SsoIdentity, verifySsoToken } from './sso.js';

/**
 * Two ways to be signed in, never both at once:
 *
 * - SSO (production): the ugolok.world hub's `ugolok_sso` cookie, verified with
 *   the shared secret. With SSO on it is the only session accepted — a cookie
 *   of our own would survive signing out at the hub, which cannot clear it.
 * - Local (development): our own signed `dc_session` cookie, set by the dev login.
 */
const LOCAL_COOKIE = 'dc_session';
const LOCAL_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function setLocalSession(reply: FastifyReply, playerId: string): void {
  reply.setCookie(LOCAL_COOKIE, `${playerId}.${Date.now() + LOCAL_TTL_MS}`, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.PUBLIC_WEB_URL.startsWith('https://'),
    maxAge: Math.floor(LOCAL_TTL_MS / 1000),
  });
}

export function clearLocalSession(reply: FastifyReply): void {
  reply.clearCookie(LOCAL_COOKIE, { path: '/' });
}

function readLocalSession(request: FastifyRequest): string | null {
  const raw = request.cookies[LOCAL_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  // @fastify/cookie splits its signature off at the last dot, so this one is ours.
  const dot = unsigned.value.lastIndexOf('.');
  if (dot < 1) return null;
  const expiresAt = Number(unsigned.value.slice(dot + 1));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return unsigned.value.slice(0, dot);
}

export function readSsoIdentity(request: FastifyRequest): SsoIdentity | null {
  if (!ssoEnabled) return null;
  return verifySsoToken(request.cookies[SSO_COOKIE], env.SSO_SECRET!);
}

/** The signed-in Player, or null. Creates the row on a first SSO visit. */
export async function currentPlayer(request: FastifyRequest): Promise<Player | null> {
  if (ssoEnabled) {
    const identity = readSsoIdentity(request);
    if (!identity) return null;
    const existing = await prisma.player.findUnique({ where: { discordId: identity.sub } });
    const unchanged = existing
      && existing.username === identity.username
      && existing.globalName === identity.name
      && existing.avatar === identity.avatar;
    if (unchanged) return existing;
    return upsertPlayer({
      discordId: identity.sub,
      username: identity.username,
      globalName: identity.name,
      avatar: identity.avatar,
    });
  }
  const id = readLocalSession(request);
  return id ? prisma.player.findUnique({ where: { id } }) : null;
}

/** preHandler: 401 unless signed in. */
export async function requirePlayer(request: FastifyRequest): Promise<void> {
  const player = await currentPlayer(request);
  if (!player) throw ApiError.unauthorized();
  request.player = player;
  // "Who's online" in the Tavern: a heartbeat at most once a minute.
  const now = new Date();
  if (!player.lastSeenAt || now.getTime() - player.lastSeenAt.getTime() > 60_000) {
    await prisma.player.update({ where: { id: player.id }, data: { lastSeenAt: now } });
  }
}

/** preHandler: signed in and approved by an admin. */
export async function requireApproved(request: FastifyRequest): Promise<void> {
  await requirePlayer(request);
  const status = playerStatus(request.player!);
  if (status !== 'approved') throw ApiError.forbidden(`player_${status}`, 'An admin has not approved this player');
}

/** preHandler: signed in as an admin. */
export async function requireAdmin(request: FastifyRequest): Promise<void> {
  await requirePlayer(request);
  if (!request.player!.isAdmin) throw ApiError.forbidden('not_admin', 'Admins only');
}

declare module 'fastify' {
  interface FastifyRequest {
    player?: Player;
  }
}
