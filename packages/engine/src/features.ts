import { abilityModifier } from './abilities.js';
import type { ClassId } from './content/classes.js';
import { PATH_DEFS, PATH_LEVEL, PATH_MASTERY, type PathId, onPath } from './content/paths.js';
import { type Text, text } from './content/text.js';
import {
  ARCHERY_BONUS, AURA_LEVEL, BEAST_TWIN_CLAWS, EVASION_LEVEL, FLURRY_STRIKES, MARK_DICE, MARTIAL_STRIKES, MAX_LEVEL, UNCANNY_DODGE_LEVEL, agathys,
  attacksPerTurn, burstDice, cureDice, inspirationDie, layOnHands, martialDie, rageDamage, restUses, smiteDice, sneakDice, spellDice, wildShapeHealth,
} from './levels.js';

// A Hero's class features as the belt on the Labyrinth screen shows them: what
// each does now, in numbers read from the rules the fights use, how many uses
// are left, and what it becomes later (docs/design.md → Classes).

export type FeatureIcon = 'flame' | 'shield' | 'bolt' | 'heart' | 'wind' | 'swords' | 'sword' | 'dodge' | 'escape' | 'skull' | 'path' | 'rage' | 'target' | 'arrow';

export interface Feature {
  id: string;
  icon: FeatureIcon;
  name: Text;
  /** rest: uses that come back after a rest; fight: once each fight; passive: always on; locked: comes at a later level. */
  kind: 'rest' | 'fight' | 'passive' | 'locked';
  uses: { left: number; of: number } | null;
  now: Text;
  next: Text | null;
}

export interface FeatureHero {
  class: ClassId;
  level: number;
  path: PathId | null;
  int: number;
  wis: number;
  cha: number;
  spellUses: number;
  healUses: number;
}

/** The first level above this one where a rule's number grows, and what it grows to. */
function nextGrowth(level: number, rule: (level: number) => number): { at: number; value: number } | null {
  const now = rule(level);
  for (let l = level + 1; l <= MAX_LEVEL; l++) if (rule(l) > now) return { at: l, value: rule(l) };
  return null;
}
const plus = (n: number) => (n >= 0 ? `+ ${n}` : `− ${-n}`);
const joinNext = (parts: (Text | null)[]): Text | null => {
  const kept = parts.filter((p): p is Text => p !== null);
  return kept.length === 0 ? null : text(kept.map((p) => p.en).join(' '), kept.map((p) => p.ru).join(' '));
};
const atLevel = (en: string, ru: string, at: number) => text(`${en} at level ${at}.`, `${ru} на ${at}-м уровне.`);

function attackSpell(hero: FeatureHero, ability: 'int' | 'wis' | 'cha'): Feature {
  const [n, sides] = spellDice(hero.class, hero.level)!;
  const mod = abilityModifier(hero[ability]);
  const grow = nextGrowth(hero.level, (l) => spellDice(hero.class, l)![0]);
  return {
    id: 'attack-spell', icon: 'bolt', name: text('Attack spell', 'Боевое заклинание'), kind: 'passive', uses: null,
    now: text(`Every turn, at will: ${n}d${sides} ${plus(mod)}.`, `Каждый ход, без ограничений: ${n}d${sides} ${plus(mod)}.`),
    next: grow ? atLevel(`${grow.value}d${sides}`, `${grow.value}d${sides}`, grow.at) : null,
  };
}

/** Fighters, Barbarians and Rangers: more attacks a turn as they grow. */
function extraAttack(hero: FeatureHero): Feature {
  const attacks = attacksPerTurn(hero.class, hero.level, hero.path);
  const more = nextGrowth(hero.level, (l) => attacksPerTurn(hero.class, l, hero.path));
  return {
    id: 'extra-attack', icon: 'swords', name: text('Extra attack', 'Дополнительная атака'), kind: attacks > 1 ? 'passive' : 'locked', uses: null,
    now: attacks > 1 ? text(`${attacks} attacks a turn.`, `${attacks} атаки за ход.`) : text('One attack a turn for now.', 'Пока одна атака за ход.'),
    next: more ? atLevel(`${more.value} attacks a turn`, `${more.value} атаки за ход`, more.at) : null,
  };
}

