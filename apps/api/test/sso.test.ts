import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './helpers.js';

// SSO is read from the environment when the modules load, so switch it on first.
const SECRET = 'test-sso-secret-that-is-long-enough-0123456789';
process.env.SSO_SECRET = SECRET;
const { buildApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');
const { mintSsoToken, SSO_COOKIE } = await import('../src/lib/sso.js');

let app: FastifyInstance;

const cookieFor = (sub: string, secret = SECRET) =>
  `${SSO_COOKIE}=${mintSsoToken({ sub, username: `user${sub.slice(-3)}`, name: 'Friend', avatar: null }, secret)}`;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(resetDatabase);

describe('with SSO (production)', () => {
  it('sends sign-in to the hub and hides the dev login', async () => {
    const status = (await app.inject({ url: '/auth/status' })).json();
    expect(status.sso).toBe(true);
    expect(status.devLogin).toBe(false);
    expect(status.loginUrl).toContain('/sso/login?next=');
    const devLogin = await app.inject({ method: 'POST', url: '/auth/dev-login', payload: { name: 'Sneaky' } });
    expect(devLogin.statusCode).toBe(404);
  });

  it('answers the hub without creating a Player', async () => {
    const response = await app.inject({ url: '/api/sso/summary', headers: { cookie: cookieFor('222222222222222222') } });
    expect(response.json()).toEqual({ registered: false, profile: null });
    expect(await prisma.player.count()).toBe(0);
  });

  it('creates the Player on their first real visit', async () => {
    const cookie = cookieFor('222222222222222222');
    const me = await app.inject({ url: '/api/me', headers: { cookie } });
    expect(me.json().player).toMatchObject({ name: 'Friend', status: 'pending' });
    expect(me.json().player.avatarUrl).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);

    const summary = await app.inject({ url: '/api/sso/summary', headers: { cookie } });
    expect(summary.json()).toEqual({ registered: true, profile: { name: 'Friend', status: 'pending', hero: null } });
  });

  it('approves configured admins at once', async () => {
    const me = await app.inject({ url: '/api/me', headers: { cookie: cookieFor('111111111111111111') } });
    expect(me.json().player).toMatchObject({ isAdmin: true, status: 'approved' });
  });

  it('rejects a cookie signed with another secret', async () => {
    const bad = cookieFor('222222222222222222', 'some-other-secret-that-is-also-long-enough-99');
    expect((await app.inject({ url: '/api/me', headers: { cookie: bad } })).statusCode).toBe(401);
  });

  it('asks the hub to finish signing out', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(response.json().redirect).toContain('/sso/logout?next=');
  });
});
