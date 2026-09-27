import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  cookie = await devLogin(app, 'Owner', true);
});

const get = (url: string) => app.inject({ url, headers: { cookie } });
const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, headers: { cookie }, payload: payload ?? {} });

const garrick = {
  name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
};

describe('creating a Hero', () => {
  it('starts with nothing but the right to create one', async () => {
    const me = (await get('/api/heroes/me')).json();
    expect(me).toMatchObject({ season: 0, hero: null, draft: null, canCreate: true, canRetire: false });
  });

  it('rolls one set, allows three rerolls, then stops', async () => {
    const first = (await post('/api/heroes/draft')).json().draft;
    expect(first.sets).toHaveLength(1);
    expect(first.rerollsLeft).toBe(3);
    expect(first.sets[0].total).toBeGreaterThanOrEqual(65);

    // Asking again returns the same draft instead of fishing for new numbers.
    expect((await post('/api/heroes/draft')).json().draft).toEqual(first);

    for (let i = 0; i < 3; i++) expect((await post('/api/heroes/draft/reroll')).statusCode).toBe(200);
    const spent = await post('/api/heroes/draft/reroll');
    expect(spent.statusCode).toBe(409);
    expect(spent.json().error).toBe('no_rerolls');
    expect((await get('/api/heroes/me')).json().draft.sets).toHaveLength(4);
    expect(await prisma.rollLog.count({ where: { kind: 'abilities' } })).toBe(4);
  });

  it('creates the Hero with the chosen set and a Starter kit', async () => {
    const draft = (await post('/api/heroes/draft')).json().draft;
    const response = await post('/api/heroes', garrick);
    expect(response.statusCode).toBe(200);
    const { hero } = response.json();

    expect(hero).toMatchObject({ name: 'Garrick', race: 'human', class: 'fighter', level: 1, gold: 100, stamina: 20 });
    expect(hero.abilities).toEqual(draft.sets[0].scores);
    const conMod = Math.floor((draft.sets[0].scores.con - 10) / 2);
    expect(hero.maxHp).toBe(Math.max(1, 10 + conMod + 2));
    expect(hero.hp).toBe(hero.maxHp);

    const worn = Object.fromEntries(hero.worn.map((w: { slot: string; item: { base: string } }) => [w.slot, w.item.base]));
    expect(worn).toEqual({ main: 'longsword', off: 'shield', body: 'chainmail' });
    expect(hero.bag).toEqual([expect.objectContaining({ kind: 'potion', quantity: 2 })]);
    for (const w of hero.worn) expect(w.item).toMatchObject({ tier: 'common', identified: true, quality: 50 });

    expect((await get('/api/heroes/me')).json()).toMatchObject({ canCreate: false, canRetire: true, draft: null });
  });

  it('puts gear that finds no free slot into the Bag', async () => {
    await post('/api/heroes/draft');
    const { hero } = (await post('/api/heroes', {
      ...garrick, name: 'Pip', race: 'halfling', class: 'rogue', talents: ['lucky-charm'], portrait: 'hooded',
    })).json();
    expect(hero.worn.map((w: { slot: string }) => w.slot)).toEqual(['main', 'body']);
    expect(hero.bag.map((i: { base: string }) => i.base).sort()).toEqual(['potion', 'shortbow']);
  });

  it('refuses choices that do not make a Hero', async () => {
    await post('/api/heroes/draft');
    const oneTalentHuman = await post('/api/heroes', { ...garrick, talents: ['alert'] });
    expect(oneTalentHuman.json()).toMatchObject({ error: 'invalid_hero', details: ['talent_count'] });
    const wrongPortrait = await post('/api/heroes', { ...garrick, portrait: 'elf-wizard-1' });
    expect(wrongPortrait.json().error).toBe('bad_portrait');
    const noSuchSet = await post('/api/heroes', { ...garrick, set: 3 });
    expect(noSuchSet.json().error).toBe('bad_set');
  });

  it('needs a draft first, and only one Hero at a time', async () => {
    expect((await post('/api/heroes', garrick)).json().error).toBe('no_draft');
    await post('/api/heroes/draft');
    expect((await post('/api/heroes', garrick)).statusCode).toBe(200);
    expect((await post('/api/heroes/draft')).json().error).toBe('cannot_create');
  });

  it('keeps Players who are not approved out', async () => {
    const friend = await devLogin(app, 'Stranger');
    const response = await app.inject({ url: '/api/heroes/me', headers: { cookie: friend } });
    expect(response.statusCode).toBe(403);
  });
});

describe('retiring', () => {
  it('moves everything to Storage, then lets the next Hero inherit it, once per Season', async () => {
    await post('/api/heroes/draft');
    await post('/api/heroes', garrick);

    const afterRetire = (await post('/api/heroes/retire')).json();
    expect(afterRetire).toMatchObject({ hero: null, canCreate: true, canRetire: false });

    await post('/api/heroes/draft');
    const { hero } = (await post('/api/heroes', {
      ...garrick, name: 'Elowen', race: 'elf', class: 'wizard', talents: ['alert'], portrait: 'elf-wizard-1',
    })).json();
    expect(hero.gold).toBe(200);
    expect(hero.storage.map((i: { base: string }) => i.base).sort()).toEqual(['chainmail', 'longsword', 'potion', 'shield']);
    expect(hero.worn.map((w: { item: { base: string } }) => w.item.base)).toEqual(['staff', 'orb', 'robes']);

    const again = await post('/api/heroes/retire');
    expect(again.json().error).toBe('retire_used');
  });
});
