import type { Hero, Hunt, Prisma, Season } from '@prisma/client';
import type { HuntView } from '@dark/shared';
import { HUNT_MIN, type MonsterKin, createRng, huntKin, huntTarget, huntTitle, weekOf } from '@dark/engine';
import { deliver } from './bounties.js';
import { feed } from './feed.js';
import { type Outcome, t } from './fights.js';
import { type HeroWithItems, type Tx, dayNumber } from './ledger.js';

// The Hunt (docs/design.md → The Hunt): each week the whole server goes after one
// kin of monster, and every Hero who helped shares the reward when it is done.

const DAY_MS = 24 * 60 * 60 * 1000;

/** This week's Hunt, posted the first time anyone looks at the board or fights. */
export async function huntOf(tx: Tx, season: Season, hero: Pick<Hero, 'playerId' | 'name'>, now: Date): Promise<Hunt> {
  const week = weekOf(dayNumber(now));
  const found = await tx.hunt.findUnique({ where: { seasonId_week: { seasonId: season.id, week } } });
  if (found) return found;
  // Sized to the Heroes seen this past week, and drawn from the Floors down to where most of them are.
  const heroes = await tx.hero.findMany({
    where: { seasonId: season.id, retiredAt: null, player: { lastSeenAt: { gt: new Date(now.getTime() - 7 * DAY_MS) } } },
    select: { bestFloor: true },
  });
  const floors = heroes.map((h) => h.bestFloor).sort((a, b) => a - b);
  const depth = floors[Math.floor(floors.length / 2)] ?? 1;
  const kin = huntKin(createRng(`${season.seed}:hunt:${week}`), depth);
  const hunt = await tx.hunt.upsert({
    where: { seasonId_week: { seasonId: season.id, week } },
    create: { seasonId: season.id, week, kin, target: huntTarget(heroes.length, week + 7 - dayNumber(now)) },
    update: {},
  });
  if (hunt.total === 0 && now.getTime() - hunt.createdAt.getTime() < 5_000) {
    await feed(tx, season, hero, 'hunt', { kin: hunt.kin, target: hunt.target, hero: null });
  }
  return hunt;
}

/** Monsters that fell to a Hero count toward the Hunt; the kill that reaches the target pays everyone. */
export async function trackHunt(tx: Tx, season: Season, hero: HeroWithItems, kins: MonsterKin[], out: Outcome | null, now: Date): Promise<void> {
  const hunt = await huntOf(tx, season, hero, now);
  if (hunt.doneAt) return;
  const kills = kins.filter((k) => k === hunt.kin).length;
  if (kills === 0) return;
  await tx.huntHunter.upsert({
    where: { huntId_heroId: { huntId: hunt.id, heroId: hero.id } },
    create: { huntId: hunt.id, heroId: hero.id, heroName: hero.name, count: kills },
    update: { count: { increment: kills } },
  });
  const counted = await tx.hunt.update({ where: { id: hunt.id }, data: { total: { increment: kills } } });
  if (counted.total < counted.target) return;
  // Only one kill finishes the Hunt.
  const finished = await tx.hunt.updateMany({ where: { id: hunt.id, doneAt: null }, data: { doneAt: now } });
  if (finished.count === 0) return;
  await payHunt(tx, season, counted, hero, out);
}

/** Every Hero with enough kills gets a Silver Chest in its room at the Tavern; the top hunter a Gold one. */
async function payHunt(tx: Tx, season: Season, hunt: Hunt, finisher: HeroWithItems, out: Outcome | null): Promise<void> {
  const hunters = await tx.huntHunter.findMany({ where: { huntId: hunt.id, count: { gte: HUNT_MIN } }, orderBy: [{ count: 'desc' }, { id: 'asc' }] });
  for (const [i, h] of hunters.entries()) {
    const hero = h.heroId === finisher.id ? finisher : await tx.hero.findUnique({ where: { id: h.heroId }, include: { items: true } });
    if (!hero || hero.retiredAt) continue;
    const chest = i === 0 ? 'chest-gold' : 'chest-silver';
    const gold = await deliver(tx, hero, hero.seasonId, { base: chest, quantity: 1 });
    if (gold > 0) await tx.hero.update({ where: { id: hero.id }, data: { gold: { increment: gold } } });
    if (hero === finisher) {
      out?.notices.push(i === 0
        ? t('The Hunt is done, and you led it: a Gold Chest waits in your room at the Tavern.', 'Охота окончена, и вы её возглавили: в вашей комнате в таверне ждёт золотой сундук.')
        : t('The Hunt is done: a Silver Chest waits in your room at the Tavern.', 'Охота окончена: в вашей комнате в таверне ждёт серебряный сундук.'));
    }
  }
  const leader = hunters[0];
  await feed(tx, season, finisher, 'hunt-done', { kin: hunt.kin, leader: leader?.heroName ?? null, count: leader?.count ?? 0, hunters: hunters.length } as Prisma.JsonObject);
}

export async function huntView(tx: Tx, season: Season, hero: Pick<Hero, 'id' | 'playerId' | 'name'>, now: Date): Promise<HuntView> {
  const hunt = await huntOf(tx, season, hero, now);
  const [top, mine] = await Promise.all([
    tx.huntHunter.findMany({ where: { huntId: hunt.id }, orderBy: [{ count: 'desc' }, { id: 'asc' }], take: 3 }),
    tx.huntHunter.findUnique({ where: { huntId_heroId: { huntId: hunt.id, heroId: hero.id } } }),
  ]);
  return {
    title: huntTitle(hunt.kin as MonsterKin),
    target: hunt.target,
    total: Math.min(hunt.total, hunt.target),
    mine: mine?.count ?? 0,
    top: top.map((h) => ({ hero: h.heroName, count: h.count })),
    min: HUNT_MIN,
    done: hunt.doneAt !== null,
    endsAt: new Date((hunt.week + 7) * DAY_MS).toISOString(),
  };
}
