import type { FeedEvent, Season } from '@prisma/client';
import type { LocalizedText } from '@dark/shared';
import { type Tier, tierRank } from '@dark/engine';
import { feedLine } from './feedLine.js';
import type { Tx } from './ledger.js';

/**
 * Feed lines a Player made happen, and how much each is worth retelling. Season
 * news (the Omen, announced Vaults, the gate, the weakening) is left out: it was
 * Broadcast when it happened.
 */
const WORTH: Record<string, number> = {
  'boss-kill': 100, relic: 90, 'hunt-done': 80, upgrade10: 70, vault: 60,
  drop: 40, chest: 40, identify: 40, depth: 35, 'grave-looted': 30, 'boss-attempt': 28, hidden: 20, bounty: 15, 'market-sale': 10,
};
const MAX_LINES = 5;
const MAX_FALLEN = 6;

const score = (e: FeedEvent) => WORTH[e.kind]! + tierRank((feedLine(e).tier ?? 'common') as Tier) * 5;

/**
 * The past day in the Labyrinth, for the midnight Broadcast (docs/design.md → Feed
 * and broadcasts): its best moments from the Feed, then who fell. Null on a quiet day.
 */
export async function dayRecap(tx: Tx, season: Pick<Season, 'id'>, from: Date, to: Date): Promise<LocalizedText | null> {
  const events = await tx.feedEvent.findMany({
    where: { seasonId: season.id, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'asc' },
  });
  // Each Hero's deepest new Floor is the story; the Floors on the way are not.
  const deepest = new Map<string, FeedEvent>();
  for (const e of events) {
    if (e.kind !== 'depth') continue;
    const d = e.data as { hero?: string; floor?: number };
    const known = deepest.get(String(d.hero));
    if (!known || Number(d.floor) > Number((known.data as { floor?: number }).floor)) deepest.set(String(d.hero), e);
  }
  const moments = events.filter((e) => e.kind in WORTH && e.kind !== 'depth').concat([...deepest.values()]);
  const best = moments
    .sort((a, b) => score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, MAX_LINES);

  const lines = best.map((e) => feedLine(e).text);
  const more = moments.length - best.length;
  const fallen = events.filter((e) => e.kind === 'death').map((e) => e.data as { hero?: string; floor?: number });
  if (lines.length === 0 && fallen.length === 0) return null;

  const named = fallen.slice(0, MAX_FALLEN);
  const extra = fallen.length - named.length;
  const en = ['📜 The past day in the Labyrinth:', ...lines.map((l) => `• ${l.en}`)];
  const ru = ['📜 Минувшие сутки в лабиринте:', ...lines.map((l) => `• ${l.ru}`)];
  if (more > 0) {
    en.push(`• …and ${more} more in the Tavern's Feed`);
    ru.push(`• …и ещё ${more} — в ленте таверны`);
  }
  if (named.length > 0) {
    en.push(`☠ Fallen: ${named.map((d) => `${d.hero} (Floor ${d.floor})`).join(', ')}${extra > 0 ? ` and ${extra} more` : ''}`);
    ru.push(`☠ Павшие: ${named.map((d) => `${d.hero} (этаж ${d.floor})`).join(', ')}${extra > 0 ? ` и ещё ${extra}` : ''}`);
  }
  return { en: en.join('\n'), ru: ru.join('\n') };
}
