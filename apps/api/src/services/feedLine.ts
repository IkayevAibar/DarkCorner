import type { FeedEvent } from '@prisma/client';
import type { LocalizedText, Tier } from '@dark/shared';
import { KIN_NAMES, TIER_TEXT, baseById, deedById, type MonsterKin, uniqueById, OMEN_DEFS, type OmenId } from '@dark/engine';

// How each Feed line reads, in both languages. It needs nothing but the engine's
// content, so the Tavern, the Hall of Fame and the midnight recap can all use it.

export const TIER_NAMES: Record<string, LocalizedText> = TIER_TEXT;
const GRADE_NAMES: Record<string, LocalizedText> = {
  iron: { en: 'an Iron', ru: 'железный' }, silver: { en: 'a Silver', ru: 'серебряный' }, gold: { en: 'a Gold', ru: 'золотой' },
};

export const baseName = (base: unknown): LocalizedText => {
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
    case 'grave-looted':
      return { tier, text: {
        en: `${hero} looted ${d.owner}'s Grave on Floor ${d.floor}${tierName ? ` (${tierName.en} among the spoils)` : ''}`,
        ru: `${hero} обирает могилу героя ${d.owner} на этаже ${d.floor}${tierName ? ` (среди добычи — ${tierName.ru} предмет)` : ''}`,
      } };
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
    case 'hidden':
      return { tier: null, text: { en: `${hero} found a hidden room on Floor ${d.floor}`, ru: `${hero} находит потайную комнату на этаже ${d.floor}` } };
    case 'twin':
      return { tier: 'epic', text: { en: `${hero} and ${d.partner} broke the Twin Wardens on Floor ${d.floor}`, ru: `${hero} и ${d.partner} одолевают стражей-близнецов на этаже ${d.floor}` } };
    case 'bounty': {
      const title = d.title as LocalizedText | undefined;
      return { tier: null, text: { en: `${hero} finished a weekly bounty: ${title?.en ?? ''}`, ru: `${hero} выполняет недельное задание: ${title?.ru ?? ''}` } };
    }
    case 'omen': {
      const omen = OMEN_DEFS[d.omen as OmenId];
      return { tier: null, text: omen ? { en: `Today's Omen: ${omen.name.en}`, ru: `Знамение дня: ${omen.name.ru}` } : { en: 'A new day', ru: 'Новый день' } };
    }
    case 'hunt': {
      const kin = KIN_NAMES[d.kin as MonsterKin];
      return { tier: null, text: { en: `The week's Hunt is on: ${d.target} ${kin.en}`, ru: `Объявлена охота недели на ${kin.ru}: нужно ${d.target}` } };
    }
    case 'hunt-done': {
      const kin = KIN_NAMES[d.kin as MonsterKin];
      return { tier: 'epic', text: { en: `The Hunt for ${kin.en} is done! ${d.leader} led it with ${d.count}`, ru: `Охота на ${kin.ru} окончена! Лучший охотник — ${d.leader}: ${d.count}` } };
    }
    case 'deed': {
      const title = deedById(String(d.deed))?.title;
      return { tier: 'epic', text: { en: `${hero} earned the Title “${title?.en ?? '?'}”`, ru: `${hero} получает титул «${title?.ru ?? '?'}»` } };
    }
    case 'gate-open':
      return { tier: null, text: { en: 'The Boss gate is open', ru: 'Врата босса открыты' } };
    case 'announcement':
      return { tier: null, text: { en: `📣 ${String(d.en ?? '')}`, ru: `📣 ${String(d.ru ?? '')}` } };
    case 'delve-cleared':
      return { tier: 'rare', text: { en: `${hero} won all six Rooms of the Daily Delve: ${d.score} points`, ru: `${hero} проходит все шесть комнат спуска дня (очки: ${d.score})` } };
    case 'delve-podium': {
      const podium = (Array.isArray(d.podium) ? d.podium : []) as { hero: string; score: number }[];
      const line = podium.map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${p.hero} ${p.score}`).join(' · ');
      return { tier: null, text: { en: `Yesterday's Delve: ${line}`, ru: `Вчерашний спуск: ${line}` } };
    }
    case 'weaken':
      return { tier: null, text: { en: `The Dragon weakens: −${d.percent}%`, ru: `Дракон слабеет: −${d.percent}%` } };
    default:
      return { tier: null, text: { en: e.kind, ru: e.kind } };
  }
}
