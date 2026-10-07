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
  /** The Class's power a rest brings back: a Wizard's Bursts of fire, a Barbarian's Rages, a Ranger's Hunter's marks. */
  spells: number;
  /** A Cleric's Cure wounds. */
  heals: number;
}

export function restUses(cls: ClassId, level: number, path: PathId | null = null): RestUses {
  const hero = { path, level };
  return {
    spells: cls === 'wizard' ? 1 + Math.floor(level / 4) + (onPath(hero, 'evoker', PATH_MASTERY) ? 1 : 0)
      : cls === 'barbarian' ? rages(level) : cls === 'ranger' ? marks(level) : 0,
    heals: cls === 'cleric' ? 1 + Math.floor(level / 3) + (onPath(hero, 'life', PATH_MASTERY) ? 1 : 0) : 0,
  };
}

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
 * Weapon attacks a turn: Fighters gain one at 5, 11 and 20; Barbarians and Rangers
 * one at 5; a master of War gets two.
 */
export const attacksPerTurn = (cls: ClassId, level: number, path: PathId | null): number => (cls === 'fighter'
  ? 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 20 ? 1 : 0)
  : cls === 'barbarian' || cls === 'ranger' ? 1 + (level >= 5 ? 1 : 0)
  : onPath({ path, level }, 'war', PATH_MASTERY) ? 2 : 1);

/** A Wizard's or Cleric's attack spell: one die more at 5, 11 and 17. */
export function spellDice(cls: ClassId, level: number): [number, number] | null {
  const n = 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0);
  return cls === 'wizard' ? [n, 10] : cls === 'cleric' ? [n, 8] : null;
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
