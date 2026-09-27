import type { Bounty, Player, Prisma } from '@prisma/client';
import type { BountiesView } from '@dark/shared';
import {
  type BountyEvent, type BountyKind, type BountyReward, type BountySpec, DAILY_BOUNTIES, STORAGE_SLOTS, STACK_BUYBACK, baseById,
  bountyStep, bountyTitle, createRng, dailyBounties, weekOf, weeklyBounty,
} from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { stackView } from './items.js';
import { type HeroWithItems, type Tx, dayNumber, lockHero } from './ledger.js';
import { t, type Outcome } from './fights.js';
import { feed } from './feed.js';
import { huntView } from './hunts.js';
import { currentSeason } from './seasons.js';

// Tavern bounties (docs/design.md → Tavern bounties). What a bounty asks comes from
// a seed per Hero and day, so it can't be fished for; the row keeps its progress,
// and the reward is paid the moment it is done: gold banked, Items to Storage.

const specOf = (row: Bounty): BountySpec => ({
  kind: row.kind as BountyKind,
  target: row.target,
  params: row.params as BountySpec['params'],
  reward: row.reward as unknown as BountyReward,
});

const rowData = (spec: BountySpec) => ({
  kind: spec.kind,
  target: spec.target,
  params: spec.params as Prisma.InputJsonValue,
  reward: spec.reward as unknown as Prisma.InputJsonValue,
});

/** Today's three and this week's one for a Hero, made the first time they're needed. */
export async function ensureBounties(tx: Tx, hero: HeroWithItems, now: Date): Promise<Bounty[]> {
  const day = dayNumber(now);
  const week = weekOf(day);
  const current = await tx.bounty.findMany({
    where: { heroId: hero.id, OR: [{ day, weekly: false }, { day: week, weekly: true }] },
    orderBy: [{ weekly: 'asc' }, { slot: 'asc' }],
  });
  const dailies = current.filter((b) => !b.weekly);
  const weekly = current.find((b) => b.weekly);
  if (dailies.length >= DAILY_BOUNTIES && weekly) return current;

  const depth = Math.max(1, hero.bestFloor);
  if (dailies.length < DAILY_BOUNTIES) {
    const specs = dailyBounties(createRng(`${hero.id}:bounties:${day}`), depth);
    for (let slot = 0; slot < DAILY_BOUNTIES; slot++) {
      if (dailies.some((b) => b.slot === slot)) continue;
      await tx.bounty.upsert({
        where: { heroId_day_weekly_slot: { heroId: hero.id, day, weekly: false, slot } },
        create: { heroId: hero.id, day, weekly: false, slot, ...rowData(specs[slot]!) },
        update: {},
      });
    }
  }
  if (!weekly) {
    const spec = weeklyBounty(createRng(`${hero.id}:bounty-week:${week}`), depth);
    await tx.bounty.upsert({
      where: { heroId_day_weekly_slot: { heroId: hero.id, day: week, weekly: true, slot: 0 } },
      create: { heroId: hero.id, day: week, weekly: true, slot: 0, ...rowData(spec) },
      update: {},
    });
  }
  return tx.bounty.findMany({
    where: { heroId: hero.id, OR: [{ day, weekly: false }, { day: week, weekly: true }] },
    orderBy: [{ weekly: 'asc' }, { slot: 'asc' }],
  });
}

/**
 * Puts a reward Item into the Hero's room at the Tavern (its Storage), topping up
 * a stack first. With Storage full, the Item is paid out at twice its Buyback price.
 */
/** Puts a reward into Storage (topping up stacks); what doesn't fit comes back as its gold, twice its Buyback price. */
export async function deliver(tx: Tx, hero: HeroWithItems, seasonId: string, item: NonNullable<BountyReward['item']>): Promise<number> {
  const base = baseById(item.base);
  const max = 'maxStack' in base ? base.maxStack : 1;
  let left = item.quantity;
  for (const stack of hero.items.filter((i) => i.place === 'STORAGE' && i.base === item.base)) {
    const add = Math.min(left, max - stack.quantity);
    if (add <= 0) continue;
    await tx.item.update({ where: { id: stack.id }, data: { quantity: stack.quantity + add } });
    stack.quantity += add;
    left -= add;
  }
  const used = hero.items.filter((i) => i.place === 'STORAGE').length;
  if (left > 0 && used < STORAGE_SLOTS) {
    const created = await tx.item.create({ data: { seasonId, heroId: hero.id, place: 'STORAGE', base: item.base, tier: 'common', quantity: left } });
    hero.items.push(created);
    left = 0;
  }
  return left * (STACK_BUYBACK[item.base] ?? 1) * 2;
}

