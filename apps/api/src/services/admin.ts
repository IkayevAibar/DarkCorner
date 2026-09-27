import type { AdminGrant, AdminSeasonView, RollLogView } from '@dark/shared';
import { baseById, createRng, isGear, rollGear } from '@dark/engine';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { gearData } from './items.js';
import { earnGold, giveItem, giveStack, lockHero } from './ledger.js';
import { seasonView } from './seasonLife.js';
import { currentSeason } from './seasons.js';

export async function adminSeasonView(): Promise<AdminSeasonView> {
  const season = await currentSeason();
  const [heroes, pending, done] = await Promise.all([
    prisma.hero.count({ where: { seasonId: season.id, retiredAt: null } }),
    prisma.job.findMany({ where: { doneAt: null }, orderBy: { runAt: 'asc' }, take: 30 }),
    prisma.job.findMany({ where: { doneAt: { not: null } }, orderBy: { doneAt: 'desc' }, take: 20 }),
  ]);
  return {
    season: await seasonView(season),
    heroes,
    jobs: [...pending, ...done].map((j) => ({
      id: j.id, kind: j.kind, runAt: j.runAt.toISOString(), doneAt: j.doneAt?.toISOString() ?? null, attempts: j.attempts, lastError: j.lastError,
    })),
    webhook: Boolean(env.DISCORD_WEBHOOK_URL),
  };
}

/** Testing help: gold and Items straight into a Player's Hero (the Bag, or Storage when full). */
export async function grant(request: AdminGrant): Promise<void> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, { id: request.playerId }, season.id);
    if (request.gold) await earnGold(tx, hero, request.gold);
    const want = request.item;
    if (!want) return;
    let base;
    try {
      base = baseById(want.base);
    } catch {
      throw ApiError.badRequest('no_such_base', 'No such Item base');
    }
    if (!isGear(base)) {
      await giveStack(tx, hero, season.id, base.id, want.quantity);
      return;
    }
    if (want.tier === 'relic') throw ApiError.badRequest('no_relics', 'Relics are only found, never granted');
    const seed = newSeed();
    // Legendaries and Mythics are named uniques and bring their own base.
    const baseId = want.tier === 'legendary' || want.tier === 'mythic' ? undefined : base.id;
    for (let i = 0; i < want.quantity; i++) {
      const roll = rollGear(createRng(`${seed}:${i}`), { tier: want.tier, itemLevel: Math.max(1, hero.bestFloor), identified: want.identified, baseId });
      await giveItem(tx, hero, { ...gearData(roll, `${seed}:${i}`), seasonId: season.id });
    }
    await tx.rollLog.create({ data: { playerId: request.playerId, kind: 'admin-grant', seed, detail: request as object } });
  });
}

export async function rollLog(opts: { kind?: string; playerId?: string; limit?: number }): Promise<RollLogView> {
  const rows = await prisma.rollLog.findMany({
    where: { kind: opts.kind || undefined, playerId: opts.playerId || undefined },
    orderBy: { id: 'desc' },
    take: Math.min(200, opts.limit ?? 100),
    include: { player: true },
  });
  return {
    rolls: rows.map((r) => ({
      id: String(r.id), player: r.player ? (r.player.globalName ?? r.player.username) : null, kind: r.kind, seed: r.seed,
      detail: r.detail, at: r.createdAt.toISOString(),
    })),
  };
}
