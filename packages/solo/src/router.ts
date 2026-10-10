import type { Player } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from './lib/errors.js';

/**
 * Just enough of Fastify for the ported routes (apps/api/src/routes): they
 * register with `app.get(path, { preHandler }, handler)` and read `params`,
 * `query`, `body` and `player`. Errors become the same `{ error, message,
 * details }` responses as apps/api/src/app.ts, and every result goes through
 * JSON, as it would over the network: Dates become strings and nothing the web
 * holds is the World's own object.
 */
export interface SoloRequest<P = Record<string, string>, Q = Record<string, string | undefined>> {
  method: string;
  url: string;
  params: P;
  query: Q;
  body: unknown;
  /** Only the ported scenarios send any: a `solo_player` cookie plays as another Player (lib/session.ts). */
  headers: Record<string, string>;
  player?: Player;
}

interface RouteTypes {
  Params?: unknown;
  Querystring?: unknown;
}
type ParamsOf<T extends RouteTypes> = T['Params'] extends object ? T['Params'] : Record<string, string>;
type QueryOf<T extends RouteTypes> = T['Querystring'] extends object ? T['Querystring'] : Record<string, string | undefined>;
type Handler<T extends RouteTypes> = (request: SoloRequest<ParamsOf<T>, QueryOf<T>>) => unknown;
type PreHandler = (request: SoloRequest) => unknown;
interface RouteOptions {
  preHandler?: PreHandler;
}
type Register = <T extends RouteTypes = object>(path: string, optionsOrHandler: RouteOptions | Handler<T>, handler?: Handler<T>) => void;

/** What a route module registers on: the Fastify instance on the server, this router in solo. */
export interface App {
  get: Register;
  post: Register;
  put: Register;
  patch: Register;
  delete: Register;
}

export interface SoloResponse {
  status: number;
  body: unknown;
  /** What was thrown, if anything: the backend then forgets what the request wrote. */
  error?: unknown;
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  preHandler?: PreHandler;
  handler: Handler<RouteTypes>;
}

export class Router implements App {
  private readonly routes: Route[] = [];
  /** One request at a time, as the server's row locks make them for one Player. */
  private queue: Promise<unknown> = Promise.resolve();

  get: Register = (path, a, b) => this.add('GET', path, a, b);
  post: Register = (path, a, b) => this.add('POST', path, a, b);
  put: Register = (path, a, b) => this.add('PUT', path, a, b);
  patch: Register = (path, a, b) => this.add('PATCH', path, a, b);
  delete: Register = (path, a, b) => this.add('DELETE', path, a, b);

  private add(method: string, path: string, a: RouteOptions | Handler<never>, b?: Handler<never>): void {
    const handler = (typeof a === 'function' ? a : b) as Handler<RouteTypes> | undefined;
    if (!handler) throw new Error(`${method} ${path} has no handler`);
    const options = typeof a === 'function' ? {} : a;
    const keys: string[] = [];
    const source = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:(\w+)/g, (_m, key: string) => {
      keys.push(key);
      return '/([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, preHandler: options.preHandler, handler });
  }

  handle(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<SoloResponse> {
    const next = this.queue.then(() => this.run(method, url, body, headers));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async run(method: string, url: string, body: unknown, headers: Record<string, string>): Promise<SoloResponse> {
    const verb = method.toUpperCase();
    const [path = '', search = ''] = url.split('?');
    let params: Record<string, string> = {};
    const route = this.routes.find((r) => {
      if (r.method !== verb) return false;
      const m = r.pattern.exec(path);
      if (!m) return false;
      params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
      return true;
    });
    if (!route) return { status: 404, body: { error: 'not_found', message: `No route for ${verb} ${url}` } };
    const request: SoloRequest = {
      method: verb,
      url,
      params,
      query: Object.fromEntries(new URLSearchParams(search)),
      body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
      headers,
    };
    try {
      if (route.preHandler) await route.preHandler(request);
      const result = await route.handler(request as never);
      return { status: 200, body: result === undefined ? null : JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { ...errorResponse(error), error };
    }
  }

  /** Fastify's inject(), for the ported API scenarios. */
  async inject(options: string | { method?: string; url: string; payload?: unknown; headers?: Record<string, string> }) {
    const o = typeof options === 'string' ? { url: options } : options;
    const response = await this.handle(o.method ?? 'GET', o.url, o.payload, o.headers ?? {});
    const text = JSON.stringify(response.body);
    return {
      statusCode: response.status,
      body: text,
      // `any`, like Fastify's: the scenarios read whatever shape they asked for.
      json: () => JSON.parse(text) as any,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      cookies: [] as { name: string; value: string }[],
    };
  }
}

/** apps/api/src/app.ts's error handler. */
function errorResponse(error: unknown): { status: number; body: unknown } {
  if (error instanceof ApiError) {
    return { status: error.statusCode, body: JSON.parse(JSON.stringify({ error: error.code, message: error.message, details: error.details })) };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: 'validation_failed',
        message: 'Request body or query is invalid',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  }
  console.error('[solo] unhandled error', error);
  return { status: 500, body: { error: 'internal_error', message: 'Something went wrong' } };
}
