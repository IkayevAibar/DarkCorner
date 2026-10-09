import type { Ability } from '../abilities.js';
import { type Text, text } from './text.js';

export const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'ranger', 'paladin', 'warlock', 'monk', 'druid', 'bard', 'sorcerer'] as const;
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
  paladin: {
    id: 'paladin',
    name: text('Paladin', 'Паладин'),
    hitDie: 10,
    primary: 'str',
    saves: ['wis', 'cha'],
    weapons: ['heavy', 'blade', 'mace'],
    offHands: ['shield'],
    armor: ['heavy', 'medium', 'light'],
    fights: text(
      'Heavy armor and two attacks from level 5. Divine smite pours holy fire into a hit, Lay on hands heals, and from level 6 an aura steadies every save.',
      'Тяжёлая броня и две атаки с 5-го уровня. Божественная кара вливает в удар святой огонь, наложение рук лечит, а с 6-го уровня аура укрепляет каждый спасбросок.',
    ),
    trick: text(
      'Divine sense: sees through lying Clues in the crypts and the depths, where the undead and demons lurk.',
      'Божественное чувство: видит ложь в подсказках склепов и глубин, где таятся нежить и демоны.',
    ),
    starterKit: ['warhammer', 'shield', 'chainmail'],
  },
  warlock: {
    id: 'warlock',
    name: text('Warlock', 'Колдун'),
    hitDie: 8,
    primary: 'cha',
    saves: ['wis', 'cha'],
    weapons: ['dagger', 'staff'],
    offHands: ['orb'],
    // Armor of shadows: robes woven with wards, as a Wizard wears.
    armor: ['light', 'robes'],
    fights: text(
      'Eldritch blast at will: a beam of force, and more beams as it grows. Hex curses the toughest foe, and every hit on it bites harder.',
      'Мистический заряд без ограничений: луч силы, а с ростом — больше лучей. Порча проклинает самого опасного врага, и каждое попадание по нему жалит сильнее.',
    ),
    trick: text('Devil’s sight: always finds secret Doors.', 'Дьявольское зрение: всегда находит потайные двери.'),
    starterKit: ['dagger', 'orb', 'leather'],
  },
  monk: {
    id: 'monk',
    name: text('Monk', 'Монах'),
    hitDie: 8,
    primary: 'dex',
    saves: ['str', 'dex'],
    weapons: ['dagger', 'staff'],
    offHands: [],
    armor: [],
    fights: text(
      'Wears no armor, yet is hard to hit: Armor Class 10 + DEX + WIS. Its strikes hit like a martial artist’s, harder as it grows; Flurry of blows adds two more; two attacks from level 5, and Evasion from level 7.',
      'Не носит доспехов, но попасть в него трудно: класс доспеха 10 + ЛОВ + МДР. Бьёт как мастер боевых искусств, с ростом — всё сильнее; шквал ударов добавляет ещё два; две атаки с 5-го уровня и увёртливость с 7-го.',
    ),
    trick: text('Step of the wind: Escape rolls with advantage and its proficiency.', 'Шаг ветра: броски побега с преимуществом и бонусом мастерства.'),
    starterKit: ['staff', 'hood'],
  },
  druid: {
    id: 'druid',
    name: text('Druid', 'Друид'),
    hitDie: 8,
    primary: 'wis',
    saves: ['int', 'wis'],
    weapons: ['staff', 'dagger'],
    offHands: ['shield'],
    armor: ['light', 'medium', 'robes'],
    fights: text(
      'Thorn whip at will and Cure wounds a few times a rest. Wild shape turns it into a beast whose health takes the blows first, with two claw attacks.',
      'Терновый кнут без ограничений и «Лечение ран» несколько раз за отдых. Дикий облик превращает его в зверя, чьё здоровье первым принимает удары, с двумя атаками когтями.',
    ),
    trick: text('Herbalist: Healing potions heal half again as much.', 'Травник: зелья лечения лечат в полтора раза сильнее.'),
    starterKit: ['staff', 'shield', 'leather'],
  },
  bard: {
    id: 'bard',
    name: text('Bard', 'Бард'),
    hitDie: 8,
    primary: 'cha',
    saves: ['dex', 'cha'],
    weapons: ['blade', 'dagger', 'bow'],
    offHands: [],
    armor: ['light', 'robes'],
    fights: text(
      'Vicious mockery at will: it wounds, and its target’s next attack comes at a disadvantage. Bardic inspiration turns a missed spell into a hit, and Cure wounds heals, a few times a rest.',
      'Злая насмешка без ограничений: ранит, а следующая атака её жертвы — с помехой. Несколько раз за отдых вдохновение барда превращает промах заклинания в попадание, а «Лечение ран» лечит.',
    ),
    trick: text('Silver tongue: the Shops deal 10% better.', 'Серебряный язык: лавки торгуют на 10% выгоднее.'),
    starterKit: ['rapier', 'leather'],
  },
  sorcerer: {
    id: 'sorcerer',
    name: text('Sorcerer', 'Чародей'),
    hitDie: 6,
    primary: 'cha',
    saves: ['con', 'cha'],
    weapons: ['dagger', 'staff'],
    offHands: ['orb'],
    armor: ['robes'],
    fights: text(
      'Fire bolt at will, and sorcery points for a Burst of fire or a Quickened spell (two attack spells in one turn); no Shield.',
      'Огненный снаряд без ограничений и очки чародейства на огненный взрыв или ускоренное заклинание (два боевых заклинания за ход); без «Щита».',
    ),
    trick: text('Sorcerous sense: identifies Items for free.', 'Чародейское чутьё: опознаёт предметы бесплатно.'),
    starterKit: ['staff', 'orb', 'robes'],
  },
};

/** Classes whose attacks are spells (their weapons count only for their Bonus stats). A Druid in beast form fights with claws instead. */
export const CASTERS: readonly ClassId[] = ['wizard', 'cleric', 'warlock', 'druid', 'bard', 'sorcerer'];
