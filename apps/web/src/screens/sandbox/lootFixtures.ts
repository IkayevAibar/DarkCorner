import type { HeroView, ItemView, OpenChestResult } from '@dark/shared';

/** Hand-authored presentation fixtures, never game rolls or inventory mutations. */
const base: ItemView = {
  id: 'preview-rare', kind: 'gear', quantity: 1, tier: 'rare', base: 'ring', icon: 'ring',
  name: { en: 'Ring of the Watch', ru: 'Кольцо дозора' }, itemLevel: 4, identified: true,
  quality: 74, bonusStats: [{ en: '+3 Dexterity', ru: '+3 к ловкости' }, { en: '+9% Magic find', ru: '+9% к поиску магии' }],
  power: null, radiant: false, upgrade: 0, serial: null, owners: null, art: null, worth: 120,
  gear: { slot: 'ring', group: null, classes: null, damage: null, armor: null, heavy: false }, about: null,
};

export const REVEALS = {
  rare: base,
  radiant: {
    ...base, id: 'preview-radiant', tier: 'legendary', base: 'orb', icon: 'orb',
    name: { en: 'Lantern of the Deep', ru: 'Фонарь глубин' }, quality: 96, radiant: true,
    art: '/art/items/lantern-of-the-deep.webp',
    bonusStats: [{ en: '+4 Intelligence', ru: '+4 к интеллекту' }, { en: '+12 Maximum health', ru: '+12 к максимуму здоровья' }, { en: '+15% Magic find', ru: '+15% к поиску магии' }],
    power: { en: 'Deep light: reveals the darkness beyond the next Door.', ru: 'Глубинный свет: рассеивает тьму за следующей дверью.' },
    gear: { ...base.gear!, slot: 'off', group: 'orb', classes: ['wizard', 'cleric'] }, worth: 2400,
  },
  relic: {
    ...base, id: 'preview-relic', tier: 'relic', base: 'helm', icon: 'helm',
    name: { en: 'The First King’s Crown', ru: 'Корона первого короля' }, quality: 100,
    art: '/art/items/first-kings-crown.webp', serial: { number: 2, of: 3 }, owners: ['Mira', 'Garrick'],
    bonusStats: [{ en: '+5 Constitution', ru: '+5 к телосложению' }, { en: '+20 Maximum health', ru: '+20 к максимуму здоровья' }, { en: '+25% Gold find', ru: '+25% к поиску золота' }],
    power: { en: 'A king’s resolve: stand your ground when all hope is lost.', ru: 'Воля короля: стойкость, когда надежда иссякает.' },
    gear: { ...base.gear!, slot: 'head', armor: { ac: 2, body: false, maxDex: null } }, worth: 0,
  },
} satisfies Record<string, ItemView>;

export function sealed(item: ItemView): ItemView {
  return { ...item, name: { en: 'Unidentified Item', ru: 'Неопознанный предмет' }, identified: false,
    art: null, quality: null, bonusStats: null, power: null, radiant: null, serial: null, owners: null };
}

export const LOOT_HERO: HeroView = {
  id: 'preview-hero', name: 'Mira', race: 'elf', class: 'wizard', talents: [],
  portrait: 'elf-wizard-1', portraitUrl: '/art/portraits/elf-wizard-1.webp', banner: '#7758a4',
  level: 4, xp: 0, xpNext: 100, abilities: { str: 10, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
  maxHp: 30, hp: 30, armorClass: 12, gold: 1000, stamina: 10, staminaMax: 10,
  worn: [], bag: [], storage: [], bagSlots: 24, storageSlots: 40, inCity: true,
  luck: { badLuck: 8, badLuckMax: 100, magicFind: 0, goldFind: 0, blessing: null },
  path: null, pathChoices: null, pendingGrowth: [], talentOffer: null, levelUp: null, deeds: [], title: null,
};

const mythic: ItemView = {
  ...base, id: 'preview-mythic', tier: 'mythic', base: 'staff', icon: 'staff',
  name: { en: 'Wyrmfire', ru: 'Пламя змея' }, quality: 92, art: '/art/items/wyrmfire.webp',
  bonusStats: [{ en: '+6 Intelligence', ru: '+6 к интеллекту' }, { en: '+18 Maximum health', ru: '+18 к максимуму здоровья' }],
  power: { en: 'Dragon fire: a blaze that will not die.', ru: 'Огонь дракона: пламя, которое не гаснет.' },
  gear: { ...base.gear!, slot: 'main', group: 'staff', classes: ['wizard', 'cleric'],
    damage: { dice: 1, sides: 6, min: 1, max: 9, percent: 150, hits: 'bludgeon' } }, worth: 12000,
};

export const CHESTS = {
  iron: { grade: 'iron', prize: { ...base, id: 'preview-iron', tier: 'uncommon', quality: 58, bonusStats: [base.bonusStats![0]!] },
    odds: [{ tier: 'uncommon', percent: 70 }, { tier: 'rare', percent: 22 }, { tier: 'epic', percent: 6.5 }, { tier: 'legendary', percent: 1.3 }, { tier: 'mythic', percent: .2 }], hero: LOOT_HERO },
  silver: { grade: 'silver', prize: sealed(base),
    odds: [{ tier: 'rare', percent: 70 }, { tier: 'epic', percent: 24 }, { tier: 'legendary', percent: 5 }, { tier: 'mythic', percent: 1 }], hero: LOOT_HERO },
  gold: { grade: 'gold', prize: sealed(mythic),
    odds: [{ tier: 'epic', percent: 75 }, { tier: 'legendary', percent: 21 }, { tier: 'mythic', percent: 4 }], hero: LOOT_HERO },
} satisfies Record<string, OpenChestResult>;