/** When a Rage or a Hunter's mark comes out, in the same words for both. */
const HARD_FIGHT = text('against two or more monsters, an elite, a Mini-boss or the Boss', 'против двух и более монстров, элиты, мини-босса или босса');
/** When the AI calls a Divine smite or a Flurry of blows: once in a hard fight, every turn against the biggest. */
const ONCE_HARD = text(
  'Once in a fight against two or more monsters or an elite, and every turn against a Mini-boss or the Boss',
  'Один раз в бою против двух и более монстров или элиты и каждый ход против мини-босса или босса',
);
const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** Cure wounds, as a Cleric's, a Druid's (WIS) or a Bard's (CHA). */
function cureWounds(hero: FeatureHero, ability: 'wis' | 'cha'): Feature {
  const uses = restUses(hero.class, hero.level, hero.path);
  const dice = cureDice(hero.level);
  const moreDice = nextGrowth(hero.level, cureDice);
  const moreCures = nextGrowth(hero.level, (l) => restUses(hero.class, l, hero.path).heals);
  return {
    id: 'cure-wounds', icon: 'heart', name: text('Cure wounds', '«Лечение ран»'), kind: 'rest', uses: { left: hero.healUses, of: uses.heals },
    now: text(`Below 45% health in a fight: heals ${dice}d8 ${plus(abilityModifier(hero[ability]))}, you or your partner.`,
      `В бою, когда здоровья меньше 45%: лечит ${dice}d8 ${plus(abilityModifier(hero[ability]))} — вас или напарника.`),
    next: joinNext([
      moreDice ? atLevel(`${moreDice.value}d8`, `${moreDice.value}d8`, moreDice.at) : null,
      moreCures ? atLevel(`${moreCures.value} a rest`, `${moreCures.value} за отдых`, moreCures.at) : null,
    ]),
  };
}

function pathFeature(hero: FeatureHero): Feature {
  if (!hero.path) {
    return {
      id: 'path', icon: 'path', name: text('Path', 'Путь'), kind: 'locked', uses: null,
      now: hero.level < PATH_LEVEL
        ? text('One of two Paths for your Class comes at level 3.', 'На 3-м уровне — один из двух путей вашего класса.')
        : text('Choose your Path on the Heroes tab.', 'Выберите путь на вкладке «Герои».'),
      next: null,
    };
  }
  const def = PATH_DEFS[hero.path];
  const open = def.features.filter((f) => hero.level >= f.level);
  const later = def.features.find((f) => hero.level < f.level);
  return {
    id: 'path', icon: 'path', name: def.name, kind: 'passive', uses: null,
    now: text(open.map((f) => `${f.name.en}: ${f.text.en}`).join(' '), open.map((f) => `${f.name.ru}: ${f.text.ru}`).join(' ')),
    next: later ? text(`At level ${later.level}, ${later.name.en}: ${later.text.en}`, `На ${later.level}-м уровне — ${later.name.ru}: ${later.text.ru}`) : null,
  };
}

