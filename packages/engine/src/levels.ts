import { abilityModifier } from './abilities.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { PATH_DEFS, PATH_LEVEL, PATH_MASTERY, type PathId, onPath } from './content/paths.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import type { TalentId } from './content/talents.js';
import { type Text, text } from './content/text.js';
import { rollDie } from './dice.js';
import { GROWTH_LEVELS } from './heroes.js';
import type { Rng } from './rng.js';

// Levels and everything that grows with them. Fights read these rules from here,
// and the level-up screen describes them from here, so the two always agree
// (docs/design.md → Levels).

/** XP needed to reach each level (index = level). An active Player nears 10 by the Boss gate (v0). */
export const XP_FOR_LEVEL = [0, 0, 100, 300, 700, 1300, 2100, 3100, 4400, 6000, 8000, 10500, 13500, 17000, 21000, 25500, 30500, 36000, 42000, 48500, 55500];
export const MAX_LEVEL = 20;

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_FOR_LEVEL[level + 1]!) level++;
  return level;
}

export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);

/** Uses that come back on a long rest (a Camp, or the City). */
export interface RestUses {
  /**
   * The Class's power a rest brings back: a Wizard's or Sorcerer's Bursts of fire, a Barbarian's Rages,
   * a Ranger's Hunter's marks, a Paladin's Divine smites, a Warlock's Hexes, a Monk's ki (Flurries of blows),
   * a Druid's Wild shapes, a Bard's Bardic inspirations, a Sorcerer's sorcery points (Bursts of fire and Quickened spells).
   */
  spells: number;
  /** A Cleric's, Druid's or Bard's Cure wounds, a Paladin's Lay on hands. */
  heals: number;
}

export function restUses(cls: ClassId, level: number, path: PathId | null = null): RestUses {
  const hero = { path, level };
  const spells: Record<ClassId, number> = {
    fighter: 0,
    rogue: 0,
    wizard: 1 + Math.floor(level / 4) + (onPath(hero, 'evoker', PATH_MASTERY) ? 1 : 0),
    cleric: 0,
    barbarian: rages(level),
    ranger: marks(level),
    paladin: smites(level),
    warlock: marks(level),
    monk: ki(level),
    druid: wildShapes(level),
    bard: inspirations(level),
    sorcerer: 2 + Math.floor(level / 3),
  };
  const heals: Partial<Record<ClassId, number>> = {
    cleric: 1 + Math.floor(level / 3) + (onPath(hero, 'life', PATH_MASTERY) ? 1 : 0),
    druid: 1 + Math.floor(level / 3) + (onPath(hero, 'land') ? 1 : 0),
    paladin: 1 + Math.floor(level / 5),
    bard: 1 + Math.floor(level / 4),
  };
  return { spells: spells[cls], heals: heals[cls] ?? 0 };
}

/** A Fighter's Action Surges a fight (v0): one from level 2, two from 17, as in the SRD (there a short rest brings them back). */
export const actionSurges = (level: number): number => (level >= 17 ? 2 : level >= 2 ? 1 : 0);

/** A Paladin's Divine smites a rest (v0): 2, and one more at 6, 12 and 18. */
export const smites = (level: number): number => 2 + Math.floor(level / 6);
/** Divine smite: this many d8 of holy fire on the hit (2, 3 from 9, 4 from 17), one more against undead and demons (v0); a master of Vengeance adds one. */
export const smiteDice = (level: number, path: PathId | null): number =>
  (level >= 17 ? 4 : level >= 9 ? 3 : 2) + (onPath({ path, level }, 'vengeance', PATH_MASTERY) ? 1 : 0);
/** Lay on hands heals this much (v0), a few times a rest. */
export const layOnHands = (level: number): number => 5 + 3 * level;
/** From this level a Paladin's aura adds its CHA modifier (at least +1) to every save. */
export const AURA_LEVEL = 6;
/** A Monk's ki a rest (v0): a Flurry of blows each. */
export const ki = (level: number): number => 1 + Math.floor(level / 4);
/** Flurry of blows: this many more strikes on the turn it is used. */
export const FLURRY_STRIKES = 1;
/** A Monk's martial arts die (v0): d6, d8 from 5, d10 from 11, d12 from 17. */
export const martialDie = (level: number): number => (level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6);
/** Martial arts: a Monk's every attack brings this many more strikes, at the martial arts die. */
export const MARTIAL_STRIKES = 1;
/** From this level a Monk has Evasion, as a master Stalker does. */
export const EVASION_LEVEL = 7;
/** A Druid's Wild shapes a rest (v0): 2, 3 from level 10. */
export const wildShapes = (level: number): number => (level >= 10 ? 3 : 2);
/** A Druid's beast form: this much health that takes the blows first (v0); half again on the Moon's Path. */
export const wildShapeHealth = (level: number, path: PathId | null): number =>
  Math.round(4 * level * (onPath({ path, level }, 'moon') ? 1.5 : 1));
