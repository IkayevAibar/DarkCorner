import type { Job, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import type { Tx } from './ledger.js';

// Scheduled work (docs/architecture.md → Scheduled jobs): the API polls the Job
// table. Handlers must be idempotent, because a job can run again after a crash
// between doing its work and being marked done.

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
 * Runs every job that is due, one at a time. A job is claimed with SKIP LOCKED,
 * so two API processes never run the same one. Failures retry with a growing
 * delay, up to five attempts.
 */
export async function runDueJobs(now = new Date()): Promise<number> {
  let ran = 0;
  for (;;) {
    const [job] = await prisma.$queryRaw<Job[]>`
      UPDATE "Job" SET attempts = attempts + 1
      WHERE id = (
        SELECT id FROM "Job"
        WHERE "doneAt" IS NULL AND "runAt" <= ${now} AND attempts < ${MAX_ATTEMPTS}
        ORDER BY "runAt" LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;
    if (!job) return ran;
    ran++;
    const handler = handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`no handler for job kind "${job.kind}"`);
      await handler((job.payload ?? {}) as Record<string, unknown>, job);
      await prisma.job.update({ where: { id: job.id }, data: { doneAt: new Date(), lastError: null } });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.job.update({
        where: { id: job.id },
        data: { lastError: message.slice(0, 1000), runAt: new Date(Date.now() + job.attempts * job.attempts * 60_000) },
      });
    }
  }
}

/** Polls for due jobs every 30 seconds. Not started in tests: they call runDueJobs() themselves. */
export function startScheduler(log: { error: (o: object, msg: string) => void }): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueJobs();
    } catch (e) {
      log.error({ err: e }, 'scheduler tick failed');
    } finally {
      busy = false;
    }
  };
  const id = setInterval(() => void tick(), 30_000);
  void tick();
  return () => clearInterval(id);
}
