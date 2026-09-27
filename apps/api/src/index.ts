import { buildApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}