/** From this level a Druid's beast strikes twice a turn. */
export const BEAST_TWIN_CLAWS = 5;
/** A Warlock's Armor of Agathys (v0): a ward of its level plus its CHA modifier, as a hard fight begins. */
export const agathys = (level: number, cha: number): number => level + Math.max(0, abilityModifier(cha));
/** A Bard's Bardic inspirations a rest (v0): 3, and one more every fourth level. */
export const inspirations = (level: number): number => 3 + Math.floor(level / 4);
/** The Bardic inspiration die: d6, d8 from 5, d10 from 10, d12 from 15; Lore's Peerless skill makes it one size bigger (d12 at most). */
export const inspirationDie = (level: number, path: PathId | null = null): number =>
  Math.min(12, (level >= 15 ? 12 : level >= 10 ? 10 : level >= 5 ? 8 : 6) + (onPath({ path, level }, 'lore') ? 2 : 0));

/** A Barbarian's Rages a rest (SRD): 2, then 3 at level 3, 4 at 6, 5 at 12 and 6 at 17. */
export const rages = (level: number): number => (level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2);

/**
 * Rage's edge (v0): +1 damage on every hit, and 1 less from every blow that lands; 2 from
 * level 9, 3 from 16. The SRD halves the blows, and its +2/+3/+4 here still left Barbarians
 * all but unbeatable by Mini-bosses (balance:par).
 */
export const rageDamage = (level: number): number => (level >= 16 ? 3 : level >= 9 ? 2 : 1);

/** A Ranger's Hunter's marks a rest: 2, and one more at 5, 9, 13 and 17 (v0). */
export const marks = (level: number): number => 2 + Math.floor((level - 1) / 4);

/** Hunter's mark: this many d6 more on every hit against the marked monster (SRD). */
export const MARK_DICE: [number, number] = [1, 6];

/** A Ranger's Archery: to hit with a bow (SRD Fighting Style). */
export const ARCHERY_BONUS = 2;

/**
 * Attacks a turn: Fighters gain one at 5, 11 and 20; Barbarians, Rangers, Paladins and
 * Monks one at 5; a Warlock's Eldritch blast a beam more at 5, 11 and 17; a master of War
 * gets two.
 */
export const attacksPerTurn = (cls: ClassId, level: number, path: PathId | null): number => (cls === 'fighter' || cls === 'warlock'
  ? 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= (cls === 'fighter' ? 20 : 17) ? 1 : 0)
  : cls === 'barbarian' || cls === 'ranger' || cls === 'paladin' || cls === 'monk' ? 1 + (level >= 5 ? 1 : 0)
  : onPath({ path, level }, 'war', PATH_MASTERY) ? 2 : 1);

/**
 * A caster's attack spell: one die more at 5, 11 and 17 (a Wizard's, Sorcerer's or Bard's d10s, a Cleric's
 * or Druid's d8s). A Warlock's Eldritch blast stays a d10 a beam, and gains beams.
 */
export function spellDice(cls: ClassId, level: number): [number, number] | null {
  const n = 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0);
  if (cls === 'warlock') return [1, 10];
  const sides: Partial<Record<ClassId, number>> = { wizard: 10, sorcerer: 10, bard: 10, cleric: 8, druid: 8 };
  return sides[cls] ? [n, sides[cls]!] : null;
}

/** The Wizard's burst of fire, on every monster: 2d6, and one d6 more every third level. */
export const burstDice = (level: number): number => 2 + Math.floor(level / 3);

/** Cure wounds: 1d8 plus WIS, and one d8 more every fourth level. */
export const cureDice = (level: number): number => 1 + Math.floor(level / 4);

/** A Rogue's Sneak attack on the fight's first hit: half the level in d6, rounded up. */
export const sneakDice = (level: number): number => Math.ceil(level / 2);

/** From this level a Rogue's Uncanny dodge halves the first hit of each fight. */
export const UNCANNY_DODGE_LEVEL = 3;

/** One level's health: the Hit Die rolled, never below its average, plus CON, the Race's bonus and Tough. */
function healthBonus(hero: { race: RaceId; con: number; talents: readonly TalentId[] }): number {
  return abilityModifier(hero.con) + RACE_DEFS[hero.race].hpPerLevel + (hero.talents.includes('tough') ? 2 : 0);
}

