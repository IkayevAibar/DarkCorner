import type { Ability } from '../abilities.js';
import { type Text, text } from './text.js';

export const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'ranger'] as const;
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

/** Classes strong enough to smash a cracked wall: the shortcuts only they can take (and see). */
export const breaksWalls = (cls: ClassId): boolean => cls === 'fighter' || cls === 'barbarian';

/** A Barbarian's trick: half damage from traps. */
export const TRAP_SHRUG = 0.5;

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
      'Heavy armor and the most attacks. Second wind heals once per fight.',
      'Тяжёлая броня и больше всех атак. Второе дыхание лечит раз за бой.',
    ),
    trick: text(
      'Smashes cracked walls to open shortcuts only Fighters and Barbarians can use.',
      'Проламывает треснувшие стены — открывает короткие пути, доступные только воинам и варварам.',
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
    starterKit: ['rapier', 'dagger', 'leather'],
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
    fights: text(
      'Big spell damage, but fragile. Limited spells per rest. A Shield turns aside the first blow of every fight.',
      'Мощные заклинания, но мало здоровья. Число заклинаний до отдыха ограничено. «Щит» отводит первый удар в каждом бою.',
    ),
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
  barbarian: {
    id: 'barbarian',
    name: text('Barbarian', 'Варвар'),
    hitDie: 12,
    primary: 'str',
    saves: ['str', 'con'],
    weapons: ['heavy', 'blade', 'mace'],
    offHands: ['shield'],
    armor: ['medium', 'light'],
    fights: text(
      'The most health of all. Rages when a fight turns hard: hits harder, and blows hurt it less. Sees blasts and breath coming.',
      'Больше всех здоровья. Впадает в ярость, когда бой становится тяжёлым: бьёт сильнее, а удары ранят слабее. Чует взрывы и дыхание заранее.',
    ),
    trick: text(
      'Smashes cracked walls like a Fighter, and shrugs off half of every trap.',
      'Проламывает треснувшие стены, как воин, и получает от ловушек лишь половину урона.',
    ),
    starterKit: ['greataxe', 'scale'],
  },
  ranger: {
    id: 'ranger',
    name: text('Ranger', 'Следопыт'),
    hitDie: 10,
    primary: 'dex',
    saves: ['str', 'dex'],
    weapons: ['bow', 'blade', 'dagger'],
    offHands: ['shield'],
    armor: ['medium', 'light'],
    fights: text(
      'A sure hand with a bow. Marks the toughest foe in a hard fight and hits it harder until it falls.',
      'Метко стреляет из лука. В тяжёлом бою помечает самого опасного врага и бьёт его сильнее, пока тот не падёт.',
    ),
    trick: text('Reads the tracks: always knows when a Clue lies.', 'Читает следы: всегда знает, когда подсказка лжёт.'),
    starterKit: ['longbow', 'scale'],
  },
};
