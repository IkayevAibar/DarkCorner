import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(resetDatabase);

describe('without SSO (local development)', () => {
  it('offers the dev login', async () => {
    const response = await app.inject({ url: '/auth/status' });
    expect(response.json()).toEqual({ sso: false, loginUrl: null, logoutUrl: null, devLogin: true });
  });

  it('rejects /api/me without a session', async () => {
    const response = await app.inject({ url: '/api/me' });
    expect(response.statusCode).toBe(401);
  });

  it('makes a new Player wait for approval', async () => {
    const cookie = await devLogin(app, 'Garrick');
    const me = await app.inject({ url: '/api/me', headers: { cookie } });
    expect(me.json().player).toMatchObject({ name: 'Garrick', status: 'pending', isAdmin: false, locale: null });
  });

  /** What went to the friends' Discord channel, in English. */
  const said = async () => (await prisma.job.findMany({ where: { kind: 'broadcast' }, orderBy: { id: 'asc' } }))
    .map((j) => (j.payload as { text: { en: string } }).text.en);

  it('tells the channel when someone waits at the gate, and when they are let in', async () => {
    const admin = await devLogin(app, 'Owner', true);
    await devLogin(app, 'Pip');
    await devLogin(app, 'Pip');
    // The admin walks straight in; Pip waits, and is announced once however often Pip signs in.
    expect(await said()).toEqual(['🚪 Pip is waiting at the Labyrinth gate. An admin can let them in: Account → Admin: Players.']);

    const pip = await prisma.player.findFirstOrThrow({ where: { username: 'Pip' } });
    const approve = () => app.inject({
      method: 'POST', url: `/api/admin/players/${pip.id}`, headers: { cookie: admin }, payload: { decision: 'approve' },
    });
    await approve();
    await approve();
    expect((await said()).slice(1)).toEqual(['⚔️ The gate opens for Pip. Welcome to the Labyrinth!']);
  });

  it('lets an admin approve a Player, who then counts as approved', async () => {
    const admin = await devLogin(app, 'Owner', true);
    const friend = await devLogin(app, 'Pip');

    const list = await app.inject({ url: '/api/admin/players', headers: { cookie: admin } });
    expect(list.statusCode).toBe(200);
    const pip = list.json().players.find((p: { name: string }) => p.name === 'Pip');
    expect(pip.status).toBe('pending');

    const decided = await app.inject({
      method: 'POST', url: `/api/admin/players/${pip.id}`, headers: { cookie: admin }, payload: { decision: 'approve' },
    });
    expect(decided.json().player.status).toBe('approved');

    const me = await app.inject({ url: '/api/me', headers: { cookie: friend } });
    expect(me.json().player.status).toBe('approved');
  });

  it('keeps the admin list for admins', async () => {
    const friend = await devLogin(app, 'Pip');
    const response = await app.inject({ url: '/api/admin/players', headers: { cookie: friend } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('not_admin');
  });

  it('stops an admin from banning themselves', async () => {
    const admin = await devLogin(app, 'Owner', true);
    const me = await app.inject({ url: '/api/me', headers: { cookie: admin } });
    const response = await app.inject({
      method: 'POST', url: `/api/admin/players/${me.json().player.id}`, headers: { cookie: admin }, payload: { decision: 'ban' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('saves the language', async () => {
    const cookie = await devLogin(app, 'Elowen');
    const response = await app.inject({ method: 'PATCH', url: '/api/me', headers: { cookie }, payload: { locale: 'ru' } });
    expect(response.json().player.locale).toBe('ru');
  });

  it('validates the dev login body', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/dev-login', payload: { name: 'x' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('validation_failed');
  });
});
