import { describe, expect, it } from 'vitest';
import { STARTING_GOLD } from '@dark/engine';
import type { MyHeroResponse } from '@dark/shared';
import { type Backend, bindWorld, createBackend } from '../src/backend.js';
import { prisma } from '../src/db.js';
import { useSettings } from '../src/settings.js';
import { monsterOmen } from '../src/services/difficulty.js';
import { die, emptyOutcome } from '../src/services/fights.js';
import { memoryStorage } from '../src/storage.js';

// A Save's own settings (docs/plan-solo-offline.md, decisions 5 and 6): Story,
// Normal or Hard, and Iron mode, chosen before the first Hero.

async function call<T = unknown>(backend: Backend, method: string, url: string, body?: unknown): Promise<T> {
  const response = await backend.handle(method, url, body);
  if (response.status !== 200) throw new Error(`${method} ${url} -> ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as T;
}

async function newHero(backend: Backend, name = 'Garrick') {
  await call(backend, 'POST', '/api/heroes/draft');
  return call(backend, 'POST', '/api/heroes', {
    name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
}

/** Kills the Hero where it stands, as a lost fight would. */
async function killHero(backend: Backend) {
  bindWorld(backend.world);
  const hero = await prisma.hero.findFirstOrThrow({ where: { retiredAt: null }, include: { items: true } });
  const season = await prisma.season.findFirstOrThrow();
  const out = emptyOutcome();
  await prisma.$transaction((tx) => die(tx, hero, season, 1, 0, out));
  return out;
}

describe('difficulty', () => {
  it('lays Story or Hard over the day’s Omen, for monsters only', () => {
    const season = { seed: 'any', status: 'ACTIVE' as const };
    try {
      useSettings({ difficulty: 'normal', iron: false });
      // Normal is the day's own Omen, whatever it is.
      const normal = monsterOmen(season);
      useSettings({ difficulty: 'story', iron: false });
      const story = monsterOmen(season);
      expect(story?.monsterHp).toBeCloseTo((normal?.monsterHp ?? 1) * 0.75);
      expect(story?.monsterDamage).toBeCloseTo((normal?.monsterDamage ?? 1) * 0.75);
      useSettings({ difficulty: 'hard', iron: false });
      expect(monsterOmen(season)?.monsterHp).toBeCloseTo((normal?.monsterHp ?? 1) * 1.25);
    } finally {
      useSettings({ difficulty: 'normal', iron: false });
    }
  });

  it('is chosen before the first Hero, saved with the World, and fixed once a Hero is made', async () => {
    const storage = memoryStorage();
    const backend = await createBackend({ storage });
    expect(await call(backend, 'GET', '/api/solo/settings')).toEqual({ difficulty: 'normal', iron: false, locked: false });
    expect(await call(backend, 'PUT', '/api/solo/settings', { difficulty: 'hard', iron: true })).toEqual({ difficulty: 'hard', iron: true, locked: false });
    // Saved: a reload finds it.
    const reloaded = await createBackend({ storage: memoryStorage(storage.text) });
    expect(reloaded.world.settings).toEqual({ difficulty: 'hard', iron: true });

    await newHero(reloaded);
    expect(await call(reloaded, 'GET', '/api/solo/settings')).toMatchObject({ locked: true });
    expect((await reloaded.handle('PUT', '/api/solo/settings', { difficulty: 'story', iron: false })).body).toMatchObject({ error: 'settings_locked' });
    expect(reloaded.world.settings).toEqual({ difficulty: 'hard', iron: true });
  });
});

describe('Iron mode', () => {
  it('lets a Hero live once: the next keeps the gold and Storage, and the fallen don’t count toward the two', async () => {
    const backend = await createBackend({ storage: memoryStorage(), settings: { iron: true } });
    await newHero(backend, 'Brakka');
    bindWorld(backend.world);
    const first = await prisma.hero.findFirstOrThrow();
    await prisma.hero.update({ where: { id: first.id }, data: { gold: 300 } });
    await prisma.item.create({ data: { heroId: first.id, seasonId: first.seasonId, place: 'STORAGE', base: 'potion', quantity: 3, tier: 'common', identified: true } });

    const out = await killHero(backend);
    expect(out.died).toBe(true);
    expect(out.notices.at(-1)?.en).toMatch(/^You died, and in Iron mode a Hero lives once: Brakka's story ends here\./);
    const gone = await prisma.hero.findUniqueOrThrow({ where: { id: first.id } });
    expect(gone.retiredAt).not.toBeNull();
    expect(gone.hp).toBe(0);
    // Its Grave waits, for the next Hero to find.
    expect(await prisma.grave.count({ where: { heroId: first.id } })).toBe(1);

    expect(await call<MyHeroResponse>(backend, 'GET', '/api/heroes/me')).toMatchObject({ hero: null, canCreate: true });
    await newHero(backend, 'Second');
    bindWorld(backend.world);
    const second = await prisma.hero.findFirstOrThrow({ where: { retiredAt: null } });
    expect(second.gold).toBe(STARTING_GOLD + 300);
    expect(await prisma.item.count({ where: { heroId: second.id, place: 'STORAGE', base: 'potion' } })).toBe(1);

    // A fall doesn't use up the Chapter's Heroes: a third may follow the second.
    await killHero(backend);
    expect(await call<MyHeroResponse>(backend, 'GET', '/api/heroes/me')).toMatchObject({ hero: null, canCreate: true });
    await newHero(backend, 'Third');
    expect((await call<MyHeroResponse>(backend, 'GET', '/api/heroes/me')).hero?.name).toBe('Third');
  });

  it('leaves death as it was without Iron mode: the Hero wakes at the Temple', async () => {
    const backend = await createBackend({ storage: memoryStorage() });
    await newHero(backend, 'Brakka');
    const out = await killHero(backend);
    expect(out.notices.at(-1)?.en).toMatch(/^You died\. Everything you carried lies in a Grave for two nights\./);
    expect((await call<MyHeroResponse>(backend, 'GET', '/api/heroes/me')).hero?.name).toBe('Brakka');
  });
});
