import type { Ability } from '../abilities.js';
import { type Text, text } from './text.js';

/** Rarity, lowest to highest. Relics sit above the Tiers but share the list for ordering. */
export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'relic'] as const;
export type Tier = (typeof TIERS)[number];
export const tierRank = (tier: Tier): number => TIERS.indexOf(tier);

/** Tier names for sentences; the Russian is the adjective that goes with "предмет". */
export const TIER_TEXT: Record<Tier, Text> = {
  common: text('Common', 'обычный'), uncommon: text('Uncommon', 'необычный'), rare: text('Rare', 'редкий'),
  epic: text('Epic', 'эпический'), legendary: text('Legendary', 'легендарный'), mythic: text('Mythic', 'мифический'),
  relic: text('Relic', 'реликвия'),
};

/** Rare and better drop Unidentified. */
export const IDENTIFIED_BELOW: Tier = 'rare';

/** 1 in 200 Items of any Tier (docs/design.md, v0). */
export const RADIANT_CHANCE = 1 / 200;

/** Radiant: +10% to all its numbers. */
export const RADIANT_BOOST = 1.1;

export const BONUS_COUNT: Record<Tier, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, relic: 5,
};

/** Base Buyback price; multiplied by (1 + item level / 10). */
export const BUYBACK_BASE: Record<Tier, number> = {
  common: 5, uncommon: 15, rare: 60, epic: 250, legendary: 1200, mythic: 6000, relic: 20000,
};

/** Tier odds when an Item drops, in percent, by Floor band (docs/design.md, v0). */
export const DROP_ODDS: { floors: [number, number]; odds: [Tier, number][] }[] = [
  { floors: [1, 3], odds: [['common', 60], ['uncommon', 27], ['rare', 10], ['epic', 2.69], ['legendary', 0.3], ['mythic', 0.01]] },
  { floors: [4, 6], odds: [['common', 45], ['uncommon', 31], ['rare', 16], ['epic', 6.6], ['legendary', 1.3], ['mythic', 0.1]] },
  { floors: [7, 9], odds: [['common', 30.15], ['uncommon', 32], ['rare', 24], ['epic', 11], ['legendary', 2.6], ['mythic', 0.25]] },
  { floors: [10, 10], odds: [['common', 20.25], ['uncommon', 30], ['rare', 30], ['epic', 15], ['legendary', 4.3], ['mythic', 0.45]] },
];

export type BonusStatId =
  | Ability
  | 'maxHp' | 'armor' | 'damage' | 'crit' | 'spellPower' | 'healing'
  | 'escape' | 'goldFind' | 'magicFind' | 'lifeSteal';

export interface BonusStatDef {
  id: BonusStatId;
  /** "{n}" is replaced by the value. */
  label: Text;
  /** Value range on an item level 1 Common; grows with item level and Tier. */
  range: [number, number];
}

export const BONUS_STATS: BonusStatDef[] = [
  { id: 'str', label: text('+{n} Strength', '+{n} к силе'), range: [1, 2] },
  { id: 'dex', label: text('+{n} Dexterity', '+{n} к ловкости'), range: [1, 2] },
  { id: 'con', label: text('+{n} Constitution', '+{n} к телосложению'), range: [1, 2] },
  { id: 'int', label: text('+{n} Intelligence', '+{n} к интеллекту'), range: [1, 2] },
  { id: 'wis', label: text('+{n} Wisdom', '+{n} к мудрости'), range: [1, 2] },
  { id: 'cha', label: text('+{n} Charisma', '+{n} к харизме'), range: [1, 2] },
  { id: 'maxHp', label: text('+{n} max health', '+{n} к здоровью'), range: [4, 10] },
  { id: 'armor', label: text('+{n} armor', '+{n} к броне'), range: [1, 1] },
  { id: 'damage', label: text('+{n}% damage', '+{n}% к урону'), range: [3, 8] },
  { id: 'crit', label: text('+{n}% critical chance', '+{n}% к шансу крита'), range: [1, 3] },
  { id: 'spellPower', label: text('+{n}% spell power', '+{n}% к силе заклинаний'), range: [3, 8] },
  { id: 'healing', label: text('+{n}% healing', '+{n}% к лечению'), range: [4, 10] },
  { id: 'escape', label: text('+{n}% escape chance', '+{n}% к шансу побега'), range: [4, 10] },
  { id: 'goldFind', label: text('+{n}% gold find', '+{n}% к золоту'), range: [4, 12] },
  { id: 'magicFind', label: text('+{n}% magic find', '+{n}% к удаче в добыче'), range: [2, 6] },
  { id: 'lifeSteal', label: text('+{n}% life steal', '+{n}% вампиризма'), range: [1, 3] },
];

