import type { FeedEvent, Player } from '@prisma/client';
import type { FeedEntry, HallView, LocalizedText, TavernView, Tier } from '@dark/shared';
import { baseById, uniqueById, OMEN_DEFS, type OmenId } from '@dark/engine';
import { prisma } from '../db.js';
import { seasonView } from './seasonLife.js';
import { currentSeason } from './seasons.js';

const ONLINE_MS = 10 * 60 * 1000;

const TIER_NAMES: Record<string, LocalizedText> = {
  common: { en: 'Common', ru: 'обычный' }, uncommon: { en: 'Uncommon', ru: 'необычный' }, rare: { en: 'Rare', ru: 'редкий' },
  epic: { en: 'Epic', ru: 'эпический' }, legendary: { en: 'Legendary', ru: 'легендарный' }, mythic: { en: 'Mythic', ru: 'мифический' },
  relic: { en: 'Relic', ru: 'реликвия' },
};
const GRADE_NAMES: Record<string, LocalizedText> = {
  iron: { en: 'an Iron', ru: 'железный' }, silver: { en: 'a Silver', ru: 'серебряный' }, gold: { en: 'a Gold', ru: 'золотой' },
};

const baseName = (base: unknown): LocalizedText => {
  try {
    return baseById(String(base)).name;
  } catch {
    return { en: String(base), ru: String(base) };
  }
};

/** One Feed line in both languages, written from what was stored when it happened. */
export function feedLine(e: Pick<FeedEvent, 'kind' | 'data'>): { text: LocalizedText; tier: Tier | null } {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const hero = String(d.hero ?? '?');
  const tier = typeof d.tier === 'string' ? (d.tier as Tier) : null;
  const tierName = tier ? TIER_NAMES[tier]! : null;
  const unique = typeof d.uniqueId === 'string' ? uniqueById(d.uniqueId).name : null;
  switch (e.kind) {
    case 'drop':
      return { tier, text: { en: `${hero} found a ${tierName?.en} ${baseName(d.base).en.toLowerCase()} on Floor ${d.floor}`, ru: `${hero}: находка на этаже ${d.floor} — ${tierName?.ru} предмет (${baseName(d.base).ru.toLowerCase()})` } };
    case 'chest':
      return { tier, text: { en: `${hero} opened ${GRADE_NAMES[String(d.grade)]?.en} Chest: ${tierName?.en}!`, ru: `${hero} открывает ${GRADE_NAMES[String(d.grade)]?.ru} сундук, а в нём — ${tierName?.ru} предмет!` } };
    case 'identify':
      return { tier, text: { en: `${hero} identified ${unique?.en ?? 'an Item'}${d.radiant ? ' — Radiant!' : ''}`, ru: `${hero} опознаёт: ${unique?.ru ?? 'предмет'}${d.radiant ? ' — сияет!' : ''}` } };
    case 'relic':
      return { tier: 'relic', text: { en: `${hero} found a Relic: ${unique?.en} #${d.serial}/${d.of}`, ru: `${hero}: найдена реликвия — ${unique?.ru} №${d.serial}/${d.of}` } };
    case 'upgrade10':
      return { tier, text: { en: `${hero} forged a +10 ${baseName(d.base).en.toLowerCase()}!`, ru: `${hero} доводит до +10: ${baseName(d.base).ru.toLowerCase()}!` } };
    case 'market-sale':
      return { tier, text: { en: `${hero} bought from ${d.seller} for ${d.price} gold: ${tierName?.en} ${baseName(d.base).en.toLowerCase()}`, ru: `${hero} покупает на рынке: ${baseName(d.base).ru.toLowerCase()} (ранг: ${tierName?.ru}) за ${d.price} золота. Продавец: ${d.seller}` } };
    case 'death':
      return { tier: null, text: { en: `${hero} died on Floor ${d.floor}`, ru: `${hero} погибает на этаже ${d.floor}` } };
    case 'depth':
      return { tier: null, text: { en: `${hero} reached Floor ${d.floor} for the first time`, ru: `${hero} впервые спускается на этаж ${d.floor}` } };
    case 'vault':
      return { tier: null, text: { en: `${hero} emptied a Vault on Floor ${d.floor}`, ru: `${hero} опустошает сокровищницу на этаже ${d.floor}` } };
    case 'vault-announced':
      return { tier: null, text: { en: `A sealed Vault on Floor ${d.floor} will open soon`, ru: `Скоро откроется сокровищница на этаже ${d.floor}` } };
    case 'boss-attempt':
      return { tier: null, text: { en: `${hero} challenged the Dragon and ${d.outcome === 'dead' ? 'died' : d.outcome === 'victory' ? 'won' : 'fell back'}`, ru: `${hero} бросает вызов дракону и ${d.outcome === 'dead' ? 'гибнет' : d.outcome === 'victory' ? 'побеждает' : 'отступает'}` } };
    case 'boss-kill':
      return { tier: 'mythic', text: { en: d.place === 1 ? `${hero} slew the Dragon: Champion!` : `${hero} slew the Dragon: ${d.place === 2 ? '2nd' : '3rd'} place`, ru: d.place === 1 ? `${hero} побеждает дракона — чемпион!` : `${hero} побеждает дракона — ${d.place}-е место` } };
    case 'bounty': {
      const title = d.title as LocalizedText | undefined;
      return { tier: null, text: { en: `${hero} finished a weekly bounty: ${title?.en ?? ''}`, ru: `${hero} выполняет недельное задание: ${title?.ru ?? ''}` } };
    }
    case 'omen': {
      const omen = OMEN_DEFS[d.omen as OmenId];
      return { tier: null, text: omen ? { en: `Today's Omen: ${omen.name.en}`, ru: `Знамение дня: ${omen.name.ru}` } : { en: 'A new day', ru: 'Новый день' } };
    }
    case 'gate-open':
      return { tier: null, text: { en: 'The Boss gate is open', ru: 'Врата босса открыты' } };
    case 'weaken':
      return { tier: null, text: { en: `The Dragon weakens: −${d.percent}%`, ru: `Дракон слабеет: −${d.percent}%` } };
    default:
      return { tier: null, text: { en: e.kind, ru: e.kind } };
  }
}

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
