import { type DbState, emptyState } from './db/memdb.js';
import { type WorldClock, firstMorning } from './gameClock.js';

/**
 * A save: everything one solo game holds (docs/plan-solo-offline.md, section 5).
 * The tables keep the server's models and field names, so the ported services run
 * on them unchanged.
 */
export interface World {
  /** The save format. A newer app migrates older saves (see `parseWorld`). */
  version: number;
  /** When the save was made, on the device's clock. */
  createdAt: string;
  clock: WorldClock;
  /** Chosen when the save starts (docs/plan-solo-offline.md, decisions 5 and 6). */
  settings: WorldSettings;
  db: DbState;
}

export interface WorldSettings {
  difficulty: 'story' | 'normal' | 'hard';
  /** Iron mode: one life. */
  iron: boolean;
}

export const WORLD_VERSION = 1;

export function emptyWorld(options: { clock?: WorldClock['mode']; realNow?: number; settings?: Partial<WorldSettings> } = {}): World {
  const realNow = options.realNow ?? Date.now();
  const morning = firstMorning(realNow);
  return {
    version: WORLD_VERSION,
    createdAt: new Date(realNow).toISOString(),
    clock: { mode: options.clock ?? 'days', now: morning, start: morning },
    settings: { difficulty: 'normal', iron: false, ...options.settings },
    db: emptyState(),
  };
}

/** JSON with Dates and BigInts kept: `{ "$date": iso }` and `{ "$bigint": digits }`. */
export function serializeWorld(world: World): string {
  return JSON.stringify(world, function (this: Record<string, unknown>, key, value: unknown) {
    const raw = this[key];
    if (raw instanceof Date) return { $date: raw.toISOString() };
    if (typeof value === 'bigint') return { $bigint: value.toString() };
    return value;
  });
}

export function parseWorld(text: string): World {
  const world = JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      const v = value as Record<string, unknown>;
      if (keys.length === 1 && typeof v.$date === 'string') return new Date(v.$date);
      if (keys.length === 1 && typeof v.$bigint === 'string') return BigInt(v.$bigint);
    }
    return value;
  }) as World;
  if (typeof world.version !== 'number' || world.version > WORLD_VERSION) {
    throw new Error(`This save was made by a newer version of the game (format ${world.version})`);
  }
  // Migrations from older formats go here, one version at a time.
  for (const name of Object.keys(emptyState().tables)) world.db.tables[name] ??= [];
  return world;
}
