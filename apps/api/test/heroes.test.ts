import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { talentOffer } from '@dark/engine';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { gainXp } from '../src/services/progression.js';
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

  it('tells the creation screen which ability each Class fights with', async () => {
    const options = (await get('/api/heroes/options')).json();
    const primary = Object.fromEntries(options.classes.map((c: { id: string; primary: string }) => [c.id, c.primary]));
    expect(primary).toEqual({ fighter: 'str', rogue: 'dex', wizard: 'int', cleric: 'wis', barbarian: 'str', ranger: 'dex' });
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
    // Every Item says what it does: gear its fight numbers, a potion its use.
    const card = (slot: string) => hero.worn.find((w: { slot: string }) => w.slot === slot).item;
    expect(card('main').gear).toMatchObject({ group: 'blade', damage: { dice: 1, sides: 8, min: 1, max: 8, hits: 'slash' } });
    expect(card('body').gear).toMatchObject({ armor: { ac: 16, body: true, maxDex: 0 }, heavy: true });
    expect(hero.bag[0].about.en).toContain('Heals 2d4 + 2');

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

describe('growing a Hero', () => {
  const makeGarrick = async () => {
    await post('/api/heroes/draft');
    return (await post('/api/heroes', garrick)).json().hero;
  };

  it('chooses a Path once, from level 3, and only its own Class’s', async () => {
    await makeGarrick();
    expect((await post('/api/heroes/path', { path: 'champion' })).json().error).toBe('too_early');
    await prisma.hero.updateMany({ data: { level: 3 } });
    const me = (await get('/api/heroes/me')).json().hero;
    expect(me.pathChoices.map((p: { id: string }) => p.id)).toEqual(['champion', 'guardian']);
    expect((await post('/api/heroes/path', { path: 'assassin' })).json().error).toBe('wrong_class');
    const chosen = (await post('/api/heroes/path', { path: 'champion' })).json().hero;
    expect(chosen.path).toMatchObject({ id: 'champion' });
    expect(chosen.path.features.map((f: { unlocked: boolean }) => f.unlocked)).toEqual([true, false]);
    expect(chosen.pathChoices).toBeNull();
    expect((await post('/api/heroes/path', { path: 'guardian' })).json().error).toBe('path_chosen');
  });

  it('waits for a choice at each growth level: an ability, two, or an offered Talent', async () => {
    const hero = await makeGarrick();
    await prisma.hero.updateMany({ data: { level: 8 } });
    let me = (await get('/api/heroes/me')).json().hero;
    expect(me.pendingGrowth).toEqual([4, 8]);
    expect(me.talentOffer).toHaveLength(3);

    expect((await post('/api/heroes/grow', { level: 12, choice: { kind: 'ability', ability: 'str' } })).json().error).toBe('no_growth');
    me = (await post('/api/heroes/grow', { level: 4, choice: { kind: 'ability', ability: 'str' } })).json().hero;
    expect(me.abilities.str).toBe(hero.abilities.str + 2);
    expect(me.pendingGrowth).toEqual([8]);

    const offered = me.talentOffer.map((t: { id: string }) => t.id);
    const notOffered = ['iron-will', 'fireproof', 'scavenger', 'treasure-hunter', 'light-step', 'heavy-hitter', 'battle-hardened', 'lucky-charm']
      .find((t) => !offered.includes(t))!;
    expect((await post('/api/heroes/grow', { level: 8, choice: { kind: 'talent', talent: notOffered } })).json().error).toBe('invalid_growth');
    me = (await post('/api/heroes/grow', { level: 8, choice: { kind: 'talent', talent: offered[0] } })).json().hero;
    expect(me.talents).toContain(offered[0]);
    expect(me.pendingGrowth).toEqual([]);
    expect(me.talentOffer).toBeNull();
  });

  it('counts Tough for every level already gained', async () => {
    await makeGarrick();
    const hero = await prisma.hero.findFirstOrThrow();
    // Offers are fixed per Hero: give this one an id whose level-4 offer includes Tough (Items follow the id).
    let id = '';
    for (let i = 0; !talentOffer(id, 4, ['alert']).includes('tough'); i++) id = `tough-${i}`;
    await prisma.hero.update({ where: { id: hero.id }, data: { id, level: 4, talents: ['alert'] } });
    const response = await post('/api/heroes/grow', { level: 4, choice: { kind: 'talent', talent: 'tough' } });
    expect(response.statusCode, response.body).toBe(200);
    const after = response.json().hero;
    expect(after.maxHp).toBe(hero.maxHp + 8);
    expect(after.talents).toEqual(['alert', 'tough']);
  });

  it('says when XP makes a level ready, once, and never levels on its own', () => {
    expect(gainXp({ xp: 90, level: 1 }, 20)).toEqual({ data: { xp: 110 }, newLevel: 2 });
    expect(gainXp({ xp: 110, level: 1 }, 20)).toEqual({ data: { xp: 130 }, newLevel: null });
    expect(gainXp({ xp: 250, level: 1 }, 100)).toEqual({ data: { xp: 350 }, newLevel: 3 });
  });

  it('levels up by hand: the Heroes tab shows what the level gives, and the Player takes it', async () => {
    const hero = await makeGarrick();
    expect((await post('/api/heroes/level-up')).json().error).toBe('not_ready');

    await prisma.hero.updateMany({ data: { xp: 100 } });
    let me = (await get('/api/heroes/me')).json().hero;
    expect(me).toMatchObject({ level: 1, xpNext: 100, levelUp: { level: 2, choice: null, paths: null, talents: null } });
    expect(me.levelUp.gains[0].en).toMatch(/^Health: \+\d+ to \+\d+$/);

    const up = (await post('/api/heroes/level-up')).json();
    expect(up.hero).toMatchObject({ level: 2, levelUp: null, xpNext: 300 });
    expect(up.health.die).toBe(10);
    expect(up.hero.maxHp).toBe(hero.maxHp + up.health.gain);
    expect(await prisma.rollLog.count({ where: { kind: 'level-up' } })).toBe(1);

    // Level 3 asks for a Path and won't be taken without one; a wrong one changes nothing.
    await prisma.hero.updateMany({ data: { xp: 300 } });
    me = (await get('/api/heroes/me')).json().hero;
    expect(me.levelUp).toMatchObject({ level: 3, choice: 'path' });
    expect(me.levelUp.paths.map((p: { id: string }) => p.id)).toEqual(['champion', 'guardian']);
    expect((await post('/api/heroes/level-up')).json().error).toBe('choose_path');
    expect((await post('/api/heroes/level-up', { path: 'assassin' })).json().error).toBe('wrong_class');
    expect((await get('/api/heroes/me')).json().hero.level).toBe(2);
    const three = (await post('/api/heroes/level-up', { path: 'champion' })).json().hero;
    expect(three).toMatchObject({ level: 3, path: { id: 'champion' }, pathChoices: null, levelUp: null });
  });

  it('asks for abilities or a Talent with the level that grants them', async () => {
    const hero = await makeGarrick();
    await prisma.hero.updateMany({ data: { level: 3, path: 'champion', xp: 700 } });
    const me = (await get('/api/heroes/me')).json().hero;
    expect(me.levelUp).toMatchObject({ level: 4, choice: 'growth' });
    expect(me.levelUp.talents).toHaveLength(3);
    expect((await post('/api/heroes/level-up')).json().error).toBe('choose_growth');

    const lowest = Object.entries(hero.abilities as Record<string, number>).sort((a, b) => a[1] - b[1])[0]![0];
    const four = (await post('/api/heroes/level-up', { grow: { kind: 'ability', ability: lowest } })).json().hero;
    expect(four).toMatchObject({ level: 4, pendingGrowth: [], levelUp: null });
    expect(four.abilities[lowest]).toBe(hero.abilities[lowest] + 2);
  });

  it('fills health to what the gear allows', async () => {
    await makeGarrick();
    const hero = await prisma.hero.findFirstOrThrow();
    const armor = await prisma.item.findFirstOrThrow({ where: { place: 'WORN', slot: 'body' } });
    await prisma.item.update({ where: { id: armor.id }, data: { bonusStats: [{ stat: 'maxHp', value: 25 }] } });
    const me = (await get('/api/heroes/me')).json().hero;
    expect(me.maxHp).toBe(hero.maxHp + 25);
    expect(me.hp).toBe(hero.hp);
  });
});
