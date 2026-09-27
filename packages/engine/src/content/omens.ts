import { createRng } from '../rng.js';
import { type Text, text } from './text.js';

/**
 * Omens: each day the whole Labyrinth leans one way for everyone, so no two
 * days play quite alike (docs/design.md → Omens, v0). The day's Omen comes from
 * the Season's seed and the day, so it is the same for every Player and known
 * from midnight UTC.
 */
export const OMENS = [
  'blood-moon', 'still-air', 'scholars-day', 'fortunes-wind', 'hunting-season', 'hot-forges', 'free-market', 'dim-day',
] as const;
export type OmenId = (typeof OMENS)[number];

export interface OmenDef {
  id: OmenId;
  name: Text;
  description: Text;
  /** Monster health and damage, as multipliers. */
  monsterHp?: number;
  monsterDamage?: number;
  /** Gold picked up from fights and Treasure rooms, as a multiplier. */
  gold?: number;
  /** XP from fights, as a multiplier. */
  xp?: number;
  /** Added to every Hero's magic find, in percent. */
  magicFind?: number;
  /** The chance of an elite, as a multiplier. */
  elites?: number;
  /** Added to Sneak Checks and Escape rolls. */
  sneak?: number;
  /** Added to every Upgrade chance, in percentage points (never above 95). */
  upgrade?: number;
  /** The Market's tax on sales made today, instead of the usual. */
  marketTax?: number;
}

export const OMEN_DEFS: Record<OmenId, OmenDef> = {
  'blood-moon': {
    id: 'blood-moon',
    name: text('Blood moon', 'Кровавая луна'),
    description: text('Monsters have 20% more health and hit 10% harder, but drop half again as much gold.', 'У монстров на 20% больше здоровья, бьют они на 10% сильнее, зато золота с них в полтора раза больше.'),
    monsterHp: 1.2, monsterDamage: 1.1, gold: 1.5,
  },
  'still-air': {
    id: 'still-air',
    name: text('Still air', 'Мёртвый штиль'),
    description: text('Not a sound carries: +3 to Sneak Checks and Escape rolls.', 'Ни звука не разносится: +3 к проверкам скрытности и броскам побега.'),
    sneak: 3,
  },
  'scholars-day': {
    id: 'scholars-day',
    name: text('Scholar’s day', 'День учёного'),
    description: text('Every fight teaches more: +25% XP.', 'Каждый бой учит большему: +25% опыта.'),
    xp: 1.25,
  },
  'fortunes-wind': {
    id: 'fortunes-wind',
    name: text('Fortune’s wind', 'Ветер удачи'),
    description: text('The dark is generous: +25% magic find for everyone.', 'Тьма сегодня щедра: +25% к удаче в добыче у всех.'),
    magicFind: 25,
  },
  'hunting-season': {
    id: 'hunting-season',
    name: text('Hunting season', 'Сезон охоты'),
    description: text('Elites lead twice as many groups.', 'Элита ведёт вдвое больше групп.'),
    elites: 2,
  },
  'hot-forges': {
    id: 'hot-forges',
    name: text('Hot forges', 'Жаркие горны'),
    description: text('The Forge burns hot: +10% on every Upgrade.', 'Горны раскалены: +10% к шансу каждого улучшения.'),
    upgrade: 10,
  },
  'free-market': {
    id: 'free-market',
    name: text('Free market', 'Вольный рынок'),
    description: text('The Market takes no tax on today’s sales.', 'Рынок не берёт налог с сегодняшних продаж.'),
    marketTax: 0,
  },
  'dim-day': {
    id: 'dim-day',
    name: text('Dim day', 'Тусклый день'),
    description: text('Monsters are sluggish, with 10% less health, and a little poorer: −20% gold.', 'Монстры вялые, здоровья у них на 10% меньше, да и золота на 20% меньше.'),
    monsterHp: 0.9, gold: 0.8,
  },
};

/** How often a day has no Omen at all, against 1 for each Omen (v0): about a third of days. */
export const PLAIN_DAY_WEIGHT = 4;

/** The day's Omen, or null for a plain day. */
export function omenFor(seasonSeed: string, day: number): OmenId | null {
  const rng = createRng(`${seasonSeed}:omen:${day}`);
  const pick = rng.int(0, OMENS.length + PLAIN_DAY_WEIGHT - 1);
  return pick < OMENS.length ? OMENS[pick]! : null;
}