/**
 * Moves every open bounty along by what just happened, and pays the ones it
 * finishes. Adds a notice per finished bounty to the action's result.
 */
export async function trackBounties(tx: Tx, hero: HeroWithItems, event: BountyEvent, out: Outcome | null, now = new Date()): Promise<void> {
  const open = (await ensureBounties(tx, hero, now)).filter((b) => !b.doneAt);
  for (const row of open) {
    const spec = specOf(row);
    const step = bountyStep(spec, event);
    if (step <= 0) continue;
    const progress = Math.min(spec.target, row.progress + step);
    const done = progress >= spec.target;
    await tx.bounty.update({ where: { id: row.id }, data: { progress, ...(done ? { doneAt: now } : {}) } });
    if (!done) continue;

    const extra = spec.reward.item ? await deliver(tx, hero, hero.seasonId, spec.reward.item) : 0;
    const gold = spec.reward.gold + extra;
    await tx.hero.update({ where: { id: hero.id }, data: { gold: { increment: gold } } });
    hero.gold += gold;
    const title = bountyTitle(spec);
    const item = spec.reward.item ? baseById(spec.reward.item.base).name : null;
    out?.notices.push(item
      ? t(`Bounty done: ${title.en}. +${gold} gold, and ${spec.reward.item!.quantity} × ${item.en} waits in your room at the Tavern.`,
        `Задание выполнено: ${title.ru}. +${gold} золота, и ${item.ru} × ${spec.reward.item!.quantity} ждёт в вашей комнате в таверне.`)
      : t(`Bounty done: ${title.en}. +${gold} gold.`, `Задание выполнено: ${title.ru}. +${gold} золота.`));
    if (row.weekly) {
      const season = await tx.season.findUniqueOrThrow({ where: { id: hero.seasonId } });
      await feed(tx, season, hero, 'bounty', { title });
    }
  }
}

function view(row: Bounty, canSwap: boolean): BountiesView['daily'][number] {
  const spec = specOf(row);
  const item = spec.reward.item;
  return {
    id: row.id,
    title: bountyTitle(spec),
    progress: row.progress,
    target: row.target,
    done: row.doneAt !== null,
    reward: {
      gold: spec.reward.gold,
      item: item ? stackView(item.base, item.quantity, `reward-${row.id}`) : null,
    },
    canSwap: canSwap && !row.weekly && row.doneAt === null && row.progress === 0,
  };
}

/** GET /api/tavern/bounties: the Hero's bounties today and this week. */
export async function bountiesView(player: Player): Promise<BountiesView> {
  const season = await currentSeason();
  return prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const now = new Date();
    const rows = await ensureBounties(tx, hero, now);
    const swappedToday = rows.some((b) => !b.weekly && b.swapped);
    return {
      daily: rows.filter((b) => !b.weekly).map((b) => view(b, !swappedToday)),
      weekly: rows.filter((b) => b.weekly).map((b) => view(b, false))[0] ?? null,
      hunt: season.status === 'ACTIVE' || season.status === 'FINALE' ? await huntView(tx, season, hero, now) : null,
    };
  });
}

/** Once a day, one untouched daily bounty can be traded for another kind. */
export async function swapBounty(player: Player, id: string): Promise<BountiesView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    const rows = await ensureBounties(tx, hero, new Date());
    const row = rows.find((b) => b.id === id);
    if (!row || row.weekly) throw ApiError.notFound('no_bounty', 'No such bounty');
    if (rows.some((b) => !b.weekly && b.swapped)) throw ApiError.conflict('swap_used', 'You have already swapped a bounty today');
    if (row.doneAt || row.progress > 0) throw ApiError.conflict('bounty_started', 'Only an untouched bounty can be swapped');
    // Another kind than any of today's three, from its own seed.
    const taken = new Set(rows.filter((b) => !b.weekly).map((b) => b.kind));
    const rng = createRng(`${hero.id}:bounty-swap:${row.day}`);
    let spec = dailyBounties(rng, Math.max(1, hero.bestFloor))[0]!;
    for (let tries = 0; taken.has(spec.kind) && tries < 20; tries++) spec = dailyBounties(rng, Math.max(1, hero.bestFloor))[0]!;
    await tx.bounty.update({ where: { id: row.id }, data: { ...rowData(spec), swapped: true } });
  });
  return bountiesView(player);
}
