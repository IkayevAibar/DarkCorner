import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { prisma } from '../src/db.js';

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Item", "HeroDraft", "Hero", "FeedEvent", "RollLog", "Job", "Season", "Player" RESTART IDENTITY CASCADE',
  );
}

/** The cookie header a response set, ready to send back on the next request. */
export function cookiesFrom(response: LightMyRequestResponse): string {
  return response.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function devLogin(app: FastifyInstance, name: string, admin = false): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/auth/dev-login', payload: { name, admin } });
  if (response.statusCode !== 200) throw new Error(`dev login failed: ${response.body}`);
  return cookiesFrom(response);
}