/** "X of Y" names: the genitive suffix needs no gender agreement in Russian. */
export const SUFFIXES: Text[] = [
  text('of Ash', 'пепла'), text('of Dusk', 'сумерек'), text('of the Crypt', 'склепа'),
  text('of Embers', 'углей'), text('of Ruin', 'разорения'), text('of the Wolf', 'волка'),
  text('of Thorns', 'шипов'), text('of the Hollow', 'пустоты'), text('of Blood', 'крови'),
  text('of Frost', 'инея'), text('of the Raven', 'ворона'), text('of Bone', 'кости'),
  text('of the Deep', 'глубин'), text('of Cinders', 'золы'),
];

export interface UniqueDef {
  id: string;
  tier: 'legendary' | 'mythic' | 'relic';
  base: string;
  name: Text;
  power: Text;
  /** Painted art; null until it has been made (the web falls back to the base icon). */
  art: string | null;
  /** Relics only: how many copies exist in a Season. */
  copies?: number;
}

/** Season 0 uniques. Named, painted (eventually), each with one power. */
export const UNIQUES: UniqueDef[] = [
  // Legendary
  { id: 'ember-fang', tier: 'legendary', base: 'longsword', art: '/art/items/ember-fang.webp', name: text('Ember Fang', 'Угольный клык'),
    power: text('Dragonfire: critical hits set the enemy ablaze for 3 turns.', 'Драконий огонь: критический удар поджигает врага на 3 хода.') },
  { id: 'gravewhisper', tier: 'legendary', base: 'dagger', art: '/art/items/gravewhisper.webp', name: text('Gravewhisper', 'Шёпот могилы'),
    power: text('Your first hit in every fight is a critical hit.', 'Первый удар в каждом бою — критический.') },
  { id: 'oathbreaker', tier: 'legendary', base: 'greataxe', art: '/art/items/oathbreaker.webp', name: text('Oathbreaker', 'Клятвопреступник'),
    power: text('+50% damage while below half health.', '+50% к урону, пока здоровья меньше половины.') },
  { id: 'hollow-crown', tier: 'legendary', base: 'helm', art: '/art/items/hollow-crown.webp', name: text('The Hollow Crown', 'Пустой венец'),
    power: text('Door Clues never lie to you.', 'Подсказки на дверях вам никогда не лгут.') },
  { id: 'ashen-aegis', tier: 'legendary', base: 'shield', art: '/art/items/ashen-aegis.webp', name: text('Ashen Aegis', 'Пепельная эгида'),
    power: text('Blocks the first hit of every fight.', 'Блокирует первый удар в каждом бою.') },
  { id: 'wardens-longbow', tier: 'legendary', base: 'longbow', art: '/art/items/wardens-longbow.webp', name: text('Warden’s Longbow', 'Лук стража'),
    power: text('You always strike first.', 'В бою первый удар всегда за вами.') },
  { id: 'lantern-of-the-deep', tier: 'legendary', base: 'orb', art: '/art/items/lantern-of-the-deep.webp', name: text('Lantern of the Deep', 'Фонарь глубин'),
    power: text('Spells deal +25% damage to undead and demons.', 'Заклинания наносят +25% урона нежити и демонам.') },
  { id: 'saints-knuckle', tier: 'legendary', base: 'holy-symbol', art: '/art/items/saints-knuckle.webp', name: text('Saint’s Knuckle', 'Мощи святого'),
    power: text('Healing spells also restore one use of an ability.', 'Лечебные заклинания также возвращают одно использование умения.') },
  // Mythic
  { id: 'wyrmfire', tier: 'mythic', base: 'greatsword', art: '/art/items/wyrmfire.webp', name: text('Wyrmfire', 'Пламя змия'),
    power: text('Every critical hit also scorches all other enemies.', 'Каждый критический удар обжигает и остальных врагов.') },
  { id: 'last-ember', tier: 'mythic', base: 'staff', art: '/art/items/last-ember.webp', name: text('The Last Ember', 'Последний уголь'),
    power: text('Once per fight, a spell that would miss hits instead, for double damage.', 'Раз за бой промахнувшееся заклинание всё же попадает — с двойным уроном.') },
  { id: 'deathless-mail', tier: 'mythic', base: 'plate', art: '/art/items/deathless-mail.webp', name: text('Deathless Mail', 'Бессмертная броня'),
    power: text('Once per Run, survive a killing blow with 1 health.', 'Раз за вылазку смертельный удар оставляет вам 1 здоровья.') },
  { id: 'luckstone', tier: 'mythic', base: 'ring', art: '/art/items/luckstone.webp', name: text('Luckstone', 'Камень удачи'),
    power: text('Once per Run, reroll any d20 and keep the better roll.', 'Раз за вылазку можно перебросить любой d20 и оставить лучший бросок.') },
  { id: 'drowned-crown', tier: 'mythic', base: 'helm', art: '/art/items/drowned-crown.webp', name: text('Crown of the Drowned King', 'Корона утонувшего короля'),
    power: text('Monsters’ natural 20s are not critical hits against you.', 'Натуральные 20 у монстров не становятся против вас критическими ударами.') },
  // Relics: numbered copies, found in Vaults and on deep Mini-bosses
  { id: 'dragonbone-blade', tier: 'relic', base: 'longsword', art: '/art/items/dragonbone-blade.webp', copies: 3,
    name: text('The Dragonbone Blade', 'Клинок драконьей кости'),
    power: text('Dragonsbane: double damage to dragons and their kin.', 'Гибель драконов: двойной урон драконам и их сородичам.') },
  { id: 'phylactery', tier: 'relic', base: 'amulet', art: '/art/items/phylactery.webp', copies: 2,
    name: text('The Lich’s Phylactery', 'Филактерия лича'),
    power: text('+2 to every ability score.', '+2 ко всем характеристикам.') },
  { id: 'eye-of-the-abyss', tier: 'relic', base: 'orb', art: '/art/items/eye-of-the-abyss.webp', copies: 2,
    name: text('Eye of the Abyss', 'Око бездны'),
    power: text('Shows every Special room on your Floor.', 'Показывает все особые комнаты на вашем этаже.') },
  { id: 'first-kings-crown', tier: 'relic', base: 'helm', art: '/art/items/first-kings-crown.webp', copies: 1,
    name: text('Crown of the First King', 'Корона первого короля'),
    power: text('Your Bad-luck meter fills twice as fast.', 'Ваш счётчик невезения наполняется вдвое быстрее.') },
];

const UNIQUE_BY_ID = new Map(UNIQUES.map((u) => [u.id, u]));

export function uniqueById(id: string): UniqueDef {
  const unique = UNIQUE_BY_ID.get(id);
  if (!unique) throw new Error(`unknown unique "${id}"`);
  return unique;
}

export const uniquesOfTier = (tier: UniqueDef['tier']): UniqueDef[] => UNIQUES.filter((u) => u.tier === tier);
