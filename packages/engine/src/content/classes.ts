import type { Ability } from '../abilities.js';
import { type Text, text } from './text.js';

export const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric'] as const;
export type ClassId = (typeof CLASSES)[number];

/** Weapon, off-hand and armor types a Class can use (Proficiencies, docs/design.md). */
export type WeaponType = 'heavy' | 'blade' | 'dagger' | 'bow' | 'mace' | 'staff';
export type OffHandType = 'shield' | 'orb' | 'holy-symbol';
export type ArmorType = 'heavy' | 'medium' | 'light' | 'robes';

export interface ClassDef {
  id: ClassId;
  name: Text;
  hitDie: 6 | 8 | 10 | 12;
  /** The ability its attacks and spells lean on. */
  primary: Ability;
  /** Saving throws it adds its proficiency bonus to (SRD). */
  saves: [Ability, Ability];
  weapons: WeaponType[];
  offHands: OffHandType[];
  armor: ArmorType[];
  fights: Text;
  trick: Text;
  /** Base ids of the free Common gear a Hero of this Class starts with and wakes up with. */
  starterKit: string[];
}

export const CLASS_DEFS: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: text('Fighter', 'Воин'),
    hitDie: 10,
    primary: 'str',
    saves: ['str', 'con'],
    weapons: ['heavy', 'blade', 'dagger', 'bow', 'mace'],
    offHands: ['shield'],
    armor: ['heavy', 'medium', 'light'],
    fights: text(
      'Most health, heavy armor, extra attacks. Second wind heals once per fight.',
      'Больше всех здоровья, тяжёлая броня, дополнительные атаки. Второе дыхание лечит раз за бой.',
    ),
    trick: text(
      'Smashes cracked walls to open shortcuts other Classes can’t use.',
      'Проламывает треснувшие стены — открывает короткие пути, недоступные другим.',
    ),
    starterKit: ['longsword', 'shield', 'chainmail'],
  },
  rogue: {
    id: 'rogue',
    name: text('Rogue', 'Плут'),
    hitDie: 8,
    primary: 'dex',
    saves: ['dex', 'int'],
    weapons: ['blade', 'dagger', 'bow'],
    offHands: [],
    armor: ['light'],
    fights: text(
      'Critical hits, strikes first, a big Sneak attack on the first hit of a fight and a smaller one each round after.',
      'Критические удары, первый ход в бою, мощная скрытая атака первым попаданием и послабее — каждый следующий раунд.',
    ),
    trick: text(
      'Picks locks, disarms traps, spots lying Clues, has the best odds on Escape rolls.',
      'Вскрывает замки, обезвреживает ловушки, замечает лживые подсказки, лучше всех убегает.',
    ),
    starterKit: ['rapier', 'shortbow', 'leather'],
  },
  wizard: {
    id: 'wizard',
    name: text('Wizard', 'Волшебник'),
    hitDie: 6,
    primary: 'int',
    saves: ['int', 'wis'],
    weapons: ['dagger', 'staff'],
    offHands: ['orb'],
    armor: ['robes'],
    fights: text('Big spell damage, but fragile. Limited spells per rest.', 'Мощные заклинания, но мало здоровья. Число заклинаний до отдыха ограничено.'),
    trick: text('Senses traps and curses. Identifies Items for free.', 'Чует ловушки и проклятия. Опознаёт предметы бесплатно.'),
    starterKit: ['staff', 'orb', 'robes'],
  },
  cleric: {
    id: 'cleric',
    name: text('Cleric', 'Жрец'),
    hitDie: 8,
    primary: 'wis',
    saves: ['wis', 'cha'],
    weapons: ['mace', 'staff'],
    offHands: ['shield', 'holy-symbol'],
    armor: ['medium', 'light', 'robes'],
    fights: text('Heals itself. Its spells are deadly to undead.', 'Лечит себя, а заклинания губительны для нежити.'),
    trick: text('Rolls with advantage at Shrines.', 'Бросает с преимуществом у святилищ.'),
    starterKit: ['mace', 'shield', 'breastplate'],
  },
};
