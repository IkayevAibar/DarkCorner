import type { ClassId } from './classes.js';
import { type Text, text } from './text.js';

/**
 * Paths: at level 3 a Hero chooses one of two for its Class, and it grows into
 * it at level 9 (docs/design.md → Growing: Paths and Talents, v0). Retiring is
 * the only way to try the other one in the same Season.
 */
export const PATHS = ['champion', 'guardian', 'thief', 'assassin', 'evoker', 'abjurer', 'life', 'war'] as const;
export type PathId = (typeof PATHS)[number];

/** The level a Path is chosen at, and the level its second feature comes. */
export const PATH_LEVEL = 3;
export const PATH_MASTERY = 9;

export interface PathFeature {
  level: typeof PATH_LEVEL | typeof PATH_MASTERY;
  name: Text;
  text: Text;
}

export interface PathDef {
  id: PathId;
  class: ClassId;
  name: Text;
  blurb: Text;
  features: [PathFeature, PathFeature];
}

const feature = (level: PathFeature['level'], name: Text, what: Text): PathFeature => ({ level, name, text: what });

export const PATH_DEFS: Record<PathId, PathDef> = {
  champion: {
    id: 'champion',
    class: 'fighter',
    name: text('Champion', 'Чемпион'),
    blurb: text('Lands the blows that end fights.', 'Наносит удары, которые решают бой.'),
    features: [
      feature(3, text('Improved critical', 'Улучшенный крит'), text('Critical hits on a roll one lower than before.', 'Критические удары на единицу раньше.')),
      feature(9, text('Survivor', 'Живучесть'), text(
        'At the start of each turn below half health, regain 2 + CON modifier health.',
        'В начале каждого хода, пока здоровья меньше половины, восстанавливает 2 + модификатор ТЕЛ.',
      )),
    ],
  },
  guardian: {
    id: 'guardian',
    class: 'fighter',
    name: text('Guardian', 'Страж'),
    blurb: text('Turns every miss into an opening.', 'Каждый промах врага превращает в свой шанс.'),
    features: [
      feature(3, text('Riposte', 'Ответный удар'), text(
        'Once per round, when a monster misses you, strike back.',
        'Раз в раунд, когда монстр промахивается, бьёт в ответ.',
      )),
      feature(9, text('Indomitable', 'Несгибаемость'), text(
        'Once per fight, a blow that would drop you leaves you at 1 health.',
        'Раз за бой удар, который свалил бы с ног, оставляет 1 здоровья.',
      )),
    ],
  },
  thief: {
    id: 'thief',
    class: 'rogue',
    name: text('Thief', 'Вор'),
    blurb: text('Quick hands and a nose for gold.', 'Быстрые руки и нюх на золото.'),
    features: [
      feature(3, text('Fast hands', 'Ловкие руки'), text(
        'Potions don’t cost the turn. +20% gold find.',
        'Зелья не отнимают ход. +20% к золоту.',
      )),
      feature(9, text('Ghost', 'Призрак'), text(
        '+5 to Sneak and Escape rolls, and you can Sneak past Mini-bosses.',
        '+5 к проверкам скрытности и броскам побега; можно прокрасться даже мимо мини-босса.',
      )),
    ],
  },
  assassin: {
    id: 'assassin',
    class: 'rogue',
    name: text('Assassin', 'Убийца'),
    blurb: text('Strikes where it hurts, again and again.', 'Бьёт туда, где больнее всего, раз за разом.'),
    features: [
      feature(3, text('Killer', 'Мастер убийства'), text(
        'Sneak attack hits with its full dice every round, not only on the first hit of the fight.',
        'Скрытая атака бьёт в полную силу каждый раунд, а не только первым попаданием в бою.',
      )),
      feature(9, text('Death strike', 'Смертельный удар'), text(
        'The first hit of every fight is a critical hit.',
        'Первое попадание в каждом бою — критическое.',
      )),
    ],
  },
  evoker: {
    id: 'evoker',
    class: 'wizard',
    name: text('Evoker', 'Воплотитель'),
    blurb: text('Fire and force, shaped to hit hard.', 'Огонь и сила, собранные в сокрушительный удар.'),
    features: [
      feature(3, text('Empowered evocation', 'Усиленное воплощение'), text(
        'Spells add your INT modifier to their damage twice.',
        'Заклинания добавляют модификатор ИНТ к урону дважды.',
      )),
      feature(9, text('Overchannel', 'Перенапряжение'), text(
        'One more burst per rest, and a burst hits even a lone enemy, twice as hard.',
        'На один взрыв больше до отдыха, и взрыв бьёт даже по одинокому врагу, вдвое сильнее.',
      )),
    ],
  },
  abjurer: {
    id: 'abjurer',
    class: 'wizard',
    name: text('Abjurer', 'Ограждающий'),
    blurb: text('A mage who doesn’t break.', 'Маг, которого не сломить.'),
    features: [
      feature(3, text('Arcane ward', 'Магический щит'), text(
        'Every fight starts behind a ward of 4 × level + INT modifier that takes damage first and mends by the INT modifier each turn.',
        'Каждый бой начинается за щитом в 4 × уровень + модификатор ИНТ: он принимает урон первым и каждый ход восстанавливается на модификатор ИНТ.',
      )),
      feature(9, text('Spell resistance', 'Сопротивление магии'), text(
        'Advantage on every saving throw.',
        'Преимущество на все спасброски.',
      )),
    ],
  },
  life: {
    id: 'life',
    class: 'cleric',
    name: text('Life', 'Жизнь'),
    blurb: text('Keeps going long after others fall.', 'Держится, когда другие уже пали.'),
    features: [
      feature(3, text('Disciple of life', 'Ученик жизни'), text(
        'Cure wounds and potions heal 50% more.',
        '«Лечение ран» и зелья лечат на 50% больше.',
      )),
      feature(9, text('Preserve life', 'Сохранение жизни'), text(
        'One more Cure wounds per rest, and the first one in each fight doesn’t cost the turn.',
        'Ещё одно «Лечение ран» до отдыха, и первое в каждом бою не отнимает ход.',
      )),
    ],
  },
  war: {
    id: 'war',
    class: 'cleric',
    name: text('War', 'Война'),
    blurb: text('A priest who leads the charge.', 'Жрец, что идёт в атаку первым.'),
    features: [
      feature(3, text('Divine strike', 'Божественный удар'), text('Your first hit each turn deals +1d8.', 'Первое попадание за ход наносит +1d8.')),
      feature(9, text('Extra attack', 'Дополнительная атака'), text('Attack twice each turn.', 'Две атаки за ход.')),
    ],
  },
};

export const pathsOf = (cls: ClassId): PathDef[] => PATHS.map((id) => PATH_DEFS[id]).filter((p) => p.class === cls);

/** Whether a Hero on `path` at `level` has that Path's feature from `from` on. */
export const onPath = (hero: { path: PathId | null; level: number }, path: PathId, from: PathFeature['level'] = PATH_LEVEL): boolean =>
  hero.path === path && hero.level >= from;