/** The belt's class features for a Hero, in the order they show, its Path last. */
export function heroFeatures(hero: FeatureHero): Feature[] {
  const { level, path } = hero;
  const uses = restUses(hero.class, level, path);
  const out: Feature[] = [];

  if (hero.class === 'fighter') {
    out.push({
      id: 'second-wind', icon: 'wind', name: text('Second wind', 'Второе дыхание'), kind: 'fight', uses: null,
      now: text(`Once a fight, below 45% health: heals 1d10 + ${level}.`, `Раз за бой, когда здоровья меньше 45%: лечит 1d10 + ${level}.`),
      next: text('Heals 1 more with every level.', 'С каждым уровнем лечит на 1 больше.'),
    }, extraAttack(hero));
  }

  if (hero.class === 'barbarian') {
    const bonus = rageDamage(level);
    const moreDamage = nextGrowth(level, rageDamage);
    const moreUses = nextGrowth(level, (l) => restUses('barbarian', l, path).spells);
    out.push({
      id: 'rage', icon: 'rage', name: text('Rage', 'Ярость'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `Flares up ${HARD_FIGHT.en}, or below half health: +${bonus} damage on every hit you land, and ${bonus} less from every blow that lands on you, for the rest of the fight.`,
        `Вспыхивает ${HARD_FIGHT.ru} или когда здоровья меньше половины: +${bonus} к урону каждого вашего удара и на ${bonus} меньше от каждого удара по вам — до конца боя.`,
      ),
      next: joinNext([
        moreDamage ? atLevel(`+${moreDamage.value} damage`, `+${moreDamage.value} к урону`, moreDamage.at) : null,
        moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
      ]),
    }, {
      id: 'danger-sense', icon: 'dodge', name: text('Danger sense', 'Чутьё на опасность'), kind: 'passive', uses: null,
      now: text('Advantage on DEX saving throws, against breath and blasts.', 'Преимущество на спасброски ЛОВ — от дыхания и взрывов.'),
      next: null,
    }, extraAttack(hero));
  }

  if (hero.class === 'ranger') {
    const moreUses = nextGrowth(level, (l) => restUses('ranger', l, path).spells);
    const [n, sides] = MARK_DICE;
    out.push({
      id: 'hunters-mark', icon: 'target', name: text('Hunter’s mark', 'Метка охотника'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `${HARD_FIGHT.en[0]!.toUpperCase()}${HARD_FIGHT.en.slice(1)}: marks the toughest and shoots it first, and every hit on it deals +${n}d${sides}. When it falls, the mark moves on.`,
        `${HARD_FIGHT.ru[0]!.toUpperCase()}${HARD_FIGHT.ru.slice(1)}: метит самого крепкого и бьёт его первым делом, и каждое попадание по нему наносит +${n}d${sides}. Когда он падёт, метка переходит дальше.`,
      ),
      next: moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
    }, {
      id: 'archery', icon: 'arrow', name: text('Archery', 'Стрельба из лука'), kind: 'passive', uses: null,
      now: text(`+${ARCHERY_BONUS} to hit with a bow.`, `+${ARCHERY_BONUS} к попаданию из лука.`),
      next: null,
    }, extraAttack(hero));
  }

  if (hero.class === 'rogue') {
    const dice = sneakDice(level);
    const more = nextGrowth(level, sneakDice);
    const dodges = level >= UNCANNY_DODGE_LEVEL;
    out.push({
      id: 'sneak-attack', icon: 'sword', name: text('Sneak attack', 'Скрытая атака'), kind: 'passive', uses: null,
      now: text(`The fight’s first hit adds ${dice}d6; every later round, a smaller one.`, `Первое попадание в бою добавляет ${dice}d6, а дальше каждый раунд — поменьше.`),
      next: more ? atLevel(`${more.value}d6`, `${more.value}d6`, more.at) : null,
    }, {
      id: 'uncanny-dodge', icon: 'dodge', name: text('Uncanny dodge', 'Невероятное уклонение'), kind: dodges ? 'passive' : 'locked', uses: null,
      now: text('The first hit on you in each fight deals half damage.', 'Первый удар по вам в каждом бою наносит половину урона.'),
      next: dodges ? null : text(`Comes at level ${UNCANNY_DODGE_LEVEL}.`, `Приходит на ${UNCANNY_DODGE_LEVEL}-м уровне.`),
    }, {
      id: 'slip-away', icon: 'escape', name: text('Slip away', 'Ускользнуть'), kind: 'passive', uses: null,
      now: text('Advantage, and your proficiency, on Sneak and Escape rolls.', 'Преимущество и бонус мастерства, чтобы прокрасться или сбежать.'),
      next: null,
    });
  }

  if (hero.class === 'wizard') {
    const dice = burstDice(level);
    const evoker = onPath({ path, level }, 'evoker');
    const mastery = onPath({ path, level }, 'evoker', PATH_MASTERY);
    const bonus = evoker ? ` + ${2 * abilityModifier(hero.int)}` : '';
    const moreDice = nextGrowth(level, burstDice);
    const moreUses = nextGrowth(level, (l) => restUses('wizard', l, path).spells);
    out.push({
      id: 'burst', icon: 'flame', name: text('Burst of fire', 'Огненный взрыв'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: mastery
        ? text(`Opens a fight: ${dice}d6${bonus} on every monster, twice as hard on a lone one.`, `Открывает бой: ${dice}d6${bonus} по каждому монстру, а одинокому — вдвое сильнее.`)
        : text(`Opens a fight against two or more monsters: ${dice}d6${bonus} on each.`, `Открывает бой против двух и более монстров: ${dice}d6${bonus} по каждому.`),
      next: joinNext([
        moreDice ? atLevel(`${moreDice.value}d6`, `${moreDice.value}d6`, moreDice.at) : null,
        moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
      ]),
    }, {
      id: 'shield', icon: 'shield', name: text('Shield', 'Щит'), kind: 'passive', uses: null,
      now: text('In every fight, the first blow that would hit you is turned aside.', 'В каждом бою первый удар, который попал бы по вам, отводится в сторону.'),
      next: null,
    }, attackSpell(hero, 'int'));
  }

  if (hero.class === 'cleric') {
    const dice = cureDice(level);
    const life = onPath({ path, level }, 'life');
    const moreDice = nextGrowth(level, cureDice);
    const moreUses = nextGrowth(level, (l) => restUses('cleric', l, path).heals);
    const wis = plus(abilityModifier(hero.wis));
    out.push({
      id: 'cure-wounds', icon: 'heart', name: text('Cure wounds', '«Лечение ран»'), kind: 'rest', uses: { left: hero.healUses, of: uses.heals },
      now: text(`Below 45% health in a fight: heals ${dice}d8 ${wis}${life ? ', and half again as much' : ''}.`, `В бою, когда здоровья меньше 45%: лечит ${dice}d8 ${wis}${life ? ', и ещё вполовину больше' : ''}.`),
      next: joinNext([
        moreDice ? atLevel(`${moreDice.value}d8`, `${moreDice.value}d8`, moreDice.at) : null,
        moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
      ]),
    }, attackSpell(hero, 'wis'), {
      id: 'bane', icon: 'skull', name: text('Bane of the dead', 'Гроза мёртвых'), kind: 'passive', uses: null,
      now: text('Your attack spell deals double damage to the undead.', 'Ваше боевое заклинание наносит нежити двойной урон.'),
      next: null,
    });
  }

  if (hero.class === 'paladin') {
    const dice = smiteDice(level, path);
    const moreDice = nextGrowth(level, (l) => smiteDice(l, path));
    const moreUses = nextGrowth(level, (l) => restUses('paladin', l, path).spells);
    const moreHands = nextGrowth(level, (l) => restUses('paladin', l, path).heals);
    const auraOn = level >= AURA_LEVEL;
    out.push({
      id: 'divine-smite', icon: 'bolt', name: text('Divine smite', 'Божественная кара'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `${ONCE_HARD.en}: the turn's first hit adds ${dice}d8 holy fire, a d8 more on the undead and demons.`,
        `${ONCE_HARD.ru}: первое попадание за ход добавляет ${dice}d8 святого огня, по нежити и демонам — на d8 больше.`,
      ),
      next: joinNext([
        moreDice ? atLevel(`${moreDice.value}d8`, `${moreDice.value}d8`, moreDice.at) : null,
        moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
      ]),
    }, {
      id: 'lay-on-hands', icon: 'heart', name: text('Lay on hands', 'Наложение рук'), kind: 'rest', uses: { left: hero.healUses, of: uses.heals },
      now: text(`Below 45% health in a fight: heals ${layOnHands(level)}, you or your partner.`, `В бою, когда здоровья меньше 45%: лечит ${layOnHands(level)} — вас или напарника.`),
      next: joinNext([
        text(`Heals ${layOnHands(level + 1) - layOnHands(level)} more with every level.`, `С каждым уровнем лечит на ${layOnHands(level + 1) - layOnHands(level)} больше.`),
        moreHands ? atLevel(`${moreHands.value} a rest`, `${moreHands.value} за отдых`, moreHands.at) : null,
      ]),
    }, {
      id: 'aura', icon: 'shield', name: text('Aura of protection', 'Аура защиты'), kind: auraOn ? 'passive' : 'locked', uses: null,
      now: text(`Your CHA modifier (at least +1) on every save: ${plus(Math.max(1, abilityModifier(hero.cha)))}.`, `Модификатор ХАР (не меньше +1) к каждому спасброску: ${plus(Math.max(1, abilityModifier(hero.cha)))}.`),
      next: auraOn ? null : text(`Comes at level ${AURA_LEVEL}.`, `Приходит на ${AURA_LEVEL}-м уровне.`),
    }, extraAttack(hero));
  }

  if (hero.class === 'warlock') {
    const beams = attacksPerTurn('warlock', level, path);
    const moreBeams = nextGrowth(level, (l) => attacksPerTurn('warlock', l, path));
    const moreUses = nextGrowth(level, (l) => restUses('warlock', l, path).spells);
    const [n, sides] = MARK_DICE;
    const frost = agathys(level, hero.cha);
    out.push({
      id: 'eldritch-blast', icon: 'bolt', name: text('Eldritch blast', 'Мистический заряд'), kind: 'passive', uses: null,
      now: text(`Every turn, at will: ${beams} beam${beams > 1 ? 's' : ''} of 1d10 ${plus(abilityModifier(hero.cha))} each.`, `Каждый ход, без ограничений: лучей — ${beams}, каждый 1d10 ${plus(abilityModifier(hero.cha))}.`),
      next: moreBeams ? atLevel(`${moreBeams.value} beams`, `лучей: ${moreBeams.value}`, moreBeams.at) : null,
    }, {
      id: 'hex', icon: 'target', name: text('Hex', 'Порча'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `${cap(HARD_FIGHT.en)}: curses the toughest and blasts it first, and every hit on it deals +${n}d${sides}. When it falls, the Hex moves on.`,
        `${cap(HARD_FIGHT.ru)}: проклинает самого крепкого и бьёт его первым делом, и каждое попадание по нему наносит +${n}d${sides}. Когда он падёт, порча переходит дальше.`,
      ),
      next: moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
    }, {
      id: 'armor-of-agathys', icon: 'shield', name: text('Armor of Agathys', 'Доспех Агатиса'), kind: 'passive', uses: null,
      now: text(
        `${cap(HARD_FIGHT.en)}: frost wraps you as the fight begins, a ward of ${frost} that takes the blows first.`,
        `${cap(HARD_FIGHT.ru)}: в начале боя вас окутывает иней — щит в ${frost}, который первым принимает удары.`,
      ),
      next: text('One more with every level.', 'С каждым уровнем на 1 больше.'),
    });
  }

  if (hero.class === 'monk') {
    const die = martialDie(level);
    const moreDie = nextGrowth(level, martialDie);
    const moreKi = nextGrowth(level, (l) => restUses('monk', l, path).spells);
    const evades = level >= EVASION_LEVEL;
    out.push({
      id: 'martial-arts', icon: 'sword', name: text('Martial arts', 'Боевые искусства'), kind: 'passive', uses: null,
      now: text(
        `Every attack brings ${MARTIAL_STRIKES} more strike; your strikes roll 1d${die} (or your weapon's dice, if bigger), with DEX.`,
        `Каждая атака приносит ещё ${MARTIAL_STRIKES} удар; ваши удары бросают 1d${die} (или кости оружия, если они больше), с ЛОВ.`,
      ),
      next: moreDie ? atLevel(`1d${moreDie.value}`, `1d${moreDie.value}`, moreDie.at) : null,
    }, {
      id: 'flurry', icon: 'swords', name: text('Flurry of blows', 'Шквал ударов'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(`${ONCE_HARD.en}: ${FLURRY_STRIKES} more strike that turn, for a ki.`, `${ONCE_HARD.ru}: ещё ${FLURRY_STRIKES} удар за этот ход, за одно ци.`),
      next: moreKi ? atLevel(`${moreKi.value} ki a rest`, `${moreKi.value} ци за отдых`, moreKi.at) : null,
    }, {
      id: 'unarmored', icon: 'dodge', name: text('Unarmored defense', 'Защита без доспехов'), kind: 'passive', uses: null,
      now: text('Armor Class 10 + DEX + WIS, with no armor and no shield.', 'Класс доспеха 10 + ЛОВ + МДР, без доспехов и щита.'),
      next: null,
    }, {
      id: 'evasion', icon: 'escape', name: text('Evasion', 'Увёртливость'), kind: evades ? 'passive' : 'locked', uses: null,
      now: text('A DEX save against breath or a blast takes no damage on a success, and half on a failure.', 'Спасбросок ЛОВ от дыхания или взрыва: при успехе урона нет, при провале — половина.'),
      next: evades ? null : text(`Comes at level ${EVASION_LEVEL}.`, `Приходит на ${EVASION_LEVEL}-м уровне.`),
    }, extraAttack(hero));
  }

  if (hero.class === 'druid') {
    const pool = wildShapeHealth(level, path);
    const twice = level >= BEAST_TWIN_CLAWS;
    const moreShapes = nextGrowth(level, (l) => restUses('druid', l, path).spells);
    const grows = wildShapeHealth(level + 1, path) - pool;
    out.push({
      id: 'wild-shape', icon: 'rage', name: text('Wild shape', 'Дикий облик'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `Once a fight, ${HARD_FIGHT.en} or below half health: becomes a beast with ${pool} health that takes the blows first, and claws for 1d8 ${plus(abilityModifier(hero.wis))}${twice ? ' twice a turn' : ''}.`,
        `Раз за бой, ${HARD_FIGHT.ru} или когда здоровья меньше половины: становится зверем с ${pool} здоровья, которое первым принимает удары, и бьёт когтями на 1d8 ${plus(abilityModifier(hero.wis))}${twice ? ' дважды за ход' : ''}.`,
      ),
      next: joinNext([
        text(`${grows} more health for the beast with every level.`, `С каждым уровнем у зверя на ${grows} здоровья больше.`),
        twice ? null : atLevel('Two claws a turn', 'Два удара когтями за ход', BEAST_TWIN_CLAWS),
        moreShapes ? atLevel(`${moreShapes.value} a rest`, `${moreShapes.value} за отдых`, moreShapes.at) : null,
      ]),
    }, cureWounds(hero, 'wis'), attackSpell(hero, 'wis'));
  }

  if (hero.class === 'bard') {
    const die = inspirationDie(level, path);
    const moreDie = nextGrowth(level, (l) => inspirationDie(l, path));
    const moreUses = nextGrowth(level, (l) => restUses('bard', l, path).spells);
    out.push({
      id: 'inspiration', icon: 'wind', name: text('Bardic inspiration', 'Вдохновение барда'), kind: 'rest', uses: { left: hero.spellUses, of: uses.spells },
      now: text(
        `A missed attack spell gets a d${die} more, and a monster's blow that would hit you a d${die} less (Cutting words). One is spent only when it turns the roll.`,
        `Промахнувшееся боевое заклинание получает ещё d${die}, а удар монстра, который попал бы по вам, — на d${die} меньше (колкие слова). Вдохновение тратится, только если меняет исход.`,
      ),
      next: joinNext([
        moreDie ? atLevel(`d${moreDie.value}`, `d${moreDie.value}`, moreDie.at) : null,
        moreUses ? atLevel(`${moreUses.value} a rest`, `${moreUses.value} за отдых`, moreUses.at) : null,
      ]),
    }, {
      id: 'mockery', icon: 'skull', name: text('Vicious mockery', 'Злая насмешка'), kind: 'passive', uses: null,
      now: text('A monster your attack spell hits attacks at a disadvantage on its next turn.', 'Монстр, в которого попало ваше заклинание, атакует с помехой в свой следующий ход.'),
      next: null,
    }, cureWounds(hero, 'cha'), attackSpell(hero, 'cha'));
  }

  if (hero.class === 'sorcerer') {
    const dice = burstDice(level);
    const moreDice = nextGrowth(level, burstDice);
    const moreUses = nextGrowth(level, (l) => restUses('sorcerer', l, path).spells);
    const points = { left: hero.spellUses, of: uses.spells };
    out.push({
      id: 'burst', icon: 'flame', name: text('Burst of fire', 'Огненный взрыв'), kind: 'rest', uses: points,
      now: text(`Opens a fight against two or more monsters: ${dice}d6 on each, for a sorcery point.`, `Открывает бой против двух и более монстров: ${dice}d6 по каждому, за очко чародейства.`),
      next: joinNext([
        moreDice ? atLevel(`${moreDice.value}d6`, `${moreDice.value}d6`, moreDice.at) : null,
        moreUses ? atLevel(`${moreUses.value} sorcery points a rest`, `${moreUses.value} очков чародейства за отдых`, moreUses.at) : null,
      ]),
    }, {
      id: 'quickened', icon: 'bolt', name: text('Quickened spell', 'Ускоренное заклинание'), kind: 'rest', uses: points,
      now: text(
        'When one monster is left in a hard fight: a second attack spell that turn, for a sorcery point.',
        'Когда в тяжёлом бою остаётся один монстр: второе боевое заклинание за ход, за очко чародейства.',
      ),
      next: null,
    }, attackSpell(hero, 'cha'));
  }

  out.push(pathFeature(hero));
  return out;
}
