// PROTOTYPE content tables. Real numbers live in docs/design.md; demo odds here are
// deliberately generous so the look test shows the rare effects often.

export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'relic'];

export const TIER_COLOR = {
  common: '#a8a39a',
  uncommon: '#5fbf4f',
  rare: '#4b8dff',
  epic: '#b066ff',
  legendary: '#ff8c1a',
  mythic: '#ff3344',
  relic: '#f1c75b',
};

export const tierRank = (tier) => TIERS.indexOf(tier);

export const HEROES = [
  {
    id: 'fighter', name: 'Garrick', art: 'assets/hero-human-fighter.png', banner: '#9e2a2a',
    race: { en: 'Human', ru: 'Человек' }, cls: { en: 'Fighter', ru: 'Воин' },
    level: 7, hp: 64, ac: 17, atk: 7, dmg: [1, 10, 4], crop: { x: 50, y: 42, zoom: 1.25 },
    scores: { STR: 17, DEX: 12, CON: 15, INT: 9, WIS: 11, CHA: 10 },
  },
  {
    id: 'wizard', name: 'Elowen', art: 'assets/hero-elf-wizard.png', banner: '#3b5fa8',
    race: { en: 'Elf', ru: 'Эльф' }, cls: { en: 'Wizard', ru: 'Волшебник' },
    level: 7, hp: 38, ac: 13, atk: 8, dmg: [2, 8, 3], crop: { x: 50, y: 40, zoom: 1.25 },
    scores: { STR: 8, DEX: 14, CON: 12, INT: 17, WIS: 13, CHA: 10 },
  },
  {
    id: 'rogue', name: 'Pip', art: 'assets/hero-halfling-rogue.png', banner: '#3f7a4a',
    race: { en: 'Halfling', ru: 'Полурослик' }, cls: { en: 'Rogue', ru: 'Плут' },
    level: 7, hp: 46, ac: 15, atk: 8, dmg: [1, 6, 6], crop: { x: 50, y: 42, zoom: 1.25 },
    scores: { STR: 9, DEX: 17, CON: 13, INT: 12, WIS: 12, CHA: 14 },
  },
  {
    id: 'cleric', name: 'Borin', art: 'assets/hero-dwarf-cleric.png', banner: '#b08a2e',
    race: { en: 'Dwarf', ru: 'Дварф' }, cls: { en: 'Cleric', ru: 'Жрец' },
    level: 7, hp: 56, ac: 18, atk: 6, dmg: [1, 8, 4], crop: { x: 50, y: 42, zoom: 1.2 },
    scores: { STR: 14, DEX: 10, CON: 16, INT: 10, WIS: 17, CHA: 11 },
  },
];

export const MONSTERS = {
  goblin: { art: 'assets/monster-goblin.png', name: { en: 'Goblin', ru: 'Гоблин' }, hp: 11, ac: 12, atk: 4, dmg: [1, 6, 1], crop: { x: 50, y: 45, zoom: 1.2 } },
  skeleton: { art: 'assets/monster-skeleton.png', name: { en: 'Skeleton', ru: 'Скелет' }, hp: 15, ac: 13, atk: 4, dmg: [1, 6, 2], crop: { x: 50, y: 42, zoom: 1.2 } },
  imp: { art: 'assets/monster-imp.png', name: { en: 'Imp', ru: 'Бес' }, hp: 12, ac: 13, atk: 5, dmg: [1, 4, 3], crop: { x: 50, y: 45, zoom: 1.15 } },
  dragon: { art: 'assets/boss-dragon.png', name: { en: 'Ancient Dragon', ru: 'Древний дракон' }, hp: 420, ac: 19, atk: 12, dmg: [4, 10, 8], boss: true, crop: { x: 50, y: 48, zoom: 1.1 } },
};

export const ROOMS = {
  goblins: { floor: 2, art: 'assets/room-goblins.jpg', name: 'roomGoblins', clue: 'clueGoblins', monsters: ['goblin', 'goblin', 'goblin'] },
  crypt: { floor: 5, art: 'assets/room-crypt.jpg', name: 'roomCrypt', clue: 'clueCrypt', monsters: ['skeleton', 'skeleton'] },
  demons: { floor: 8, art: 'assets/room-demons.jpg', name: 'roomDemons', clue: 'clueDemons', monsters: ['imp', 'imp', 'imp'] },
  lair: { floor: 10, art: 'assets/room-demons.jpg', name: 'roomLair', clue: 'clueDemons', monsters: ['dragon'] },
};

// Buildings on city-map.jpg, as % of the image. `life` marks torch glows and smoke.
export const BUILDINGS = [
  { id: 'temple', x: 63, y: 12.5 },
  { id: 'market', x: 23, y: 38.5 },
  { id: 'tavern', x: 52, y: 38.5 },
  { id: 'forge', x: 86, y: 41.5 },
  { id: 'shops', x: 25.5, y: 55.5 },
  { id: 'houses', x: 71, y: 63, later: true },
  { id: 'gate', x: 50, y: 79.5 },
];
export const TORCHES = [[37.3, 80], [64, 80], [43, 87.1], [57.6, 87.1], [56.5, 55.7], [64.2, 55.3], [57, 21.4]];
export const SMOKE = [88.4, 38];

