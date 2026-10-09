import type { ClassId } from './classes.js';
import { type Text, text } from './text.js';

/**
 * Paths: at level 3 a Hero chooses one of two for its Class, and it grows into
 * it at level 9 (docs/design.md → Growing: Paths and Talents, v0). Retiring is
 * the only way to try the other one in the same Season.
 */
export const PATHS = [
  'champion', 'guardian', 'thief', 'assassin', 'evoker', 'abjurer', 'life', 'war', 'berserker', 'bearheart', 'hunter', 'stalker',
  'devotion', 'vengeance', 'fiend', 'old-one', 'open-hand', 'shadows', 'moon', 'land', 'lore', 'valor', 'draconic', 'wild',
] as const;
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
        '+5 to Sneak and Escape rolls, and you can Sneak past Mini-bosses. From a fight’s fourth round you have studied your prey: each round’s Sneak attack rolls a third of your level in d6.',
        '+5 к проверкам скрытности и броскам побега; можно прокрасться даже мимо мини-босса. С четвёртого раунда боя вы изучили добычу: скрытая атака каждый раунд бросает столько d6, сколько треть уровня.',
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
        'One more burst per rest, and a burst hits even a lone enemy, twice as hard. Against the Boss, your attack spells and bursts deal 50% more.',
        'На один взрыв больше до отдыха, и взрыв бьёт даже по одинокому врагу, вдвое сильнее. Против босса ваши боевые заклинания и взрывы наносят на 50% больше урона.',
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
  berserker: {
    id: 'berserker',
    class: 'barbarian',
    name: text('Berserker', 'Берсерк'),
    blurb: text('Rage with nothing held back.', 'Ярость, в которой нет удержу.'),
    features: [
      feature(3, text('Frenzy', 'Бешенство'), text(
        'While raging and below half health, attack once more each turn.',
        'В ярости, когда здоровья меньше половины, — на одну атаку за ход больше.',
      )),
      feature(9, text('Mindless rage', 'Слепая ярость'), text(
        'While raging, fear and paralysis can’t take hold of you.',
        'В ярости вас не берут ни страх, ни паралич.',
      )),
    ],
  },
  bearheart: {
    id: 'bearheart',
    class: 'barbarian',
    name: text('Bear-heart', 'Медвежье сердце'),
    blurb: text('Too stubborn to fall.', 'Упрямство, которое не даёт упасть.'),
    features: [
      feature(3, text('Thick hide', 'Толстая шкура'), text(
        'While raging, blows lose twice the Rage’s edge, and every other harm loses it too: breath, blasts, wails, fire and poison.',
        'В ярости удары по вам слабеют вдвое сильнее, а любой другой урон тоже слабеет: дыхание, взрывы, вопли, огонь и яд.',
      )),
      feature(9, text('Relentless', 'Неудержимость'), text(
        'While raging, a blow that would drop you calls for a CON save (DC 10, then 5 higher each time): on a success you stay up with 1 health.',
        'В ярости удар, который свалил бы с ног, требует спасброска ТЕЛ (СЛ 10, затем каждый раз на 5 выше): при успехе остаётся 1 здоровья.',
      )),
    ],
  },
  hunter: {
    id: 'hunter',
    class: 'ranger',
    name: text('Hunter', 'Охотник'),
    blurb: text('Brings down the big ones, and the many.', 'Валит крупную дичь и целые стаи.'),
    features: [
      feature(3, text('Colossus slayer', 'Убийца великанов'), text(
        'Once a turn, a hit on a monster that is already hurt deals +1d8.',
        'Раз за ход попадание по уже раненому монстру наносит +1d8.',
      )),
      feature(9, text('Volley', 'Залп'), text('One more attack each turn.', 'На одну атаку за ход больше.')),
    ],
  },
  stalker: {
    id: 'stalker',
    class: 'ranger',
    name: text('Stalker', 'Ловчий'),
    blurb: text('Strikes first, and is never where the blow lands.', 'Бьёт раньше всех и уходит из-под удара.'),
    features: [
      feature(3, text('Ambush', 'Засада'), text(
        'In each fight’s first round, attack once more, with advantage.',
        'В первом раунде каждого боя — на одну атаку больше, и с преимуществом.',
      )),
      feature(9, text('Evasion', 'Увёртливость'), text(
        'A DEX save against breath or a blast takes no damage on a success, and half on a failure.',
        'Спасбросок ЛОВ от дыхания или взрыва: при успехе урона нет, при провале — половина.',
      )),
    ],
  },
  'devotion': {
    id: 'devotion',
    class: 'paladin',
    name: text('Devotion', 'Преданность'),
    blurb: text('A shining knight: steady hand, steady heart.', 'Сияющий рыцарь: твёрдая рука и твёрдое сердце.'),
    features: [
      feature(3, text('Sacred weapon', 'Священное оружие'), text(
        '+2 to hit with weapons.',
        '+2 к попаданию оружием.',
      )),
      feature(9, text('Aura of devotion', 'Аура преданности'), text(
        'Neither fear nor a mesmerizing gaze can take hold of you.',
        'Ни страх, ни завораживающий взгляд не властны над вами.',
      )),
    ],
  },
  'vengeance': {
    id: 'vengeance',
    class: 'paladin',
    name: text('Vengeance', 'Месть'),
    blurb: text('Hunts down the worst of them.', 'Выслеживает самых страшных.'),
    features: [
      feature(3, text('Vow of enmity', 'Клятва вражды'), text(
        'In a hard fight, advantage on attacks against the toughest monster.',
        'В тяжёлом бою — преимущество на атаки по самому опасному монстру.',
      )),
      feature(9, text('Avenging smite', 'Карающая кара'), text(
        'Divine smite deals one more d8.',
        'Божественная кара наносит на d8 больше.',
      )),
    ],
  },
  'fiend': {
    id: 'fiend',
    class: 'warlock',
    name: text('Fiend', 'Исчадие'),
    blurb: text('A pact with a power of the pit.', 'Договор с силой преисподней.'),
    features: [
      feature(3, text('Dark one’s blessing', 'Благословение тёмного'), text(
        'Every monster your spells fell restores your CHA modifier + your level in health.',
        'Каждый монстр, павший от ваших заклинаний, восстанавливает модификатор ХАР + ваш уровень здоровья.',
      )),
      feature(9, text('Hellfire', 'Адское пламя'), text(
        'Your blasts set what they hit burning: 1d6 for 2 turns.',
        'Ваши заряды поджигают цель: 1d6 два хода.',
      )),
    ],
  },
  'old-one': {
    id: 'old-one',
    class: 'warlock',
    name: text('Great Old One', 'Великий Древний'),
    blurb: text('A mind touched by something vast.', 'Разум, которого коснулось нечто необъятное.'),
    features: [
      feature(3, text('Awakened mind', 'Пробуждённый разум'), text(
        '+5 to initiative, and WIS saves with advantage.',
        '+5 к инициативе и спасброски МДР с преимуществом.',
      )),
      feature(9, text('Entropic ward', 'Энтропийная защита'), text(
        'The first blow of every fight that would hit you misses.',
        'Первый удар в каждом бою, который попал бы, промахивается.',
      )),
    ],
  },
  'open-hand': {
    id: 'open-hand',
    class: 'monk',
    name: text('Open Hand', 'Открытая ладонь'),
    blurb: text('Every strike a lesson.', 'Каждый удар — урок.'),
    features: [
      feature(3, text('Open hand technique', 'Техника открытой ладони'), text(
        'A monster struck by your Flurry of blows attacks at a disadvantage on its next turn.',
        'Монстр под шквалом ваших ударов атакует с помехой в свой следующий ход.',
      )),
      feature(9, text('Wholeness of body', 'Целостность тела'), text(
        'Once a fight, below half health, regain three times your level in health.',
        'Раз за бой, когда здоровья меньше половины, восстанавливает трижды ваш уровень здоровья.',
      )),
    ],
  },
  'shadows': {
    id: 'shadows',
    class: 'monk',
    name: text('Shadow', 'Тень'),
    blurb: text('Strikes from where no light falls.', 'Бьёт оттуда, куда не падает свет.'),
    features: [
      feature(3, text('Shadow arts', 'Искусство теней'), text(
        'In each fight’s first round, attacks with advantage; Sneak checks with advantage.',
        'В первом раунде каждого боя атакует с преимуществом; проверки скрытности с преимуществом.',
      )),
      feature(9, text('Cloak of shadows', 'Плащ теней'), text(
        'The first blow of every fight that would hit you misses.',
        'Первый удар в каждом бою, который попал бы, промахивается.',
      )),
    ],
  },
  'moon': {
    id: 'moon',
    class: 'druid',
    name: text('Moon', 'Луна'),
    blurb: text('More beast than sage.', 'Скорее зверь, чем мудрец.'),
    features: [
      feature(3, text('Moon form', 'Лунный облик'), text(
        'Your beast form has half again as much health.',
        'У вашего звериного облика в полтора раза больше здоровья.',
      )),
      feature(9, text('Primal strike', 'Первобытный удар'), text(
        'Beast claws deal +1d8.',
        'Когти зверя наносят +1d8.',
      )),
    ],
  },
  'land': {
    id: 'land',
    class: 'druid',
    name: text('Land', 'Земля'),
    blurb: text('Draws on the old roots of the world.', 'Черпает силу из древних корней мира.'),
    features: [
      feature(3, text('Natural recovery', 'Природное восстановление'), text(
        'One more Cure wounds a rest.',
        'На одно «Лечение ран» за отдых больше.',
      )),
      feature(9, text('Nature’s ward', 'Защита природы'), text(
        'Poison can’t take hold of you.',
        'Яд над вами не властен.',
      )),
    ],
  },
  'lore': {
    id: 'lore',
    class: 'bard',
    name: text('Lore', 'Знание'),
    blurb: text('Knows the right word for every wound.', 'Знает нужное слово для каждой раны.'),
    features: [
      feature(3, text('Peerless skill', 'Непревзойдённое мастерство'), text(
        'Your Inspiration die is one size bigger (a d8 to start with).',
        'Ваша кость вдохновения на размер больше (для начала d8).',
      )),
      feature(9, text('Countercharm', 'Контрочары'), text(
        'Neither fear nor a mesmerizing gaze can take hold of you.',
        'Ни страх, ни завораживающий взгляд не властны над вами.',
      )),
    ],
  },
  'valor': {
    id: 'valor',
    class: 'bard',
    name: text('Valor', 'Доблесть'),
    blurb: text('Sings the battle, then joins it.', 'Воспевает битву, а потом вступает в неё.'),
    features: [
      feature(3, text('Combat inspiration', 'Боевое вдохновение'), text(
        'An Inspiration that turns a miss into a hit adds its die to the damage too.',
        'Вдохновение, превратившее промах в попадание, добавляет свою кость и к урону.',
      )),
      feature(9, text('Battle magic', 'Боевая магия'), text(
        'Every attack spell that hits adds your Inspiration die to its damage, spending nothing.',
        'Каждое попавшее боевое заклинание добавляет к урону вашу кость вдохновения, ничего не тратя.',
      )),
    ],
  },
  'draconic': {
    id: 'draconic',
    class: 'sorcerer',
    name: text('Draconic', 'Драконья кровь'),
    blurb: text('A dragon somewhere in the family tree.', 'Где-то в родословной был дракон.'),
    features: [
      feature(3, text('Draconic resilience', 'Драконья стойкость'), text(
        '+2 Armor Class, and fire (breath, burning) deals half.',
        '+2 к классу доспеха, а огонь (дыхание, горение) наносит половину.',
      )),
      feature(9, text('Elemental affinity', 'Стихийное родство'), text(
        'Your spells and Bursts of fire deal your CHA modifier more.',
        'Ваши заклинания и огненные взрывы наносят на модификатор ХАР больше.',
      )),
    ],
  },
  'wild': {
    id: 'wild',
    class: 'sorcerer',
    name: text('Wild Magic', 'Дикая магия'),
    blurb: text('Power that does not always ask.', 'Сила, которая не всегда спрашивает.'),
    features: [
      feature(3, text('Tides of chaos', 'Волны хаоса'), text(
        'Once a fight, a missed attack spell is cast again.',
        'Раз за бой промахнувшееся боевое заклинание творится снова.',
      )),
      feature(9, text('Wild surge', 'Дикий всплеск'), text(
        'Bursts of fire deal half again as much, and even a lone monster takes one (for double). Against the Boss, your attack spells and Bursts deal 75% more.',
        'Огненные взрывы наносят в полтора раза больше урона и достаются даже одинокому монстру (вдвойне). Против босса ваши боевые заклинания и взрывы наносят на 75% больше урона.',
      )),
    ],
  },
};

export const pathsOf = (cls: ClassId): PathDef[] => PATHS.map((id) => PATH_DEFS[id]).filter((p) => p.class === cls);

/** Whether a Hero on `path` at `level` has that Path's feature from `from` on. */
export const onPath = (hero: { path: PathId | null; level: number }, path: PathId, from: PathFeature['level'] = PATH_LEVEL): boolean =>
  hero.path === path && hero.level >= from;
