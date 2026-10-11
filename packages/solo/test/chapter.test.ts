import { describe, expect, it } from 'vitest';
import { generateLabyrinth } from '@dark/engine';
import { type Backend, bindWorld, createBackend } from '../src/backend.js';
import { prisma } from '../src/db.js';
import { memoryStorage } from '../src/storage.js';
import { bossVictory } from '../src/services/boss.js';
import type { ChapterView } from '../src/services/chapters.js';
import { emptyOutcome } from '../src/services/fights.js';

// The Chapter's end (docs/design.md → The solo game → Chapters): the Dragon's first fall
// completes the Chapter, cuts its records into the Hall of Fame, and its end screen tells
// the Chapter whole, once by itself.

const SEED = 'chapter-end';
const lair = generateLabyrinth(SEED).floors[9]!.rooms.find((r) => r.type === 'boss')!.id;

async function call<T = unknown>(backend: Backend, method: string, url: string, body?: unknown): Promise<T> {
  const response = await backend.handle(method, url, body);
  if (response.status !== 200) throw new Error(`${method} ${url} -> ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as T;
}
const chapter = (backend: Backend) => call<ChapterView>(backend, 'GET', '/api/chapter');

async function withHero(): Promise<Backend> {
  const backend = await createBackend({ storage: memoryStorage(), seed: SEED });
  await call(backend, 'POST', '/api/heroes/draft');
  await call(backend, 'POST', '/api/heroes', {
    name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'], portrait: 'human-fighter-1', banner: '#9e2a2a', set: 0,
  });
  return backend;
}

describe('the Chapter’s end', () => {
  it('tells the Chapter so far while the Dragon waits', async () => {
    const backend = await withHero();
    const view = await chapter(backend);
    expect(view).toMatchObject({ number: 1, day: 1, complete: false, seen: false, end: null, hall: [] });
    expect(view.tally).toMatchObject({ days: 1, heroes: 1, deepest: 0, level: 1, deaths: 0, relics: 0, finest: { tier: 'common' } });
  });

  it('comes with the Dragon’s first fall: the Champion, its records in the Hall, and the Chapter in numbers', async () => {
    const backend = await withHero();
    bindWorld(backend.world);
    await prisma.hero.updateMany({
      data: { level: 18, bestFloor: 10, location: 'LABYRINTH', floor: 10, room: lair, deedCounts: { rooms: 412, minibosses: 9, banked: 15000, legendary: 2, hidden: 3 } },
    });
    const season = await prisma.season.findFirstOrThrow();
    const hero = await prisma.hero.findFirstOrThrow({ include: { items: true } });
    // Two fights against the Dragon before, and the last one: the one it falls in.
    for (const outcome of ['escaped', 'dead', 'victory']) {
      await prisma.feedEvent.create({ data: { seasonId: season.id, playerId: hero.playerId, kind: 'boss-attempt', data: { hero: hero.name, outcome } } });
    }
    const out = emptyOutcome();
    await prisma.$transaction((tx) => bossVictory(tx, hero, season, 10, lair, out));
    expect(out.notices.map((n) => n.en).join(' ')).toContain('Chapter 1 is complete');

    const view = await chapter(backend);
    expect(view).toMatchObject({
      complete: true, seen: false,
      end: { day: 1, level: 18, tries: 3, hero: { name: 'Garrick', class: 'fighter' } },
      tally: { days: 1, heroes: 1, deepest: 10, level: 18, rooms: 412, minibosses: 9, banked: 15000, hoards: 3, deaths: 0 },
    });
    // The Dragon's hoard may hold a Legendary of its own.
    expect(view.tally.legendary).toBeGreaterThanOrEqual(2);
    expect(view.hall.map((e) => e.kind).sort()).toEqual(['champion', 'deepest', 'highest-level']);

    // Seen once, it waits in the Tavern.
    expect((await call<ChapterView>(backend, 'POST', '/api/chapter/seen')).seen).toBe(true);
    expect((await chapter(backend)).seen).toBe(true);

    // The Dragon falls again another day: still one Champion, and the Chapter's end stands.
    await call(backend, 'POST', '/api/tavern/lodging').catch(() => undefined);
    bindWorld(backend.world);
    const again = emptyOutcome();
    await prisma.$transaction(async (tx) => bossVictory(tx, await tx.hero.findFirstOrThrow({ include: { items: true } }), season, 10, lair, again));
    expect(again.notices.map((n) => n.en).join(' ')).toContain('The Dragon falls again');
    expect((await chapter(backend)).hall.filter((e) => e.kind === 'champion')).toHaveLength(1);
  });
});