export function rollLevelHealth(rng: Rng, hero: { class: ClassId; race: RaceId; con: number; talents: readonly TalentId[] }): { roll: number; gain: number } {
  const die = CLASS_DEFS[hero.class].hitDie;
  const roll = rollDie(rng, die);
  return { roll, gain: Math.max(1, Math.max(die / 2 + 1, roll) + healthBonus(hero)) };
}

export interface LevelingHero {
  class: ClassId;
  race: RaceId;
  path: PathId | null;
  level: number;
  con: number;
  talents: readonly TalentId[];
}

const dice = ([n, sides]: [number, number]) => `${n}d${sides}`;
const change = (en: string, ru: string, from: string | number, to: string | number): Text =>
  text(`${en}: ${from} → ${to}`, `${ru}: ${from} → ${to}`);

/** What the next level gives this Hero, in words: every rule above that changes, then the choice it asks for. */
export function levelGains(hero: LevelingHero): Text[] {
  const from = hero.level;
  const to = from + 1;
  const cls = hero.class;
  const gains: Text[] = [];

  const die = CLASS_DEFS[cls].hitDie;
  const bonus = healthBonus(hero);
  const least = Math.max(1, die / 2 + 1 + bonus);
  const most = Math.max(1, die + bonus);
  gains.push(text(`Health: +${least} to +${most}`, `Здоровье: от +${least} до +${most}`));

  if (proficiencyBonus(to) > proficiencyBonus(from)) {
    gains.push(change('Proficiency bonus, on every attack and trained Check', 'Бонус мастерства — к атакам и проверкам навыков', `+${proficiencyBonus(from)}`, `+${proficiencyBonus(to)}`));
  }
  const attacks = [attacksPerTurn(cls, from, hero.path), attacksPerTurn(cls, to, hero.path)] as const;
  if (attacks[1] > attacks[0]) gains.push(change('Attacks a turn', 'Атак за ход', attacks[0], attacks[1]));

  const spell = [spellDice(cls, from), spellDice(cls, to)] as const;
  if (spell[0] && spell[1] && spell[1][0] > spell[0][0]) gains.push(change('Attack spell', 'Боевое заклинание', dice(spell[0]), dice(spell[1])));

  const uses = [restUses(cls, from, hero.path), restUses(cls, to, hero.path)] as const;
  const more = (en: string, ru: string, kind: 'spells' | 'heals') => {
    if (uses[1][kind] > uses[0][kind]) gains.push(change(en, ru, uses[0][kind], uses[1][kind]));
  };
  if (cls === 'fighter' && actionSurges(to) > actionSurges(from)) {
    gains.push(actionSurges(from) === 0
      ? text('New: Action Surge. Once a fight, every attack again in the same turn.', 'Новое: всплеск действий. Раз за бой — все атаки ещё раз в тот же ход.')
      : change('Action Surges a fight', 'Всплесков действий за бой', actionSurges(from), actionSurges(to)));
  }
  if (cls === 'paladin') {
    more('Divine smites a rest', 'Божественных кар за отдых', 'spells');
    if (smiteDice(to, hero.path) > smiteDice(from, hero.path)) gains.push(change('Divine smite', 'Божественная кара', `${smiteDice(from, hero.path)}d8`, `${smiteDice(to, hero.path)}d8`));
    more('Lay on hands a rest', 'Наложений рук за отдых', 'heals');
    gains.push(change('Lay on hands', 'Наложение рук', layOnHands(from), layOnHands(to)));
    if (to === AURA_LEVEL) gains.push(text('New: Aura of protection. Your CHA modifier (at least +1) on every save.', 'Новое: аура защиты. Модификатор ХАР (не меньше +1) к каждому спасброску.'));
  }
  if (cls === 'warlock') more('Hexes a rest', 'Порч за отдых', 'spells');
  if (cls === 'monk') {
    more('Ki (Flurries of blows) a rest', 'Ци (шквалов ударов) за отдых', 'spells');
    if (martialDie(to) > martialDie(from)) gains.push(change('Martial arts', 'Боевые искусства', `1d${martialDie(from)}`, `1d${martialDie(to)}`));
    if (to === EVASION_LEVEL) gains.push(text('New: Evasion. A DEX save against breath or a blast takes no damage on a success, and half on a failure.', 'Новое: увёртливость. Спасбросок ЛОВ от дыхания или взрыва: при успехе урона нет, при провале — половина.'));
  }
  if (cls === 'druid') {
    more('Wild shapes a rest', 'Диких обликов за отдых', 'spells');
    gains.push(change('Beast form health', 'Здоровье звериного облика', wildShapeHealth(from, hero.path), wildShapeHealth(to, hero.path)));
    if (cureDice(to) > cureDice(from)) gains.push(change('Cure wounds', '«Лечение ран»', `${cureDice(from)}d8`, `${cureDice(to)}d8`));
    more('Cure wounds a rest', '«Лечений ран» за отдых', 'heals');
  }
  if (cls === 'bard') {
    more('Bardic inspirations a rest', 'Вдохновений за отдых', 'spells');
    if (cureDice(to) > cureDice(from)) gains.push(change('Cure wounds', '«Лечение ран»', `${cureDice(from)}d8`, `${cureDice(to)}d8`));
    more('Cure wounds a rest', '«Лечений ран» за отдых', 'heals');
    const die = (l: number) => inspirationDie(l, hero.path);
    if (die(to) > die(from)) gains.push(change('Inspiration die', 'Кость вдохновения', `d${die(from)}`, `d${die(to)}`));
  }
  if (cls === 'sorcerer') {
    if (burstDice(to) > burstDice(from)) gains.push(change('Burst of fire, on every monster', 'Огненный взрыв — по всем монстрам', `${burstDice(from)}d6`, `${burstDice(to)}d6`));
    more('Sorcery points a rest', 'Очков чародейства за отдых', 'spells');
  }
  if (cls === 'wizard') {
    if (burstDice(to) > burstDice(from)) gains.push(change('Burst of fire, on every monster', 'Огненный взрыв — по всем монстрам', `${burstDice(from)}d6`, `${burstDice(to)}d6`));
    if (uses[1].spells > uses[0].spells) gains.push(change('Bursts of fire a rest', 'Огненных взрывов за отдых', uses[0].spells, uses[1].spells));
  }
  if (cls === 'cleric') {
    if (cureDice(to) > cureDice(from)) gains.push(change('Cure wounds', '«Лечение ран»', `${cureDice(from)}d8`, `${cureDice(to)}d8`));
    if (uses[1].heals > uses[0].heals) gains.push(change('Cure wounds a rest', '«Лечений ран» за отдых', uses[0].heals, uses[1].heals));
  }
  if (cls === 'barbarian') {
    if (uses[1].spells > uses[0].spells) gains.push(change('Rages a rest', 'Ярость, раз за отдых', uses[0].spells, uses[1].spells));
    if (rageDamage(to) > rageDamage(from)) gains.push(change('Rage damage on every hit', 'Урон в ярости, к каждому удару', `+${rageDamage(from)}`, `+${rageDamage(to)}`));
  }
  if (cls === 'ranger' && uses[1].spells > uses[0].spells) {
    gains.push(change('Hunter’s marks a rest', 'Метка охотника, раз за отдых', uses[0].spells, uses[1].spells));
  }
  if (cls === 'rogue') {
    if (sneakDice(to) > sneakDice(from)) gains.push(change('Sneak attack', 'Скрытая атака', `${sneakDice(from)}d6`, `${sneakDice(to)}d6`));
    if (to === UNCANNY_DODGE_LEVEL) {
      gains.push(text('New: Uncanny dodge. The first hit on you in each fight deals half damage.', 'Новое: невероятное уклонение. Первый удар по вам в каждом бою наносит половину урона.'));
    }
  }

  const path = hero.path ? PATH_DEFS[hero.path] : null;
  const mastery = path?.features.find((f) => f.level === to);
  if (path && mastery) {
    gains.push(text(`${path.name.en} mastery: ${mastery.name.en}. ${mastery.text.en}`, `Мастерство пути «${path.name.ru}»: ${mastery.name.ru}. ${mastery.text.ru}`));
  }
  if (to === PATH_LEVEL && !hero.path) gains.push(text('Choose your Path.', 'Выберите путь.'));
  if ((GROWTH_LEVELS as readonly number[]).includes(to)) gains.push(text('Raise your abilities or learn a Talent.', 'Повысьте характеристики или возьмите талант.'));
  return gains;
}

/** The choice a level asks for before it can be taken. */
export function levelChoice(hero: Pick<LevelingHero, 'path' | 'level'>): 'path' | 'growth' | null {
  const to = hero.level + 1;
  if (to === PATH_LEVEL && !hero.path) return 'path';
  if ((GROWTH_LEVELS as readonly number[]).includes(to)) return 'growth';
  return null;
}
