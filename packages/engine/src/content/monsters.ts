import type { ThemeId } from './floors.js';
import { type Text, text } from './text.js';

export type MonsterKin = 'beast' | 'goblinoid' | 'undead' | 'demon' | 'dragonkin' | 'humanoid';

export interface MonsterDef {
  id: string;
  name: Text;
  theme: ThemeId;
  kin: MonsterKin;
  /** Token art under apps/web/public/art/tokens; null until painted. */
  art: string | null;
  role: 'minion' | 'brute' | 'miniboss' | 'boss';
  hp: number;
  ac: number;
  /** Attack bonus added to the d20. */
  attack: number;
  /** [dice, sides, bonus]. */
  damage: [number, number, number];
  dex: number;
  xp: number;
  /** How often it shows up in a fight Room of its theme. */
  weight: number;
}

const m = (d: MonsterDef) => d;

/** Season 0 bestiary. Stats are v0 and get tuned by the balance tests. */
export const MONSTERS: MonsterDef[] = [
  // Floors 1–3: goblin warrens and beasts
  m({ id: 'giant-rat', name: text('Giant rat', 'Гигантская крыса'), theme: 'warrens', kin: 'beast', art: null, role: 'minion', hp: 4, ac: 11, attack: 3, damage: [1, 4, 1], dex: 14, xp: 6, weight: 3 }),
  m({ id: 'goblin', name: text('Goblin', 'Гоблин'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin.png', role: 'minion', hp: 7, ac: 12, attack: 3, damage: [1, 6, 1], dex: 14, xp: 10, weight: 4 }),
  m({ id: 'goblin-archer', name: text('Goblin archer', 'Гоблин-лучник'), theme: 'warrens', kin: 'goblinoid', art: null, role: 'minion', hp: 6, ac: 12, attack: 3, damage: [1, 6, 1], dex: 16, xp: 10, weight: 2 }),
  m({ id: 'wolf', name: text('Wolf', 'Волк'), theme: 'warrens', kin: 'beast', art: null, role: 'brute', hp: 11, ac: 12, attack: 4, damage: [2, 4, 1], dex: 15, xp: 18, weight: 2 }),
  m({ id: 'goblin-chieftain', name: text('Goblin chieftain', 'Вождь гоблинов'), theme: 'warrens', kin: 'goblinoid', art: null, role: 'miniboss', hp: 30, ac: 15, attack: 5, damage: [2, 6, 2], dex: 14, xp: 90, weight: 0 }),

  // Floors 4–6: undead crypts
  m({ id: 'skeleton', name: text('Skeleton', 'Скелет'), theme: 'crypts', kin: 'undead', art: '/art/tokens/skeleton.png', role: 'minion', hp: 13, ac: 13, attack: 4, damage: [1, 6, 2], dex: 14, xp: 25, weight: 4 }),
  m({ id: 'zombie', name: text('Zombie', 'Зомби'), theme: 'crypts', kin: 'undead', art: null, role: 'minion', hp: 22, ac: 8, attack: 3, damage: [1, 6, 1], dex: 6, xp: 25, weight: 3 }),
  m({ id: 'ghoul', name: text('Ghoul', 'Упырь'), theme: 'crypts', kin: 'undead', art: null, role: 'brute', hp: 22, ac: 12, attack: 4, damage: [2, 6, 2], dex: 15, xp: 45, weight: 2 }),
  m({ id: 'wraith', name: text('Wraith', 'Призрак'), theme: 'crypts', kin: 'undead', art: null, role: 'brute', hp: 30, ac: 13, attack: 5, damage: [2, 8, 2], dex: 16, xp: 90, weight: 1 }),
  m({ id: 'bone-knight', name: text('Bone knight', 'Костяной рыцарь'), theme: 'crypts', kin: 'undead', art: null, role: 'miniboss', hp: 65, ac: 17, attack: 6, damage: [2, 8, 4], dex: 12, xp: 250, weight: 0 }),

  // Floors 7–9: demon-touched depths
  m({ id: 'cultist', name: text('Cultist', 'Культист'), theme: 'depths', kin: 'humanoid', art: null, role: 'minion', hp: 20, ac: 12, attack: 5, damage: [1, 8, 2], dex: 12, xp: 45, weight: 3 }),
  m({ id: 'imp', name: text('Imp', 'Бес'), theme: 'depths', kin: 'demon', art: '/art/tokens/imp.png', role: 'minion', hp: 18, ac: 13, attack: 5, damage: [1, 6, 3], dex: 17, xp: 50, weight: 4 }),
  m({ id: 'hellhound', name: text('Hellhound', 'Адская гончая'), theme: 'depths', kin: 'demon', art: null, role: 'brute', hp: 45, ac: 15, attack: 6, damage: [1, 8, 4], dex: 14, xp: 100, weight: 2 }),
  m({ id: 'demon-brute', name: text('Demon brute', 'Демон-громила'), theme: 'depths', kin: 'demon', art: null, role: 'brute', hp: 60, ac: 14, attack: 7, damage: [2, 8, 4], dex: 10, xp: 160, weight: 1 }),
  m({ id: 'horned-tyrant', name: text('Horned tyrant', 'Рогатый тиран'), theme: 'depths', kin: 'demon', art: null, role: 'miniboss', hp: 120, ac: 17, attack: 8, damage: [3, 8, 5], dex: 12, xp: 500, weight: 0 }),

  // Floor 10: the Dragon's lair
  m({ id: 'kobold', name: text('Kobold', 'Кобольд'), theme: 'lair', kin: 'dragonkin', art: null, role: 'minion', hp: 16, ac: 13, attack: 6, damage: [1, 6, 3], dex: 15, xp: 60, weight: 3 }),
  m({ id: 'drake', name: text('Drake', 'Дрейк'), theme: 'lair', kin: 'dragonkin', art: null, role: 'brute', hp: 70, ac: 16, attack: 8, damage: [2, 8, 5], dex: 12, xp: 250, weight: 2 }),
  m({ id: 'ancient-dragon', name: text('The Ancient Dragon', 'Древний дракон'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/dragon.png', role: 'boss', hp: 480, ac: 20, attack: 13, damage: [4, 10, 8], dex: 10, xp: 5000, weight: 0 }),
];

const BY_ID = new Map(MONSTERS.map((d) => [d.id, d]));

export function monsterById(id: string): MonsterDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown monster "${id}"`);
  return def;
}
