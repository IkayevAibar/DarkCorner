import type { Hero, Prisma } from '@prisma/client';
import type { DeedView, LocalizedText } from '@dark/shared';
import { DEEDS, type DeedCounts, deedById, newlyEarned, tallyDeeds } from '@dark/engine';
import { feed } from './feed.js';
import type { DoneDeed } from './fights.js';
import type { Tx } from './ledger.js';
import { gameNow } from '../gameClock.js';

// Deeds and Titles (docs/design.md → Deeds and Titles). The counts live on the Hero
// and grow inside the transaction of whatever earned them; a Deed that finishes
// banks its gold, tells the Feed, and leaves a Title to wear.

const t = (en: string, ru: string): LocalizedText => ({ en, ru });
const countsOf = (hero: Pick<Hero, 'deedCounts'>) => (hero.deedCounts ?? {}) as DeedCounts;
const doneOf = (hero: Pick<Hero, 'deeds'>) => ({ ...((hero.deeds ?? {}) as Record<string, string>) });

/**
 * Adds to a Hero's Deed counts (and raises `max` ones), then pays every Deed that
 * finishes. The deepest Floor always counts from the Hero's own record, so a Hero
 * deep before Deeds existed gets its due on the next count.
 */
export async function countDeeds(
  tx: Tx, hero: Hero, add: DeedCounts, out: { notices: LocalizedText[]; deeds?: DoneDeed[] } | null, max: DeedCounts = {},
): Promise<void> {
  if (!Object.values(add).some((n) => n) && Object.keys(max).length === 0) return;
  const counts = tallyDeeds(countsOf(hero), add, { ...max, depth: Math.max(max.depth ?? 0, hero.bestFloor) });
  const done = doneOf(hero);
  const fresh = newlyEarned(counts, Object.keys(done));
  const at = gameNow().toISOString();
  for (const d of fresh) done[d.id] = at;
  const gold = fresh.reduce((sum, d) => sum + d.gold, 0);
  await tx.hero.update({
    where: { id: hero.id },
    data: {
      deedCounts: counts as Prisma.InputJsonValue,
      ...(fresh.length > 0 ? { deeds: done as Prisma.InputJsonValue, gold: { increment: gold } } : {}),
    },
  });
  hero.deedCounts = counts as Prisma.JsonValue;
  hero.deeds = done;
  hero.gold += gold;
  if (fresh.length === 0) return;
  const season = await tx.season.findUniqueOrThrow({ where: { id: hero.seasonId } });
  for (const d of fresh) {
    // A Labyrinth result shows Deeds apart; anywhere else they're a line like any other.
    if (out?.deeds) out.deeds.push({ id: d.id, title: d.title, gold: d.gold });
    else out?.notices.push(t(
      `Deed done: ${d.title.en}. +${d.gold} gold, and a Title to wear.`,
      `Подвиг совершён: «${d.title.ru}». +${d.gold} золота и титул, который можно носить.`,
    ));
    await feed(tx, season, hero, 'deed', { deed: d.id });
  }
}

/** Every Deed with the Hero's progress, in list order. */
export function deedViews(hero: Pick<Hero, 'deedCounts' | 'deeds' | 'bestFloor'>): DeedView[] {
  const counts = tallyDeeds(countsOf(hero), {}, { depth: hero.bestFloor });
  const done = doneOf(hero);
  return DEEDS.map((d) => ({
    id: d.id, title: d.title, about: d.about, target: d.target, gold: d.gold,
    progress: Math.min(d.target, counts[d.metric] ?? 0),
    doneAt: done[d.id] ?? null,
  }));
}

/** The Title a Hero wears, in both languages. */
export const titleOf = (hero: Pick<Hero, 'title'> | null | undefined): LocalizedText | null =>
  (hero?.title ? deedById(hero.title)?.title ?? null : null);

/** How many Deeds a Hero has done. */
export const deedsDone = (hero: Pick<Hero, 'deeds'>): number => Object.keys(doneOf(hero)).length;

/** Whether a Hero has done a Deed. */
export const isDone = (hero: Pick<Hero, 'deeds'>, deed: string): boolean => Boolean(doneOf(hero)[deed]);
