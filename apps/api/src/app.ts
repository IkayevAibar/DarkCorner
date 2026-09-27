import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { accountOrigin, env } from './env.js';
import { ApiError } from './lib/errors.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { cityRoutes } from './routes/city.js';
import { heroRoutes } from './routes/heroes.js';
import { itemRoutes } from './routes/items.js';
import { labyrinthRoutes } from './routes/labyrinth.js';
import { meRoutes } from './routes/me.js';

/** Builds the server without listening, so tests can drive it with inject(). */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'test'
      ? false
      : { level: env.NODE_ENV === 'production' ? 'info' : 'debug', transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined },
    trustProxy: true,
  });

  // A POST with no body is fine here; Fastify's stock parser would 400 it.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : '';
    if (raw === '') return done(null, {});
    try {
      done(null, JSON.parse(raw));
    } catch {
      done(new ApiError(400, 'invalid_json', 'Request body is not valid JSON'), undefined);
    }
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });

  // The web app is same-origin in production (nginx proxies /api). The hub's
  // account page is not: it reads /api/sso/summary cross-origin with the shared
  // cookie, so its origin is listed explicitly — never reflected.
  await app.register(cors, { origin: [env.PUBLIC_WEB_URL, accountOrigin], credentials: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'validation_failed',
        message: 'Request body or query is invalid',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if ((error as { statusCode?: number }).statusCode === 400) {
      return reply.status(400).send({ error: 'bad_request', message: (error as Error).message });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: 'internal_error', message: 'Something went wrong' });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: 'not_found', message: `No route for ${request.method} ${request.url}` }),
  );

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes);
  await app.register(heroRoutes);
  await app.register(itemRoutes);
  await app.register(labyrinthRoutes);
  await app.register(cityRoutes);

  return app;
}
