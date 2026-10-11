import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Backend, type SaveFileView, type SaveSummary, createBackend } from '../src/backend.js';
import { memoryStorage } from '../src/storage.js';
import { WORLD_VERSION, parseWorld, serializeWorld } from '../src/world.js';

// Saves outlive builds (docs/architecture.md → The solo game). test/saves keeps Saves
// from each release, written by the bots (PLAYTEST_SAVES); every later build must load
// each one and play on. parseWorld fits an older Save to the schema where the schema
// gives defaults; a change it can't fit needs a migration there.

const DIR = path.join(import.meta.dirname, 'saves');
const RELEASED = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

/** What the screens ask the backend for. */
const SCREENS = [
  '/api/me', '/api/heroes/me', '/api/labyrinth', '/api/tavern', '/api/tavern/lodging', '/api/tavern/bounties', '/api/tavern/rankings',
  '/api/hall', '/api/shop', '/api/forge', '/api/temple', '/api/academy', '/api/training', '/api/steps', '/api/delve', '/api/companion',
  '/api/chapter', '/api/solo/settings',
];

async function call<T = unknown>(backend: Backend, method: string, url: string, body?: unknown): Promise<T> {
  const response = await backend.handle(method, url, body);
  if (response.status !== 200) throw new Error(`${method} ${url} -> ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as T;
}

async function withHero(name: string, seed: string): Promise<Backend> {
  const backend = await createBackend({ storage: memoryStorage(), seed });
  await call(backend, 'POST', '/api/heroes/draft');
  await call(backend, 'POST', '/api/heroes', {
    name, race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
  return backend;
}

describe('Saves from released builds', () => {
  it('are kept', () => expect(RELEASED.length).toBeGreaterThan(0));

  for (const file of RELEASED) {
    it(`${file} loads, answers every screen, and sleeps a night`, async () => {
      const storage = memoryStorage(fs.readFileSync(path.join(DIR, file), 'utf8'));
      const backend = await createBackend({ storage });
      for (const url of SCREENS) expect((await backend.handle('GET', url)).status, url).toBe(200);
      const { hero } = await call<{ hero: { inCity: boolean } | null }>(backend, 'GET', '/api/heroes/me');
      expect(hero).not.toBeNull();
      const night = backend.world.clock.now;
      await call(backend, 'POST', hero!.inCity ? '/api/tavern/lodging' : '/api/labyrinth/sleep');
      expect(backend.world.clock.now).toBeGreaterThan(night);
      expect(parseWorld(storage.text!).version).toBe(WORLD_VERSION);
    });
  }
});

describe('the Save as a file', () => {
  it('goes out whole, and comes back in the place of the game on the device', async () => {
    const kept = await withHero('Garrick', 'file-out');
    const file = await call<SaveFileView>(kept, 'GET', '/api/save');
    expect(file.name).toBe('dark-corner-day-1.json');
    expect(file.summary).toMatchObject({ day: 1, chapter: 1, hero: { name: 'Garrick', level: 1, class: 'fighter' }, difficulty: 'normal', iron: false });

    const storage = memoryStorage();
    const phone = await createBackend({ storage, seed: 'file-in' });
    expect((await call<{ summary: SaveSummary }>(phone, 'POST', '/api/save/check', { text: file.text })).summary).toEqual(file.summary);
    // Checked only: the phone's own game stands.
    expect((await call<{ hero: unknown }>(phone, 'GET', '/api/heroes/me')).hero).toBeNull();

    await call(phone, 'POST', '/api/save', { text: file.text });
    expect((await call<{ hero: { name: string } }>(phone, 'GET', '/api/heroes/me')).hero.name).toBe('Garrick');
    expect(parseWorld(storage.text!).db.tables.Hero!.map((h) => h.name)).toEqual(['Garrick']);
    // And it plays on from there.
    await call(phone, 'POST', '/api/tavern/lodging');
    expect((await call<SaveFileView>(phone, 'GET', '/api/save')).summary.day).toBe(2);
  });

  it('refuses what isn’t a Save, and a Save from a newer build, and keeps the game it has', async () => {
    const storage = memoryStorage();
    const phone = await createBackend({ storage, seed: 'file-refused' });
    const before = storage.text;
    const newer = JSON.parse((await call<SaveFileView>(phone, 'GET', '/api/save')).text) as { version: number };
    for (const [text, code] of [
      ['not json', 'not_a_save'],
      ['{"hero":"Garrick"}', 'not_a_save'],
      [JSON.stringify({ ...newer, version: WORLD_VERSION + 1 }), 'newer_save'],
      [undefined, 'not_a_save'],
    ] as const) {
      const response = await phone.handle('POST', '/api/save', { text });
      expect(response.status).toBe(400);
      expect((response.body as { error: string }).error).toBe(code);
    }
    expect(storage.text).toBe(before);
  });
});

describe('a Save from an older build', () => {
  it('takes the fields added since with their defaults, and drops what the schema dropped', async () => {
    const backend = await withHero('Garrick', 'older');
    const old = JSON.parse(serializeWorld(backend.world)) as { db: { tables: Record<string, Record<string, unknown>[]> } };
    const hero = old.db.tables.Hero![0]!;
    delete hero.stance;
    delete hero.academy;
    delete hero.training;
    hero.oldThing = 3;
    old.db.tables.Gone = [{ id: 'x' }];
    delete old.db.tables.RelicFind;

    const world = parseWorld(JSON.stringify(old));
    expect(world.db.tables.Hero![0]).toMatchObject({ name: 'Garrick', stance: 'steady', academy: [], training: null });
    expect(world.db.tables.Hero![0]).not.toHaveProperty('oldThing');
    expect(world.db.tables).not.toHaveProperty('Gone');
    expect(world.db.tables.RelicFind).toEqual([]);

    // A new field with no default has to be migrated by hand.
    delete hero.name;
    expect(() => parseWorld(JSON.stringify(old))).toThrow(/Hero\.name/);
  });
});
