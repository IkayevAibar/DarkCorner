import type { Hero, Player } from '@prisma/client';
import { RANKINGS, type Ranking, type RankingKind, type RankingRow, type RankingsView } from '@dark/shared';
import { type Tier, baseById, tierRank } from '@dark/engine';
import { prisma } from '../db.js';
import { deedsDone, titleOf } from './deeds.js';
import { portraitUrlOf } from './heroes.js';
import { toItemView } from './items.js';
import { currentSeason } from './seasons.js';

// The Tavern's Rankings (docs/design.md → Rankings): one board per record, read
// from the Heroes themselves, the Feed and the fight log, so they count the whole
// Season so far.

const TOP = 10;

const nameOf = (p: Player) => p.globalName ?? p.username;

/** One Player's standing on a board: its value, the Hero shown, and what orders ties. */
interface Score {
  playerId: string;
  hero: Hero;
  value: number;
  /** Orders equal values without splitting their rank. */
  then?: number;
  item?: RankingRow['item'];
}

export async function rankingsView(me: Player): Promise<RankingsView> {
  const season = await currentSeason();
  const since = season.startsAt ?? season.createdAt;
  const [players, heroes, counts, victories, items, podium] = await Promise.all([
    prisma.player.findMany({ where: { approvedAt: { not: null }, bannedAt: null } }),
    prisma.hero.findMany({ where: { seasonId: season.id }, orderBy: { createdAt: 'asc' } }),
    prisma.feedEvent.groupBy({
      by: ['playerId', 'kind'],
      where: { seasonId: season.id, kind: { in: ['grave-looted', 'vault', 'death'] } },
      _count: { _all: true },
    }),
    // A fight's log has no Season; the Season's start bounds it. (Solo: the server's raw
    // GROUP BY over the in-memory RollLog, which keeps only the latest rolls.)
    prisma.rollLog
      .findMany({ where: { kind: 'fight', createdAt: { gte: since }, playerId: { not: null } }, select: { playerId: true, detail: true } })
      .then((rows) => {
        const won = new Map<string, number>();
        for (const r of rows) if ((r.detail as { outcome?: unknown } | null)?.outcome === 'victory') won.set(r.playerId!, (won.get(r.playerId!) ?? 0) + 1);
        return [...won].map(([playerId, n]) => ({ playerId, n: BigInt(n) }));
      }),
    prisma.item.findMany({
      where: { seasonId: season.id, identified: true, place: { in: ['WORN', 'BAG', 'STORAGE'] }, hero: { retiredAt: null } },
    }),
    prisma.bossKill.findMany({ where: { seasonId: season.id } }),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));
  const heroesOf = new Map<string, Hero[]>();
  for (const h of heroes) if (byId.has(h.playerId)) heroesOf.set(h.playerId, [...(heroesOf.get(h.playerId) ?? []), h]);
  /** The Hero a Player plays now, or the last one it played this Season. */
  const current = (playerId: string): Hero | null => {
    const list = heroesOf.get(playerId) ?? [];
    return list.find((h) => h.retiredAt === null) ?? list[list.length - 1] ?? null;
  };
  /** A Hero's own record: the Player's best Hero on it, retired or not. */
  const bestHero = (value: (h: Hero) => number, then: (h: Hero) => number): Score[] =>
    [...heroesOf.entries()].map(([playerId, list]) => {
      const hero = list.reduce((a, b) => (value(b) > value(a) || (value(b) === value(a) && then(b) > then(a)) ? b : a));
      return { playerId, hero, value: value(hero), then: then(hero) };
    });
  /** A count kept per Player, shown with the Hero it plays now. */
  const counted = (count: Map<string, number>): Score[] =>
    [...count.entries()].flatMap(([playerId, value]) => {
      const hero = current(playerId);
      return hero && byId.has(playerId) ? [{ playerId, hero, value }] : [];
    });

  const feedCount = (kind: string) =>
    new Map(counts.filter((c) => c.kind === kind && c.playerId).map((c) => [c.playerId!, c._count._all]));

  const finest = new Map<string, Score>();
  const heroById = new Map(heroes.map((h) => [h.id, h]));
  for (const item of items) {
    const hero = item.heroId ? heroById.get(item.heroId) : undefined;
    if (!hero || !byId.has(hero.playerId) || baseById(item.base).kind !== 'gear') continue;
    // A higher Tier wins, then a higher Upgrade, then a deeper item level.
    const then = item.upgrade * 1000 + item.itemLevel;
    const value = tierRank(item.tier as Tier);
    const best = finest.get(hero.playerId);
    if (best && (best.value > value || (best.value === value && best.then! >= then))) continue;
    const view = toItemView(item);
    const name = item.upgrade > 0 ? { en: `${view.name.en} +${item.upgrade}`, ru: `${view.name.ru} +${item.upgrade}` } : view.name;
    finest.set(hero.playerId, { playerId: hero.playerId, hero, value, then, item: { name, tier: view.tier } });
  }

  const boards: Record<Exclude<RankingKind, 'dragon'>, Score[]> = {
    deepest: bestHero((h) => h.bestFloor, (h) => h.xp),
    level: bestHero((h) => h.level, (h) => h.xp),
    richest: [...heroesOf.keys()].flatMap((playerId) => {
      const hero = current(playerId);
      return hero && hero.retiredAt === null ? [{ playerId, hero, value: hero.gold + hero.carriedGold }] : [];
    }),
    victories: counted(new Map(victories.map((v) => [v.playerId, Number(v.n)]))),
    deeds: bestHero((h) => deedsDone(h), (h) => h.xp),
    finest: [...finest.values()],
    graves: counted(feedCount('grave-looted')),
    vaults: counted(feedCount('vault')),
    deaths: counted(feedCount('death')),
  };

  const row = (s: Score, rank: number): RankingRow => ({
    rank,
    player: nameOf(byId.get(s.playerId)!),
    hero: s.hero.name,
    title: titleOf(s.hero),
    portraitUrl: portraitUrlOf(s.hero),
    banner: s.hero.banner,
    value: s.value,
    item: s.item ?? null,
    me: s.playerId === me.id,
  });
  const ranked = (kind: RankingKind, scores: Score[]): Ranking => {
    // Nothing done yet is not a record; everyone has a level, though.
    const sorted = scores
      .filter((s) => kind === 'level' || kind === 'finest' || s.value > 0)
      .sort((a, b) => b.value - a.value || (b.then ?? 0) - (a.then ?? 0) || a.hero.name.localeCompare(b.hero.name));
    const rows = sorted.map((s) => row(s, sorted.findIndex((o) => o.value === s.value) + 1));
    const mine = rows.findIndex((r) => r.me);
    return { kind, rows: rows.slice(0, TOP), me: mine >= TOP ? rows[mine]! : null };
  };

  // The Dragon's podium is its own: the Champion, then the Finale's second and third.
  const dragon: Ranking = {
    kind: 'dragon',
    rows: podium
      .sort((a, b) => a.place - b.place)
      .flatMap((k) => {
        const player = byId.get(k.playerId);
        const hero = heroById.get(k.heroId);
        if (!player) return [];
        return [{
          rank: k.place, player: nameOf(player), hero: k.heroName, title: titleOf(hero), portraitUrl: hero ? portraitUrlOf(hero) : null, banner: hero?.banner ?? null,
          value: k.place, item: null, me: k.playerId === me.id,
        }];
      }),
    me: null,
  };

  return { boards: RANKINGS.map((kind) => (kind === 'dragon' ? dragon : ranked(kind, boards[kind]))) };
}
