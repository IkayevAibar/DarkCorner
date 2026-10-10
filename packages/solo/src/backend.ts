import { useSettings } from './settings.js';
import { type SoloApp, buildApp } from './app.js';
import { cloneState } from './db/memdb.js';
import { memdb, prisma } from './db.js';
import { DAY_MS, gameNow, gameNowMs, useClock } from './gameClock.js';
import { newSeed } from './lib/seed.js';
import { runDueJobs } from './services/scheduler.js';
import { startSeason } from './services/seasonLife.js';
import { type World, emptyWorld, parseWorld, serializeWorld } from './world.js';

/** Where a save lives: IndexedDB in a browser, a file on the phone, memory in tests. */
export interface SaveStorage {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
}

export interface SoloResult {
  status: number;
  body: unknown;
}

export interface Backend {
  /** Answers one of the web's API calls (apps/web/src/api.ts), as the server would. */
  handle(method: string, url: string, body?: unknown): Promise<SoloResult>;
  /** The loaded save. */
  readonly world: World;
}

/** Points the database, the clock and the settings at a World. */
export function bindWorld(world: World): void {
  useClock(world.clock);
  useSettings(world.settings);
  memdb.state = world.db;
}

/**
 * A new save: its one Player, and the first Chapter's Labyrinth, started now
 * (the server's Season, with its jobs: the Omen, the weakening, the Boss gate).
 */
export async function newWorld(options: NewWorldOptions = {}): Promise<World> {
  const world = emptyWorld(options);
  bindWorld(world);
  await prisma.player.create({ data: { discordId: 'solo', username: 'Player', approvedAt: gameNow() } });
  await prisma.season.create({ data: { number: 1, seed: options.seed ?? newSeed() } });
  await startSeason(gameNow());
  return world;
}

export type NewWorldOptions = Parameters<typeof emptyWorld>[0] & {
  /** The Labyrinth's seed; random unless a test or a shared world wants a known one. */
  seed?: string;
};

/** Rolls kept for the Rolls tab; older ones go, so a long game's save stays small. */
const ROLLS_KEPT = 1000;
/** Done jobs are forgotten after two in-game weeks. */
const JOBS_KEPT_MS = 14 * DAY_MS;

/** Keeps the save from growing without end (after any change; the playtest calls it too). */
export async function compactWorld(): Promise<void> {
  const rolls = memdb.state.tables.RollLog ?? [];
  if (rolls.length > ROLLS_KEPT) rolls.splice(0, rolls.length - ROLLS_KEPT);
  await prisma.job.deleteMany({ where: { doneAt: { lt: new Date(gameNowMs() - JOBS_KEPT_MS) } } });
}

let app: Promise<SoloApp> | null = null;

/**
 * The local backend behind the web's api.ts (docs/plan-solo-offline.md, section 5).
 * Requests run one at a time. Each one is all or nothing: if it throws, the World
 * goes back to how it was before it. After any change the save is written.
 */
export async function createBackend(options: { storage: SaveStorage } & NewWorldOptions): Promise<Backend> {
  app ??= buildApp();
  const router = await app;
  const text = await options.storage.load();
  const { storage: _storage, ...fresh } = options;
  let world = text ? parseWorld(text) : await newWorld(fresh);
  if (!text) await options.storage.save(serializeWorld(world));

  let queue: Promise<unknown> = Promise.resolve();

  async function run(method: string, url: string, body: unknown): Promise<SoloResult> {
    bindWorld(world);
    const before = { db: cloneState(world.db), clock: { ...world.clock }, settings: { ...world.settings } };
    memdb.writes = 0;
    await runDueJobs();
    const response = await router.handle(method, url, body);
    if (response.error !== undefined) {
      world = { ...world, db: before.db, clock: before.clock, settings: before.settings };
      bindWorld(world);
      return { status: response.status, body: response.body };
    }
    const settled = world.settings.difficulty !== before.settings.difficulty || world.settings.iron !== before.settings.iron;
    if (memdb.writes > 0 || world.clock.now !== before.clock.now || settled) {
      await compactWorld();
      try {
        await options.storage.save(serializeWorld(world));
      } catch (error) {
        console.error('[solo] could not save the game', error);
      }
    }
    return { status: response.status, body: response.body };
  }

  return {
    handle(method, url, body) {
      const next = queue.then(() => run(method, url, body));
      queue = next.catch(() => undefined);
      return next;
    },
    get world() {
      return world;
    },
  };
}
