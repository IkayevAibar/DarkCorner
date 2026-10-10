import type { Prisma, PrismaClient } from '@prisma/client';
import { gameNow } from './gameClock.js';
import * as mem from './db/memdb.js';

/**
 * The database the ported services use: the loaded World's tables, in memory.
 * The backend points it at the World before each request (backend.ts). Typed as
 * Prisma's client, so the services typecheck exactly as they do on the server.
 */
export const memdb = new mem.MemDb({ now: gameNow });
export const prisma = memdb as unknown as PrismaClient;

/** Prisma.DbNull and friends, typed as Prisma's so the services pass them where Prisma takes them. */
export const DbNull = mem.DbNull as unknown as typeof Prisma.DbNull;
export const JsonNull = mem.JsonNull as unknown as typeof Prisma.JsonNull;
export const AnyNull = mem.AnyNull as unknown as typeof Prisma.AnyNull;
export const { PrismaClientKnownRequestError } = mem;
