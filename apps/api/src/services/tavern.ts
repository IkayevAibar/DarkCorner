import type { Player } from '@prisma/client';
import type { FeedEntry, HallView, LocalizedText, TavernView } from '@dark/shared';
import { uniqueById } from '@dark/engine';
import { prisma } from '../db.js';
import { TIER_NAMES, baseName, feedLine } from './feedLine.js';
import { seasonView } from './seasonLife.js';
import { currentSeason } from './seasons.js';

const ONLINE_MS = 10 * 60 * 1000;

const nameOf = (p: Player) => p.globalName ?? p.username;

export async function tavernView(now = new Date()): Promise<TavernView> {
  const season = await currentSeason();
  const [events, online] = await Promise.all([
    prisma.feedEvent.findMany({ where: { seasonId: season.id }, orderBy: { id: 'desc' }, take: 50 }),
    prisma.player.findMany({
      where: { lastSeenAt: { gt: new Date(now.getTime() - ONLINE_MS) }, approvedAt: { not: null }, bannedAt: null },
      include: { heroes: { where: { seasonId: season.id, retiredAt: null } } },
      orderBy: { lastSeenAt: 'desc' },
    }),
  ]);
  const entries: FeedEntry[] = events.map((e) => ({ id: String(e.id), kind: e.kind, ...feedLine(e), at: e.createdAt.toISOString() }));
  return {
    entries,
    online: online.map((p) => {
      const hero = p.heroes[0] ?? null;
      const where: LocalizedText = !hero ? { en: 'Creating a Hero', ru: 'Создаёт героя' }
        : hero.location === 'CITY' ? { en: 'In the City', ru: 'В городе' }
        : { en: `Floor ${hero.floor}`, ru: `Этаж ${hero.floor}` };
      return { name: nameOf(p), hero: hero?.name ?? null, where };
    }),
    season: await seasonView(season, now),
  };
}

export async function hallView(): Promise<HallView> {
  const rows = await prisma.hallEntry.findMany({ orderBy: [{ seasonNumber: 'desc' }, { createdAt: 'asc' }] });
  return {
    entries: rows.map((r) => {
      const d = (r.detail ?? {}) as Record<string, unknown>;
      const detail: LocalizedText | null = r.kind === 'relic' && typeof d.uniqueId === 'string'
        ? { en: `${uniqueById(d.uniqueId).name.en} #${d.serial}/${d.of}`, ru: `${uniqueById(d.uniqueId).name.ru} №${d.serial}/${d.of}` }
        : r.kind === 'deepest' ? { en: `Floor ${d.floor}`, ru: `Этаж ${d.floor}` }
        : r.kind === 'best-drop' ? { en: `${TIER_NAMES[String(d.tier)]?.en} ${baseName(d.base).en.toLowerCase()}`, ru: `${baseName(d.base).ru} (ранг: ${TIER_NAMES[String(d.tier)]?.ru})` }
        : r.kind === 'highest-level' || typeof d.level === 'number' ? { en: `Level ${d.level}`, ru: `Уровень ${d.level}` }
        : null;
      return { season: r.seasonNumber, kind: r.kind as HallView['entries'][number]['kind'], player: r.playerName, hero: r.heroName, detail, at: r.createdAt.toISOString() };
    }),
  };
}
