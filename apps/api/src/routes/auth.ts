import type { FastifyInstance } from 'fastify';
import { type AuthStatus, type LogoutResponse, type SsoSummary, devLoginRequestSchema } from '@dark/shared';
import { prisma } from '../db.js';
import { accountLoginUrl, accountOrigin, devLoginEnabled, env, ssoEnabled } from '../env.js';
import { ApiError } from '../lib/errors.js';
import { clearLocalSession, readSsoIdentity, setLocalSession } from '../lib/session.js';
import { playerStatus, toPlayerView, upsertPlayer } from '../services/players.js';

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/status', async (): Promise<AuthStatus> => ({
    sso: ssoEnabled,
    loginUrl: ssoEnabled ? accountLoginUrl(env.PUBLIC_WEB_URL) : null,
    logoutUrl: ssoEnabled ? `${accountOrigin}/sso/logout?next=${encodeURIComponent(env.PUBLIC_WEB_URL)}` : null,
    devLogin: devLoginEnabled,
  }));

  /**
   * Local development only: become any Player without Discord. `admin` makes
   * that Player an approved admin, so the approval flow can be tested from both
   * sides with two browser profiles.
   */
  app.post('/auth/dev-login', async (request, reply) => {
    if (!devLoginEnabled) throw ApiError.notFound('not_found', 'No such route');
    const body = devLoginRequestSchema.parse(request.body);
    const player = await upsertPlayer(
      { discordId: `dev-${slug(body.name)}`, username: body.name, globalName: null, avatar: null },
      { admin: body.admin },
    );
    setLocalSession(reply, player.id);
    return { player: toPlayerView(player) };
  });

  app.post('/auth/logout', async (_request, reply): Promise<LogoutResponse> => {
    clearLocalSession(reply);
    // The SSO cookie belongs to the hub's parent domain; only the hub can clear it.
    return {
      ok: true,
      redirect: ssoEnabled ? `${accountOrigin}/sso/logout?next=${encodeURIComponent(env.PUBLIC_WEB_URL)}` : null,
    };
  });

  /**
   * For the hub's account dashboard: a cross-origin read with the shared cookie.
   * Deliberately never creates a Player — opening the dashboard is not playing.
   */
  app.get('/api/sso/summary', async (request): Promise<SsoSummary> => {
    const identity = readSsoIdentity(request);
    if (!identity) throw ApiError.unauthorized();
    const player = await prisma.player.findUnique({ where: { discordId: identity.sub } });
    if (!player) return { registered: false, profile: null };
    return { registered: true, profile: { name: toPlayerView(player).name, status: playerStatus(player) } };
  });
}
