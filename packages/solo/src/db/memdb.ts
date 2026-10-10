import type { FieldMeta, ModelMeta } from './meta.js';
import { MODELS } from './schema.gen.js';

/**
 * The part of Prisma's client that the ported services use, over tables kept in
 * memory: the World's save (docs/plan-solo-offline.md, section 5). Queries behave
 * the way Prisma on Postgres does where the services can tell the difference:
 *
 * - Every row read is a copy. The services change their own copies after a write
 *   (`hero.gold -= amount` after a decrement), as they do with Prisma.
 * - NULL never equals anything: `not`, `in` and comparisons skip it, and unique keys
 *   with a NULL in them never clash (an Item's `heroId_slot` while it sits in the Bag).
 * - Json values are stored as JSON (a Date in one comes back as a string).
 * - ASC sorts put NULLs last and DESC first; rows that tie keep the order they were made in.
 * - A thrown error inside `$transaction` undoes everything the transaction wrote.
 * - Row locks (`SELECT … FOR UPDATE`) do nothing: one Player, one request at a time.
 */

export type Row = Record<string, unknown>;

/** Everything the database holds: the save's tables, and the counters behind autoincrement ids. */
export interface DbState {
  tables: Record<string, Row[]>;
  counters: Record<string, number>;
}

export const emptyState = (): DbState => ({
  tables: Object.fromEntries(Object.keys(MODELS).map((name) => [name, []])),
  counters: {},
});

class NullMarker {
  constructor(readonly name: string) {}
  toString(): string {
    return this.name;
  }
}

/** Prisma.DbNull and friends: write NULL into a Json column. */
export const DbNull = new NullMarker('DbNull');
export const JsonNull = new NullMarker('JsonNull');
export const AnyNull = new NullMarker('AnyNull');

/** Prisma's error for a failed query, with Prisma's codes (P2002 unique, P2025 not found, P2003 foreign key). */
export class PrismaClientKnownRequestError extends Error {
  readonly code: string;
  readonly meta: Record<string, unknown> | undefined;
  readonly clientVersion = 'solo';
  constructor(message: string, options: { code: string; meta?: Record<string, unknown> }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = options.code;
    this.meta = options.meta;
  }
}

// ─── Values ───────────────────────────────────────────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

export function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = clone(v);
  return out as T;
}

export function cloneState(state: DbState): DbState {
  return { tables: Object.fromEntries(Object.entries(state.tables).map(([k, rows]) => [k, rows.map(clone)])), counters: { ...state.counters } };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => deepEqual(x, (b as unknown[])[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Row)[k], (b as Row)[k]));
}

function eq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a instanceof Date || b instanceof Date) return toTime(a) === toTime(b);
  if (typeof a === 'bigint' || typeof b === 'bigint') return toBig(a) === toBig(b);
  if (typeof a === 'object' && typeof b === 'object') return deepEqual(a, b);
  return a === b;
}

const toTime = (v: unknown): number => (v instanceof Date ? v.getTime() : typeof v === 'string' || typeof v === 'number' ? new Date(v).getTime() : NaN);

function toBig(v: unknown): bigint | null {
  try {
    return BigInt(v as string | number | bigint);
  } catch {
    return null;
  }
}

/** Orders two non-null values of one column. */
function compare(a: unknown, b: unknown): number {
  if (a instanceof Date || b instanceof Date) return Math.sign(toTime(a) - toTime(b));
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const x = toBig(a)!;
    const y = toBig(b)!;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return (a as number | string) < (b as number | string) ? -1 : (a as number | string) > (b as number | string) ? 1 : 0;
}

const isNull = (v: unknown) => v === null || v === undefined;

/** What a column stores for a value written to it. */
function stored(field: FieldMeta, value: unknown): unknown {
  if (value instanceof NullMarker || value === null) return null;
  if (field.type === 'Json') return value === undefined ? null : JSON.parse(JSON.stringify(value));
  if (field.type === 'DateTime' && (typeof value === 'string' || typeof value === 'number')) return new Date(value);
  if (field.type === 'BigInt' && typeof value === 'number') return BigInt(value);
  return clone(value);
}

