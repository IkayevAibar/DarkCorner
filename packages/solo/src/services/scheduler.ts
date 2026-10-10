import type { Job, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { gameNow, gameNowMs } from '../gameClock.js';
import type { Tx } from './ledger.js';

// Scheduled work (docs/architecture.md → Scheduled jobs) on the in-memory Job
// table and the game clock. In-game time only moves when the Hero sleeps, so a
// job comes due over a night; the backend runs due jobs before each request.
// Handlers stay idempotent, as on the server.

export type JobHandler = (payload: Record<string, unknown>, job: Job) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function onJob(kind: string, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export async function schedule(tx: Tx, kind: string, runAt: Date, payload: Record<string, unknown> = {}): Promise<void> {
  await tx.job.create({ data: { kind, runAt, payload: payload as Prisma.InputJsonValue } });
}

const MAX_ATTEMPTS = 5;

/**
 * Runs every job that is due, oldest first. Failures retry with a growing delay,
 * up to five attempts. Jobs queued while it runs wait for the next pass, as they
 * do on the server; on a clock that stands still that also keeps a job that
 * queues another from running forever.
 */
export async function runDueJobs(now = gameNow()): Promise<number> {
  const waiting = (await prisma.job.findMany({ where: { doneAt: null }, select: { id: true } })).map((j) => j.id);
  let ran = 0;
  for (;;) {
    const job = await prisma.job.findFirst({
      where: { id: { in: waiting }, doneAt: null, runAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { runAt: 'asc' },
    });
    if (!job) return ran;
    ran++;
    const claimed = await prisma.job.update({ where: { id: job.id }, data: { attempts: { increment: 1 } } });
    const handler = handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`no handler for job kind "${job.kind}"`);
      await handler((claimed.payload ?? {}) as Record<string, unknown>, claimed);
      await prisma.job.update({ where: { id: job.id }, data: { doneAt: gameNow(), lastError: null } });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.job.update({
        where: { id: job.id },
        data: { lastError: message.slice(0, 1000), runAt: new Date(gameNowMs() + claimed.attempts * claimed.attempts * 60_000) },
      });
    }
  }
}
