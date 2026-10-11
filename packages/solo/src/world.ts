import { type DbState, clone, emptyState } from './db/memdb.js';
import type { FieldMeta } from './db/meta.js';
import { MODELS } from './db/schema.gen.js';
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

/** Why a text won't load as a Save: it isn't one, or a newer app made it. */
export class SaveError extends Error {
  constructor(
    readonly code: 'not_a_save' | 'newer_save',
    message: string,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

export function parseWorld(text: string): World {
  let world: unknown;
  try {
    world = JSON.parse(text, (_key, value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        const v = value as Record<string, unknown>;
        if (keys.length === 1 && typeof v.$date === 'string') return new Date(v.$date);
        if (keys.length === 1 && typeof v.$bigint === 'string') return BigInt(v.$bigint);
      }
      return value;
    });
  } catch {
    throw new SaveError('not_a_save', 'This is not a Dark Corner save');
  }
  if (!isWorld(world)) throw new SaveError('not_a_save', 'This is not a Dark Corner save');
  if (world.version > WORLD_VERSION) {
    throw new SaveError('newer_save', `This save was made by a newer version of the game (format ${world.version})`);
  }
  // Migrations from older formats go here, one version at a time.
  fitSchema(world);
  return world;
}

/** The outline of a World, enough to load it; the tables are fitted afterwards. */
function isWorld(value: unknown): value is World {
  const w = value as Partial<World> | null;
  return typeof w === 'object' && w !== null && typeof w.version === 'number'
    && typeof w.clock === 'object' && w.clock !== null && typeof w.clock.now === 'number' && typeof w.clock.start === 'number'
    && (w.clock.mode === 'days' || w.clock.mode === 'real')
    && typeof w.settings === 'object' && w.settings !== null
    && typeof w.db === 'object' && w.db !== null && typeof w.db.tables === 'object' && w.db.tables !== null
    && Object.values(w.db.tables).every(Array.isArray);
}

/**
 * Fits a Save from an older build to this build's schema (apps/api/prisma/schema.prisma):
 * a table it lacks starts empty, a field it lacks takes the schema's default (null when
 * optional), and what the schema has dropped goes. A new field with no default needs a
 * migration of its own in `parseWorld`, or the Save won't load; test/saves.test.ts loads
 * a Save from every release to catch that.
 */
function fitSchema(world: World): void {
  const tables = world.db.tables;
  for (const name of Object.keys(tables)) if (!MODELS[name]) delete tables[name];
  world.db.counters ??= {};
  const now = new Date(world.clock.mode === 'days' ? world.clock.now : Date.now());
  for (const [name, meta] of Object.entries(MODELS)) {
    const rows = (tables[name] ??= []);
    const fields = Object.entries(meta.fields).filter(([, field]) => field.kind !== 'relation');
    const known = new Set(fields.map(([key]) => key));
    for (const row of rows) {
      for (const key of Object.keys(row)) if (!known.has(key)) delete row[key];
      for (const [key, field] of fields) if (row[key] === undefined) row[key] = defaultFor(`${name}.${key}`, field, now);
    }
  }
}

function defaultFor(where: string, field: FieldMeta, now: Date): unknown {
  const def = field.default;
  if (field.updatedAt || (def && 'fn' in def && def.fn === 'now')) return new Date(now.getTime());
  if (def && 'value' in def) return clone(def.value);
  if (field.list) return [];
  if (field.optional) return null;
  throw new Error(`${where} is new in this build and has no default: give it one, or migrate older Saves in parseWorld`);
}