/** A filter's operand, as the column's type: ISO strings for dates, numbers for BigInts. */
const operand = (field: FieldMeta, value: unknown): unknown =>
  field.type === 'DateTime' && typeof value === 'string' ? new Date(value) : value;

// ─── Relations ────────────────────────────────────────────────────────────

const model = (name: string): ModelMeta => {
  const meta = MODELS[name];
  if (!meta) throw new Error(`Unknown model ${name}`);
  return meta;
};

const backRelations = new Map<string, FieldMeta>();

/** For a relation field without foreign keys (`Hero.items`), the field on the other side that has them (`Item.hero`). */
function owningSide(owner: ModelMeta, fieldName: string): FieldMeta {
  const key = `${owner.name}.${fieldName}`;
  const cached = backRelations.get(key);
  if (cached) return cached;
  const field = owner.fields[fieldName]!;
  const target = model(field.type);
  const candidates = Object.values(target.fields).filter(
    (f) => f.kind === 'relation' && f.type === owner.name && (f.relation?.fields.length ?? 0) > 0
      && (field.relation?.name === undefined || f.relation?.name === field.relation.name),
  );
  if (candidates.length !== 1) throw new Error(`Cannot tell which ${target.name} relation ${key} uses`);
  backRelations.set(key, candidates[0]!);
  return candidates[0]!;
}

// ─── The client ───────────────────────────────────────────────────────────

type Args = Record<string, unknown>;
type Where = Record<string, unknown>;

const notFound = (op: string, name: string) =>
  new PrismaClientKnownRequestError(`No record was found for ${op} on ${name}.`, { code: 'P2025', meta: { modelName: name } });

export interface MemDbOptions {
  /** The clock behind `@default(now())` and `@updatedAt`. */
  now: () => Date;
  /** Ids for `@default(cuid())`. */
  newId?: () => string;
  state?: DbState;
}

export function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = 'c';
  for (const b of bytes) id += (b % 36).toString(36);
  return id + Array.from(bytes.slice(0, 8), (b) => (b >> 3).toString(36)).join('');
}

export class MemDb {
  state: DbState;
  /** Rows written since the counter was last reset: tells the backend whether to save. */
  writes = 0;
  private readonly now: () => Date;
  private readonly newId: () => string;
  [delegate: string]: unknown;

  constructor(options: MemDbOptions) {
    this.state = options.state ?? emptyState();
    this.now = options.now;
    this.newId = options.newId ?? randomId;
    for (const meta of Object.values(MODELS)) this[meta.delegate] = this.delegate(meta);
  }

  // ── Transactions and raw SQL ──

  async $transaction(arg: unknown): Promise<unknown> {
    if (typeof arg === 'function') {
      const before = cloneState(this.state);
      try {
        return await (arg as (tx: this) => Promise<unknown>)(this);
      } catch (error) {
        this.state.tables = before.tables;
        this.state.counters = before.counters;
        throw error;
      }
    }
    if (Array.isArray(arg)) return Promise.all(arg);
    throw new Error('$transaction takes a function or an array');
  }

  /** Only row locks are understood; they do nothing here. */
  async $queryRaw(strings: TemplateStringsArray | string): Promise<unknown[]> {
    const sql = typeof strings === 'string' ? strings : strings.join('?');
    if (/^\s*SELECT\b[\s\S]*\bFOR UPDATE\b/i.test(sql)) return [];
    throw new Error(`Raw SQL is not available offline: ${sql.trim().slice(0, 80)}`);
  }

  async $executeRaw(strings: TemplateStringsArray | string): Promise<number> {
    const sql = typeof strings === 'string' ? strings : strings.join('?');
    throw new Error(`Raw SQL is not available offline: ${sql.trim().slice(0, 80)}`);
  }