// Item bases. `art` only on the painted Legendary+ item we have.
export const BASES = [
  { id: 'sword', icon: 'sword', name: { en: 'Longsword', ru: 'Длинный меч' }, slot: 'main' },
  { id: 'axe', icon: 'axe', name: { en: 'Battleaxe', ru: 'Боевой топор' }, slot: 'main' },
  { id: 'dagger', icon: 'dagger', name: { en: 'Dagger', ru: 'Кинжал' }, slot: 'main' },
  { id: 'bow', icon: 'bow', name: { en: 'Shortbow', ru: 'Короткий лук' }, slot: 'main' },
  { id: 'staff', icon: 'staff', name: { en: 'Staff', ru: 'Посох' }, slot: 'main' },
  { id: 'mace', icon: 'mace', name: { en: 'Mace', ru: 'Булава' }, slot: 'main' },
  { id: 'shield', icon: 'shield', name: { en: 'Shield', ru: 'Щит' }, slot: 'off' },
  { id: 'helm', icon: 'helm', name: { en: 'Helm', ru: 'Шлем' }, slot: 'head' },
  { id: 'armor', icon: 'armor', name: { en: 'Breastplate', ru: 'Кираса' }, slot: 'body' },
  { id: 'gloves', icon: 'gloves', name: { en: 'Gauntlets', ru: 'Латные перчатки' }, slot: 'hands' },
  { id: 'boots', icon: 'boots', name: { en: 'Boots', ru: 'Сапоги' }, slot: 'feet' },
  { id: 'ring', icon: 'ring', name: { en: 'Ring', ru: 'Кольцо' }, slot: 'ring' },
  { id: 'amulet', icon: 'amulet', name: { en: 'Amulet', ru: 'Амулет' }, slot: 'amulet' },
];

// "X of Y" names avoid Russian gender agreement: "Кинжал пепла", "Сапоги сумерек".
export const SUFFIXES = [
  { en: 'of Ash', ru: 'пепла' }, { en: 'of Dusk', ru: 'сумерек' }, { en: 'of the Crypt', ru: 'склепа' },
  { en: 'of Embers', ru: 'углей' }, { en: 'of Ruin', ru: 'разорения' }, { en: 'of the Wolf', ru: 'волка' },
  { en: 'of Thorns', ru: 'шипов' }, { en: 'of the Hollow', ru: 'пустоты' }, { en: 'of Blood', ru: 'крови' },
  { en: 'of Frost', ru: 'инея' },
];

export const DRAGONBONE = {
  base: 'sword', art: 'assets/item-dragonbone-blade.png',
  name: { en: 'Dragonbone Blade', ru: 'Клинок драконьей кости' },
  power: { en: 'Dragonfire: critical hits set the enemy ablaze for 3 turns.', ru: 'Драконий огонь: критический удар поджигает врага на 3 хода.' },
};

export const BONUS_STATS = [
  { en: '+{n} Strength', ru: '+{n} к силе', range: [1, 4] },
  { en: '+{n} Dexterity', ru: '+{n} к ловкости', range: [1, 4] },
  { en: '+{n} Constitution', ru: '+{n} к телосложению', range: [1, 4] },
  { en: '+{n} Intelligence', ru: '+{n} к интеллекту', range: [1, 4] },
  { en: '+{n} Wisdom', ru: '+{n} к мудрости', range: [1, 4] },
  { en: '+{n} max health', ru: '+{n} к здоровью', range: [5, 30] },
  { en: '+{n} armor', ru: '+{n} к броне', range: [1, 3] },
  { en: '+{n}% damage', ru: '+{n}% к урону', range: [4, 18] },
  { en: '+{n}% critical chance', ru: '+{n}% к шансу крита', range: [2, 8] },
  { en: '+{n}% gold find', ru: '+{n}% к золоту', range: [5, 25] },
  { en: '+{n}% magic find', ru: '+{n}% к удаче в добыче', range: [3, 15] },
  { en: '+{n}% escape chance', ru: '+{n}% к шансу побега', range: [5, 20] },
  { en: '+{n}% life steal', ru: '+{n}% вампиризма', range: [2, 6] },
  { en: '+{n} fire resistance', ru: '+{n} к сопротивлению огню', range: [5, 20] },
];

export const BONUS_COUNT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, relic: 5 };
export const BUYBACK = { common: 5, uncommon: 15, rare: 60, epic: 250, legendary: 1200, mythic: 6000, relic: 20000 };

// Chest odds from docs/design.md.
export const CHESTS = {
  iron: { key: 50, odds: [['uncommon', 70], ['rare', 22], ['epic', 6.5], ['legendary', 1.3], ['mythic', 0.2]] },
  silver: { key: 250, odds: [['rare', 70], ['epic', 24], ['legendary', 5], ['mythic', 1]] },
  gold: { key: 1000, odds: [['epic', 75], ['legendary', 21], ['mythic', 4]] },
};

// Demo-only fight loot odds (generous on purpose).
export const DEMO_DROP = [['uncommon', 18], ['rare', 30], ['epic', 26], ['legendary', 16], ['mythic', 8], ['relic', 2]];

export const OWNERS = ['Borin', 'Pip', 'Elowen'];
