import { abilityModifier } from './abilities.js';
import type { ClassId } from './content/classes.js';
import { PATH_DEFS, PATH_LEVEL, PATH_MASTERY, type PathId, onPath } from './content/paths.js';
import { type Text, text } from './content/text.js';
import {
  ARCHERY_BONUS, MARK_DICE, MAX_LEVEL, UNCANNY_DODGE_LEVEL, attacksPerTurn, burstDice, cureDice, rageDamage, restUses, sneakDice, spellDice,
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

function attackSpell(hero: FeatureHero, ability: 'int' | 'wis'): Feature {
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

  out.push(pathFeature(hero));
  return out;
}
