import type { Hero, Player, Prisma } from '@prisma/client';
import type { TrainingView } from '@dark/shared';
import { type Ability, ABILITY_CAP, TRAINING, TRAINING_MS, trainingPrice } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { toHeroView } from './heroes.js';
import { type Tx, lockHero, requireCity, spendGold } from './ledger.js';
import { notify } from './push.js';
import { onJob, schedule } from './scheduler.js';
import { currentSeason } from './seasons.js';

// The Training grounds (docs/design.md → The City): one ability at a time, 8 hours away
// for City gold, then +1 to it. The +1 lands by a job at the hour, or on the Hero's next
// look at the grounds or the gate, whichever comes first.

/** Whether the Hero is away training right now. */
export const isTraining = (hero: Pick<Hero, 'training' | 'trainingUntil'>, now = new Date()): boolean =>
  hero.training !== null && hero.trainingUntil !== null && hero.trainingUntil > now;

/** A training whose time is up: its +1 lands, once. Returns whether it landed now. */
export async function finishTraining(tx: Tx, hero: Hero, now = new Date()): Promise<boolean> {
  if (!hero.training || !hero.trainingUntil || hero.trainingUntil > now) return false;
  const ability = hero.training as Ability;
  const data = { [ability]: Math.min(ABILITY_CAP, hero[ability] + 1), trained: [...hero.trained, ability], training: null, trainingUntil: null };
  await tx.hero.update({ where: { id: hero.id }, data: data as Prisma.HeroUpdateInput });
  Object.assign(hero, data);
  return true;
}

/** Refuses a way into a fight while the Hero (or its partner) is away training. */
export function requireNotTraining(hero: Pick<Hero, 'training' | 'trainingUntil'>, now: Date, partner?: Pick<Hero, 'training' | 'trainingUntil'> | null): void {
  if (isTraining(hero, now)) throw ApiError.conflict('training', 'The Hero is away training');
  if (partner && isTraining(partner, now)) throw ApiError.conflict('partner_training', 'The partner’s Hero is away training');
}

export async function trainingView(player: Player): Promise<TrainingView> {
  const season = await currentSeason();
  const found = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null }, select: { id: true } });
  if (!found) throw ApiError.conflict('no_hero', 'Create a Hero first');
  const hero = await prisma.$transaction(async (tx) => {
    const h = await tx.hero.findUniqueOrThrow({ where: { id: found.id }, include: { items: true } });
    await finishTraining(tx, h);
    return h;
  });
  return {
    max: TRAINING.prices.length,
    hours: TRAINING.hours,
    trained: hero.trained as Ability[],
    price: trainingPrice(hero.trained.length),
    current: hero.training && hero.trainingUntil ? { ability: hero.training as Ability, until: hero.trainingUntil.toISOString() } : null,
    hero: toHeroView(hero),
  };
}

/** Starts training an ability: the gold now, the +1 in eight hours. */
export async function startTraining(player: Player, ability: Ability): Promise<TrainingView> {
  const season = await currentSeason();
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    await finishTraining(tx, hero, now);
    if (hero.training) throw ApiError.conflict('already_training', 'The Hero is already training');
    if (hero[ability] >= ABILITY_CAP) throw ApiError.conflict('ability_max', `That ability is already ${ABILITY_CAP}`);
    const price = trainingPrice(hero.trained.length);
    if (price === null) throw ApiError.conflict('training_done', 'The Training grounds have nothing more for this Hero');
    await spendGold(tx, hero, price);
    const until = new Date(now.getTime() + TRAINING_MS);
    await tx.hero.update({ where: { id: hero.id }, data: { training: ability, trainingUntil: until } });
    await schedule(tx, 'training', until, { heroId: hero.id });
  });
  return trainingView(player);
}

onJob('training', async (payload, job) => {
  // Its hour has come by the time it runs.
  const now = new Date(Math.max(Date.now(), job.runAt.getTime()));
  await prisma.$transaction(async (tx) => {
    const hero = await tx.hero.findUnique({ where: { id: String(payload.heroId) } });
    if (!hero || hero.retiredAt) return;
    const ability = hero.training;
    if (!ability || !(await finishTraining(tx, hero, now))) return;
    await notify(tx, hero.playerId, {
      kind: 'training',
      title: { en: 'Training done', ru: 'Тренировка окончена' },
      body: {
        en: `${hero.name}'s ${ability.toUpperCase()} is up by 1. The Labyrinth is open again.`,
        ru: `${hero.name}: +1 к характеристике ${ABILITY_RU[ability as Ability]}. Лабиринт снова открыт.`,
      },
      url: '/city/training',
      tag: 'training',
    });
  });
});

/** Ability abbreviations in Russian, as the web shows them. */
const ABILITY_RU: Record<Ability, string> = { str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МДР', cha: 'ХАР' };