  $queryRawUnsafe(sql: string): Promise<unknown[]> {
    return this.$queryRaw(sql);
  }

  $executeRawUnsafe(sql: string): Promise<number> {
    return this.$executeRaw(sql);
  }

  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  // ── Model operations ──

  private delegate(meta: ModelMeta) {
    const run = <T>(fn: () => T): Promise<T> => {
      try {
        return Promise.resolve(fn());
      } catch (error) {
        return Promise.reject(error);
      }
    };
    return {
      findUnique: (args: Args) => run(() => this.findFirst(meta, args)),
      findUniqueOrThrow: (args: Args) => run(() => this.findFirst(meta, args) ?? (() => { throw notFound('findUniqueOrThrow', meta.name); })()),
      findFirst: (args: Args = {}) => run(() => this.findFirst(meta, args)),
      findFirstOrThrow: (args: Args = {}) => run(() => this.findFirst(meta, args) ?? (() => { throw notFound('findFirstOrThrow', meta.name); })()),
      findMany: (args: Args = {}) => run(() => this.findMany(meta, args)),
      create: (args: Args) => run(() => this.shape(meta, this.insert(meta, args.data as Row), args)),
      createMany: (args: Args) => run(() => {
        const list = (Array.isArray(args.data) ? args.data : [args.data]) as Row[];
        let count = 0;
        for (const data of list) {
          try {
            this.insert(meta, data);
            count++;
          } catch (error) {
            if (!(args.skipDuplicates && error instanceof PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
          }
        }
        return { count };
      }),
      update: (args: Args) => run(() => {
        const row = this.first(meta, args.where as Where);
        if (!row) throw notFound('update', meta.name);
        this.apply(meta, row, args.data as Row);
        return this.shape(meta, row, args);
      }),
      updateMany: (args: Args = {}) => run(() => {
        const rows = this.filter(meta, args.where as Where | undefined);
        for (const row of rows) this.apply(meta, row, args.data as Row);
        return { count: rows.length };
      }),
      upsert: (args: Args) => run(() => {
        const row = this.first(meta, args.where as Where);
        if (row) {
          this.apply(meta, row, args.update as Row);
          return this.shape(meta, row, args);
        }
        return this.shape(meta, this.insert(meta, args.create as Row), args);
      }),
      delete: (args: Args) => run(() => {
        const row = this.first(meta, args.where as Where);
        if (!row) throw notFound('delete', meta.name);
        const shaped = this.shape(meta, row, args);
        this.remove(meta, row);
        return shaped;
      }),
      deleteMany: (args: Args = {}) => run(() => {
        const rows = this.filter(meta, args.where as Where | undefined);
        for (const row of rows) this.remove(meta, row);
        return { count: rows.length };
      }),
      count: (args: Args = {}) => run(() => {
        const rows = this.pick(meta, this.filter(meta, args.where as Where | undefined), args);
        const select = args.select as Record<string, unknown> | undefined;
        if (!select) return rows.length;
        return Object.fromEntries(Object.entries(select).filter(([, on]) => on).map(([k]) => [k, k === '_all' ? rows.length : rows.filter((r) => !isNull(r[k])).length]));
      }),
      aggregate: (args: Args = {}) => run(() => this.aggregate(meta, this.pick(meta, this.filter(meta, args.where as Where | undefined), args), args)),
      groupBy: (args: Args) => run(() => this.groupBy(meta, args)),
    };
  }

  private table(meta: ModelMeta): Row[] {
    return (this.state.tables[meta.name] ??= []);
  }

  private filter(meta: ModelMeta, where: Where | undefined): Row[] {
    return this.table(meta).filter((row) => this.matches(meta, row, where));
  }

  private first(meta: ModelMeta, where: Where): Row | undefined {
    if (!where) throw new Error(`${meta.name}: a where is required`);
    return this.table(meta).find((row) => this.matches(meta, row, where));
  }

  private findFirst(meta: ModelMeta, args: Args): Row | null {
    const rows = this.pick(meta, this.filter(meta, args.where as Where | undefined), { ...args, take: 1 });
    return rows[0] ? this.shape(meta, rows[0], args) : null;
  }

  private findMany(meta: ModelMeta, args: Args): Row[] {
    return this.pick(meta, this.filter(meta, args.where as Where | undefined), args).map((row) => this.shape(meta, row, args));
  }

  /** orderBy, distinct, skip and take, in Prisma's order. */
  private pick(meta: ModelMeta, rows: Row[], args: Args): Row[] {
    if (args.cursor) throw new Error(`${meta.name}: cursor paging is not supported`);
    let out = this.sort(meta, rows, args.orderBy);
    const distinct = args.distinct as string[] | string | undefined;
    if (distinct) {
      const fields = Array.isArray(distinct) ? distinct : [distinct];
      const seen: Row[] = [];
      out = out.filter((row) => {
        if (seen.some((s) => fields.every((f) => (isNull(s[f]) && isNull(row[f])) || eq(s[f], row[f])))) return false;
        seen.push(row);
        return true;
      });
    }
    const skip = (args.skip as number | undefined) ?? 0;
    const take = args.take as number | undefined;
    if (take !== undefined && take < 0) throw new Error(`${meta.name}: a negative take is not supported`);
    return out.slice(skip, take === undefined ? undefined : skip + take);
  }

  private sort(meta: ModelMeta, rows: Row[], orderBy: unknown): Row[] {
    if (!orderBy) return rows;
    const keys: [string, 'asc' | 'desc', 'first' | 'last' | undefined][] = [];
    for (const entry of Array.isArray(orderBy) ? orderBy : [orderBy]) {
      for (const [field, spec] of Object.entries(entry as Record<string, unknown>)) {
        if (spec === undefined) continue;
        const meta2 = meta.fields[field];
        if (!meta2 || meta2.kind === 'relation') throw new Error(`${meta.name}: ordering by ${field} is not supported`);
        if (typeof spec === 'string') keys.push([field, spec as 'asc' | 'desc', undefined]);
        else {
          const { sort, nulls } = spec as { sort: 'asc' | 'desc'; nulls?: 'first' | 'last' };
          keys.push([field, sort, nulls]);
        }
      }
    }
    return [...rows].sort((a, b) => {
      for (const [field, dir, nulls] of keys) {
        const x = a[field];
        const y = b[field];
        if (isNull(x) || isNull(y)) {
          if (isNull(x) && isNull(y)) continue;
          // Postgres: NULLs come last going up and first going down.
          const nullsFirst = nulls ? nulls === 'first' : dir === 'desc';
          return isNull(x) === nullsFirst ? -1 : 1;
        }
        const c = compare(x, y);
        if (c !== 0) return dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }

  // ── Where ──

  private matches(meta: ModelMeta, row: Row, where: Where | undefined): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === 'AND') {
        if (!(Array.isArray(cond) ? cond : [cond]).every((w) => this.matches(meta, row, w as Where))) return false;
        continue;
      }
      if (key === 'OR') {
        if (!(cond as Where[]).some((w) => this.matches(meta, row, w))) return false;
        continue;
      }
      if (key === 'NOT') {
        if ((Array.isArray(cond) ? cond : [cond]).some((w) => this.matches(meta, row, w as Where))) return false;
        continue;
      }
      const field = meta.fields[key];
      if (!field) {
        const compound = meta.uniques.find((u) => u.length > 1 && u.join('_') === key);
        if (!compound) throw new Error(`${meta.name} has no field ${key}`);
        const values = cond as Row;
        if (!compound.every((f) => this.scalarMatches(meta.fields[f]!, row[f], values[f]))) return false;
        continue;
      }
      if (field.kind === 'relation') {
        if (!this.relationMatches(meta, key, row, cond as Where)) return false;
        continue;
      }
      if (!this.scalarMatches(field, row[key], cond)) return false;
    }
    return true;
  }

  private scalarMatches(field: FieldMeta, value: unknown, cond: unknown): boolean {
    if (cond === undefined) return true;
    if (cond === null || cond instanceof NullMarker) return isNull(value);
    if (field.list) {
      const list = (value as unknown[] | null) ?? [];
      if (Array.isArray(cond)) return deepEqual(list, cond);
      const c = cond as Record<string, unknown>;
      if ('has' in c) return list.some((v) => eq(v, c.has));
      if ('hasSome' in c) return (c.hasSome as unknown[]).some((x) => list.some((v) => eq(v, x)));
      if ('hasEvery' in c) return (c.hasEvery as unknown[]).every((x) => list.some((v) => eq(v, x)));
      if ('isEmpty' in c) return (list.length === 0) === c.isEmpty;
      if ('equals' in c) return deepEqual(list, c.equals);
      throw new Error(`Unsupported list filter ${Object.keys(c).join(', ')}`);
    }
    if (!isPlainObject(cond) || field.type === 'Json' && !('equals' in cond) && !('not' in cond)) {
      return field.type === 'Json' ? deepEqual(value, cond) : eq(value, operand(field, cond));
    }
    const insensitive = cond.mode === 'insensitive';
    const text = (v: unknown) => (insensitive ? String(v).toLowerCase() : String(v));
    for (const [op, raw] of Object.entries(cond)) {
      if (raw === undefined || op === 'mode') continue;
      const x = operand(field, raw);
      switch (op) {
        case 'equals':
          if (x === null || x instanceof NullMarker ? !isNull(value) : field.type === 'Json' ? !deepEqual(value, x) : insensitive ? isNull(value) || text(value) !== text(x) : !eq(value, x)) return false;
          break;
        case 'not':
          if (x === null || x instanceof NullMarker) {
            if (isNull(value)) return false;
          } else if (isNull(value) || (isPlainObject(x) ? this.scalarMatches(field, value, x) : eq(value, x))) return false;
          break;
        case 'in':
          if (isNull(value) || !(x as unknown[]).some((v) => eq(value, operand(field, v)))) return false;
          break;
        case 'notIn':
          if (isNull(value) || (x as unknown[]).some((v) => eq(value, operand(field, v)))) return false;
          break;
        case 'lt':
          if (isNull(value) || compare(value, x) >= 0) return false;
          break;
        case 'lte':
          if (isNull(value) || compare(value, x) > 0) return false;
          break;
        case 'gt':
          if (isNull(value) || compare(value, x) <= 0) return false;
          break;
        case 'gte':
          if (isNull(value) || compare(value, x) < 0) return false;
          break;
        case 'contains':
          if (isNull(value) || !text(value).includes(text(x))) return false;
          break;
        case 'startsWith':
          if (isNull(value) || !text(value).startsWith(text(x))) return false;
          break;
        case 'endsWith':
          if (isNull(value) || !text(value).endsWith(text(x))) return false;
          break;
        default:
          throw new Error(`Unsupported filter ${op}`);
      }
    }
    return true;
  }

  private relationMatches(meta: ModelMeta, fieldName: string, row: Row, cond: Where): boolean {
    const field = meta.fields[fieldName]!;
    const target = model(field.type);
    const related = this.related(meta, fieldName, row);
    if (field.list) {
      for (const [op, w] of Object.entries(cond)) {
        if (w === undefined) continue;
        if (op === 'some' && !related.some((r) => this.matches(target, r, w as Where))) return false;
        if (op === 'every' && !related.every((r) => this.matches(target, r, w as Where))) return false;
        if (op === 'none' && related.some((r) => this.matches(target, r, w as Where))) return false;
        if (op !== 'some' && op !== 'every' && op !== 'none') throw new Error(`Unsupported relation filter ${op}`);
      }
      return true;
    }
    const one = related[0];
    if (cond === null) return !one;
    if ('is' in cond || 'isNot' in cond) {
      if ('is' in cond && cond.is !== undefined) {
        if (cond.is === null ? Boolean(one) : !one || !this.matches(target, one, cond.is as Where)) return false;
      }
      if ('isNot' in cond && cond.isNot !== undefined) {
        if (cond.isNot === null ? !one : one !== undefined && this.matches(target, one, cond.isNot as Where)) return false;
      }
      return true;
    }
    return Boolean(one) && this.matches(target, one!, cond);
  }

  /** The rows a relation field leads to (the stored rows, not copies). */
  private related(meta: ModelMeta, fieldName: string, row: Row): Row[] {
    const field = meta.fields[fieldName]!;
    const target = model(field.type);
    if (field.relation && field.relation.fields.length > 0) {
      const { fields, references } = field.relation;
      if (fields.some((f) => isNull(row[f]))) return [];
      return this.table(target).filter((r) => references.every((ref, i) => eq(r[ref], row[fields[i]!])));
    }
    const { fields, references } = owningSide(meta, fieldName).relation!;
    return this.table(target).filter((r) => fields.every((f, i) => eq(r[f], row[references[i]!])));
  }

  // ── Shaping results ──

  private shape(meta: ModelMeta, row: Row, args: Args): Row {
    const select = args.select as Record<string, unknown> | undefined;
    if (select) {
      const out: Row = {};
      for (const [key, on] of Object.entries(select)) {
        if (!on) continue;
        if (key === '_count') {
          out._count = this.counts(meta, row, on);
          continue;
        }
        const field = meta.fields[key];
        if (!field) throw new Error(`${meta.name} has no field ${key}`);
        out[key] = field.kind === 'relation' ? this.nested(meta, key, row, on) : clone(row[key]);
      }
      return out;
    }
    const out = clone(row);
    const include = args.include as Record<string, unknown> | undefined;
    if (include) {
      for (const [key, on] of Object.entries(include)) {
        if (!on) continue;
        if (key === '_count') {
          out._count = this.counts(meta, row, on);
          continue;
        }
        if (meta.fields[key]?.kind !== 'relation') throw new Error(`${meta.name} has no relation ${key}`);
        out[key] = this.nested(meta, key, row, on);
      }
    }
    return out;
  }

  private nested(meta: ModelMeta, key: string, row: Row, on: unknown): unknown {
    const field = meta.fields[key]!;
    const target = model(field.type);
    const args = on === true ? {} : (on as Args);
    const rows = this.related(meta, key, row);
    if (field.list) return this.pick(target, rows.filter((r) => this.matches(target, r, args.where as Where | undefined)), args).map((r) => this.shape(target, r, args));
    return rows[0] ? this.shape(target, rows[0], args) : null;
  }

  private counts(meta: ModelMeta, row: Row, on: unknown): Record<string, number> {
    const wanted = on === true
      ? Object.fromEntries(Object.entries(meta.fields).filter(([, f]) => f.kind === 'relation' && f.list).map(([k]) => [k, true]))
      : ((on as Args).select as Record<string, unknown>);
    const out: Record<string, number> = {};
    for (const [key, w] of Object.entries(wanted)) {
      if (!w) continue;
      const target = model(meta.fields[key]!.type);
      const where = w === true ? undefined : ((w as Args).where as Where | undefined);
      out[key] = this.related(meta, key, row).filter((r) => this.matches(target, r, where)).length;
    }
    return out;
  }

  private aggregate(meta: ModelMeta, rows: Row[], args: Args): Row {
    const out: Row = {};
    const fieldsOf = (spec: unknown) => Object.entries(spec as Record<string, unknown>).filter(([, on]) => on).map(([k]) => k);
    if (args._count) {
      out._count = args._count === true
        ? rows.length
        : Object.fromEntries(fieldsOf(args._count).map((k) => [k, k === '_all' ? rows.length : rows.filter((r) => !isNull(r[k])).length]));
    }
    const numbers = (k: string) => rows.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
    if (args._sum) out._sum = Object.fromEntries(fieldsOf(args._sum).map((k) => [k, numbers(k).length ? numbers(k).reduce((s, v) => s + v, 0) : null]));
    if (args._avg) out._avg = Object.fromEntries(fieldsOf(args._avg).map((k) => [k, numbers(k).length ? numbers(k).reduce((s, v) => s + v, 0) / numbers(k).length : null]));
    const extreme = (k: string, sign: number) => rows.map((r) => r[k]).filter((v) => !isNull(v)).reduce<unknown>((m, v) => (m === null || compare(v, m) * sign > 0 ? v : m), null);
    if (args._min) out._min = Object.fromEntries(fieldsOf(args._min).map((k) => [k, clone(extreme(k, -1))]));
    if (args._max) out._max = Object.fromEntries(fieldsOf(args._max).map((k) => [k, clone(extreme(k, 1))]));
    return out;
  }

  private groupBy(meta: ModelMeta, args: Args): Row[] {
    const by = (Array.isArray(args.by) ? args.by : [args.by]) as string[];
    const groups: { key: Row; rows: Row[] }[] = [];
    for (const row of this.filter(meta, args.where as Where | undefined)) {
      const group = groups.find((g) => by.every((f) => (isNull(g.key[f]) && isNull(row[f])) || eq(g.key[f], row[f])));
      if (group) group.rows.push(row);
      else groups.push({ key: Object.fromEntries(by.map((f) => [f, row[f]])), rows: [row] });
    }
    const out = groups.map((g) => ({ ...clone(g.key), ...this.aggregate(meta, g.rows, args) }));
    return args.orderBy ? this.sort(meta, out, args.orderBy) : out;
  }

  // ── Writes ──

  private insert(meta: ModelMeta, data: Row): Row {
    if (!data) throw new Error(`${meta.name}: create needs data`);
    for (const key of Object.keys(data)) {
      if (!meta.fields[key]) throw new Error(`${meta.name} has no field ${key}`);
      if (meta.fields[key]!.kind === 'relation') throw new Error(`${meta.name}.${key}: nested writes are not supported, set the foreign key`);
    }
    const now = this.now();
    const row: Row = {};
    const generated = new Set<string>();
    for (const [name, field] of Object.entries(meta.fields)) {
      if (field.kind === 'relation') continue;
      let value = data[name];
      if (value === undefined) {
        const def = field.default;
        if (field.updatedAt) value = new Date(now.getTime());
        else if (def && 'fn' in def) {
          if (def.fn === 'now') value = new Date(now.getTime());
          else if (def.fn === 'cuid' || def.fn === 'uuid') value = this.newId();
          else if (def.fn === 'autoincrement') {
            const next = (this.state.counters[meta.name] ?? 0) + 1;
            this.state.counters[meta.name] = next;
            value = field.type === 'BigInt' ? BigInt(next) : next;
          } else throw new Error(`Unsupported default ${def.fn}()`);
          generated.add(name);
        } else if (def && 'value' in def) value = clone(def.value);
        else if (field.list) value = [];
        else if (field.optional) value = null;
        else throw new Error(`${meta.name}.${name} is required`);
        row[name] = value;
        continue;
      }
      row[name] = field.list && isPlainObject(value) && 'set' in value ? clone(value.set) : stored(field, value);
      if (!field.optional && !field.list && row[name] === null) throw new Error(`${meta.name}.${name} cannot be null`);
    }
    // An autoincrement id given by hand moves the counter past it, as a Postgres sequence would not; fine here.
    this.checkUnique(meta, row, null, generated);
    this.table(meta).push(row);
    this.writes++;
    return row;
  }

  private apply(meta: ModelMeta, row: Row, data: Row): void {
    if (!data) throw new Error(`${meta.name}: update needs data`);
    const next: Row = { ...row };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const field = meta.fields[key];
      if (!field) throw new Error(`${meta.name} has no field ${key}`);
      if (field.kind === 'relation') throw new Error(`${meta.name}.${key}: nested writes are not supported, set the foreign key`);
      next[key] = this.updated(field, row[key], value);
      if (!field.optional && !field.list && next[key] === null) throw new Error(`${meta.name}.${key} cannot be null`);
    }
    const now = this.now();
    for (const [name, field] of Object.entries(meta.fields)) if (field.updatedAt && data[name] === undefined) next[name] = new Date(now.getTime());
    this.checkUnique(meta, next, row, new Set());
    Object.assign(row, next);
    this.writes++;
  }

  private updated(field: FieldMeta, current: unknown, value: unknown): unknown {
    if (value instanceof NullMarker || value === null) return null;
    if (field.type === 'Json' || !isPlainObject(value)) return stored(field, value);
    if ('set' in value) return field.list ? clone(value.set) : stored(field, value.set);
    if (field.list && 'push' in value) {
      const add = Array.isArray(value.push) ? value.push : [value.push];
      return [...((current as unknown[] | null) ?? []), ...add.map(clone)];
    }
    // Arithmetic on NULL stays NULL, as in SQL.
    if (isNull(current)) return null;
    const n = (v: unknown) => (field.type === 'BigInt' ? BigInt(v as number) : Number(v));
    const cur = current as number & bigint;
    if ('increment' in value) return cur + (n(value.increment) as number & bigint);
    if ('decrement' in value) return cur - (n(value.decrement) as number & bigint);
    if ('multiply' in value) return cur * (n(value.multiply) as number & bigint);
    if ('divide' in value) {
      const q = cur / (n(value.divide) as number & bigint);
      return field.type === 'Int' ? Math.trunc(q as number) : q;
    }
    throw new Error(`Unsupported update of ${field.type}: ${Object.keys(value).join(', ')}`);
  }

  private checkUnique(meta: ModelMeta, row: Row, self: Row | null, generated: ReadonlySet<string>): void {
    for (const key of meta.uniques) {
      // A fresh id can't clash; and in Postgres a NULL in a unique key never does.
      if (key.length === 1 && generated.has(key[0]!)) continue;
      if (key.some((f) => isNull(row[f]))) continue;
      const clash = this.table(meta).find((r) => r !== self && key.every((f) => eq(r[f], row[f])));
      if (clash) {
        throw new PrismaClientKnownRequestError(`Unique constraint failed on the fields: (${key.map((f) => `\`${f}\``).join(',')})`, {
          code: 'P2002',
          meta: { modelName: meta.name, target: key },
        });
      }
    }
  }

  /** Deletes a row and does what its relations say: cascade, set null, or refuse. */
  private remove(meta: ModelMeta, row: Row): void {
    const table = this.table(meta);
    const index = table.indexOf(row);
    if (index < 0) return;
    table.splice(index, 1);
    this.writes++;
    for (const other of Object.values(MODELS)) {
      for (const field of Object.values(other.fields)) {
        if (field.kind !== 'relation' || field.type !== meta.name || !field.relation?.fields.length) continue;
        const { fields, references, onDelete } = field.relation;
        const refs = this.table(other).filter((r) => fields.every((f, i) => eq(r[f], row[references[i]!])));
        if (refs.length === 0) continue;
        const action = onDelete ?? (field.optional ? 'SetNull' : 'Restrict');
        if (action === 'Cascade') for (const r of refs) this.remove(other, r);
        else if (action === 'SetNull') for (const r of refs) for (const f of fields) r[f] = null;
        else {
          table.splice(index, 0, row);
          throw new PrismaClientKnownRequestError(`Foreign key constraint failed on the field: \`${fields.join(',')}\``, {
            code: 'P2003',
            meta: { modelName: other.name, field_name: fields.join(',') },
          });
        }
      }
    }
  }
}
