import type { Hero, Player, Prisma } from '@prisma/client';
import type { AdminAnnounce, AdminAnnounceResult, ItemView, LocalizedText, StepClaimResult, StepsView } from '@dark/shared';
import { STEPS, type StepDef, type StepFacts, baseById, stepById } from '@dark/engine';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';
import { broadcast } from './broadcast.js';
import { toItemView } from './items.js';
import { earnGold, giveStack, lockHero, type Tx } from './ledger.js';
import { notifyAll } from './push.js';
import { currentSeason } from './seasons.js';

// First steps (docs/design.md → First steps): goals read what the living Hero has
// already done, so nothing needs counting twice; a Player's claims are kept by
// Season, so a new Hero after Retiring can't claim them again.

type Claims = Record<string, Record<string, string>>;

function factsOf(hero: Hero, delves: number): StepFacts {
  const counts = (hero.deedCounts ?? {}) as Record<string, number>;
  const kills = Object.entries(counts).filter(([metric]) => metric.startsWith('kills-')).reduce((sum, [, n]) => sum + (n ?? 0), 0);
  return {
    kills, banked: counts.banked ?? 0, chestsOpened: counts.chests ?? 0, level: hero.level, waypoints: hero.waypoints.length,
    path: hero.path !== null, bestFloor: hero.bestFloor, delves,
  };
}

/** "Healing potion ×2, Iron key", "150 gold". */
function rewardText(def: StepDef): LocalizedText {
  const items = (def.reward.items ?? []).map(({ base, quantity }) => {
    const name = baseById(base).name;
    const times = quantity > 1 ? ` ×${quantity}` : '';
    return { en: `${name.en}${times}`, ru: `${name.ru}${times}` };
  });
  const gold = def.reward.gold ? [{ en: `${def.reward.gold} gold`, ru: `${def.reward.gold} золота` }] : [];
  const parts = [...items, ...gold];
  return { en: parts.map((p) => p.en).join(', '), ru: parts.map((p) => p.ru).join(', ') };
}

function viewOf(hero: Hero, delves: number, claimed: Record<string, string>): StepsView {
  const facts = factsOf(hero, delves);
  const steps = STEPS.map((def) => ({
    id: def.id, name: def.name, how: def.how, reward: rewardText(def), done: def.done(facts), claimed: Boolean(claimed[def.id]),
  }));
  return { steps, ready: steps.filter((s) => s.done && !s.claimed).length };
}

async function view(tx: Tx, player: Pick<Player, 'id' | 'steps'>, hero: Hero, seasonId: string): Promise<StepsView> {
  const delves = await tx.delve.count({ where: { seasonId, playerId: player.id } });
  return viewOf(hero, delves, ((player.steps ?? {}) as Claims)[seasonId] ?? {});
}

export async function stepsView(player: Player): Promise<StepsView> {
  const season = await currentSeason();
  return prisma.$transaction(async (tx) => {
    const hero = await tx.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null } });
    if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
    const fresh = await tx.player.findUniqueOrThrow({ where: { id: player.id } });
    return view(tx, fresh, hero, season.id);
  });
}

/** Pays one done step's reward: gold into the City purse, Items into the Bag (or Storage in the City). */
export async function claimStep(player: Player, id: string): Promise<StepClaimResult> {
  const def = stepById(id);
  if (!def) throw ApiError.notFound('no_step', 'No such step');
  const season = await currentSeason();
  return prisma.$transaction(async (tx) => {
    // The Player row is the lock that stops a reward being claimed twice at once.
    await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${player.id} FOR UPDATE`;
    const fresh = await tx.player.findUniqueOrThrow({ where: { id: player.id } });
    const hero = await lockHero(tx, player, season.id);
    const claims = { ...((fresh.steps ?? {}) as Claims) };
    const mine = { ...(claims[season.id] ?? {}) };
    if (mine[def.id]) throw ApiError.conflict('step_claimed', 'That reward is already yours');
    const delves = await tx.delve.count({ where: { seasonId: season.id, playerId: player.id } });
    if (!def.done(factsOf(hero, delves))) throw ApiError.conflict('step_not_done', 'That step isn’t done yet');

    const loot: ItemView[] = [];
    for (const { base, quantity } of def.reward.items ?? []) {
      await giveStack(tx, hero, season.id, base, quantity);
      const stack = hero.items.find((i) => i.base === base && (i.place === 'BAG' || i.place === 'STORAGE'))!;
      loot.push({ ...toItemView(stack), id: `${stack.id}:+${quantity}`, quantity });
    }
    const gold = def.reward.gold ?? 0;
    if (gold > 0) await earnGold(tx, hero, gold);

    mine[def.id] = new Date().toISOString();
    claims[season.id] = mine;
    const saved = await tx.player.update({ where: { id: player.id }, data: { steps: claims as Prisma.InputJsonValue } });
    return { view: await view(tx, saved, hero, season.id), loot, gold };
  });
}

// ─── Announcements ────────────────────────────────────────────────────────

/**
 * A message from the game's makers: to the friends' Discord channel, as a line in
 * the Tavern's Feed, and (if asked) as a Notification to every device that wants news.
 */
export async function announce(body: AdminAnnounce): Promise<AdminAnnounceResult> {
  const season = await currentSeason();
  const text = { en: body.en, ru: body.ru };
  return prisma.$transaction(async (tx) => {
    await broadcast(tx, { en: `📣 ${text.en}`, ru: `📣 ${text.ru}` });
    await tx.feedEvent.create({ data: { seasonId: season.id, kind: 'announcement', data: text } });
    let notified = 0;
    if (body.push) {
      const firstLine = (s: string) => s.split('\n')[0]!.slice(0, 180);
      notified = await notifyAll(tx, {
        kind: 'news',
        title: { en: 'News from Dark Corner', ru: 'Новости «Тёмного уголка»' },
        body: { en: firstLine(text.en), ru: firstLine(text.ru) },
        url: '/news',
        tag: 'news',
      });
    }
    return { discord: Boolean(env.DISCORD_WEBHOOK_URL), notified };
  });
}
