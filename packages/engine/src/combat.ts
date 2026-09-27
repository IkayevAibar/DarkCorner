import { type Ability, type AbilityScores, abilityModifier } from './abilities.js';
import { type GearBase, baseById, isGear } from './content/bases.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { type ThemeId, themeOf } from './content/floors.js';
import { RADIANT_BOOST } from './content/loot.js';
import { type MonsterDef, MONSTERS, monsterById } from './content/monsters.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import type { TalentId } from './content/talents.js';
import { type Edge, rollD20, rollDice, sum } from './dice.js';
import { qualityFactor } from './items.js';
import type { Rng } from './rng.js';
import { UPGRADE_STEP, armorClass } from './stats.js';

// ─── Levels ───────────────────────────────────────────────────────────────

/** XP needed to reach each level (index = level). An active Player nears 10 by the Boss gate (v0). */
export const XP_FOR_LEVEL = [0, 0, 100, 300, 700, 1300, 2100, 3100, 4400, 6000, 8000, 10500, 13500, 17000, 21000, 25500, 30500, 36000, 42000, 48500, 55500];
export const MAX_LEVEL = 20;

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_FOR_LEVEL[level + 1]!) level++;
  return level;
}

export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);

// ─── The Hero as it fights ────────────────────────────────────────────────

export interface WornForCombat {
  base: string;
  quality: number | null;
  upgrade: number;
  radiant: boolean;
  bonusStats: { stat: string; value: number }[];
  uniqueId: string | null;
}

export interface HeroCombat {
  name: string;
  class: ClassId;
  race: RaceId;
  level: number;
  talents: TalentId[];
  /** Ability scores with Bonus stats already added. */
  scores: AbilityScores;
  maxHp: number;
  hp: number;
  ac: number;
  weapon: { base: GearBase; factor: number } | null;
  damagePct: number;
  critChance: number;
  spellPower: number;
  healing: number;
  lifeSteal: number;
  uniques: string[];
}

/** Uses that come back on a long rest (a Camp, or the City). */
export interface RestUses {
  spells: number;
  heals: number;
}

export function restUses(cls: ClassId, level: number): RestUses {
  return {
    spells: cls === 'wizard' ? 1 + Math.floor(level / 4) : 0,
    heals: cls === 'cleric' ? 1 + Math.floor(level / 3) : 0,
  };
}

const bonus = (worn: WornForCombat[], stat: string) =>
  worn.reduce((total, g) => total + g.bonusStats
    .filter((b) => b.stat === stat)
    .reduce((s, b) => s + (g.radiant ? Math.round(b.value * RADIANT_BOOST) : b.value), 0), 0);

/** Puts a Hero, its scores and its worn gear together into one fighter. */
export function heroCombat(input: {
  name: string; class: ClassId; race: RaceId; level: number; talents: TalentId[];
  scores: AbilityScores; maxHp: number; hp: number; worn: WornForCombat[];
}): HeroCombat {
  const uniques = input.worn.map((w) => w.uniqueId).filter((u): u is string => Boolean(u));
  const phylactery = uniques.includes('phylactery') ? 2 : 0;
  const scores = { ...input.scores };
  for (const a of Object.keys(scores) as Ability[]) scores[a] += bonus(input.worn, a) + phylactery;

  const weaponGear = input.worn.find((w) => {
    const b = baseById(w.base);
    return isGear(b) && b.slot === 'main' && b.damage;
  });
  const weapon = weaponGear
    ? {
      base: baseById(weaponGear.base) as GearBase,
      factor: qualityFactor(weaponGear.quality ?? 50) * (1 + UPGRADE_STEP * weaponGear.upgrade) * (weaponGear.radiant ? RADIANT_BOOST : 1),
    }
    : null;

  return {
    name: input.name,
    class: input.class,
    race: input.race,
    level: input.level,
    talents: input.talents,
    scores,
    maxHp: input.maxHp + bonus(input.worn, 'maxHp'),
    hp: input.hp,
    ac: armorClass(scores.dex, input.worn),
    weapon,
    damagePct: bonus(input.worn, 'damage'),
    critChance: bonus(input.worn, 'crit'),
    spellPower: bonus(input.worn, 'spellPower'),
    healing: bonus(input.worn, 'healing'),
    lifeSteal: bonus(input.worn, 'lifeSteal'),
    uniques,
  };
}

// ─── Monsters ─────────────────────────────────────────────────────────────

export interface MonsterInstance {
  key: string;
  id: string;
  hp: number;
  maxHp: number;
  ac: number;
  attack: number;
  damage: [number, number, number];
  dex: number;
  xp: number;
}

const THEME_START: Record<ThemeId, number> = { warrens: 1, crypts: 4, depths: 7, lair: 10 };

/** A monster scaled to its Floor: each Floor deeper into a theme adds 15% health and +1 to hit and damage. */
export function instantiate(def: MonsterDef, floor: number, key: string, weakening = 0): MonsterInstance {
  const depth = Math.max(0, floor - THEME_START[def.theme]);
  const hp = Math.round(def.hp * (1 + 0.15 * depth) * (1 - weakening));
  return {
    key,
    id: def.id,
    hp,
    maxHp: hp,
    ac: def.ac,
    attack: def.attack + depth,
    damage: [def.damage[0], def.damage[1], def.damage[2] + depth],
    dex: def.dex,
    xp: Math.round(def.xp * (1 + 0.1 * depth)),
  };
}

/** The group waiting in a fight Room: 1–2 monsters on Floor 1, up to 3 deeper down, at most one brute. */
export function spawnEncounter(rng: Rng, floor: number, kind: 'fight' | 'miniboss' | 'boss', weakening = 0): MonsterInstance[] {
  const theme = themeOf(floor);
  if (kind !== 'fight') {
    const def = MONSTERS.find((d) => d.theme === theme && d.role === kind);
    if (!def) throw new Error(`no ${kind} for theme ${theme}`);
    return [instantiate(def, floor, 'm0', kind === 'boss' ? weakening : 0)];
  }
  const sizes: [number, number][] = floor === 1 ? [[1, 70], [2, 30]] : floor === 2 ? [[1, 40], [2, 50], [3, 10]] : [[1, 30], [2, 50], [3, 20]];
  let r = rng.next() * 100;
  const size = sizes.find(([, w]) => (r -= w) < 0)?.[0] ?? 1;
  const pool = MONSTERS.filter((d) => d.theme === theme && (d.role === 'minion' || d.role === 'brute') && d.weight > 0);
  const out: MonsterInstance[] = [];
  let brutes = 0;
  for (let i = 0; i < size; i++) {
    const options = pool.filter((d) => d.role === 'minion' || brutes === 0);
    const total = options.reduce((s, d) => s + d.weight, 0);
    let pick = rng.next() * total;
    const def = options.find((d) => (pick -= d.weight) < 0) ?? options[0]!;
    if (def.role === 'brute') brutes++;
    out.push(instantiate(def, floor, `m${i}`));
  }
  return out;
}

// ─── The fight ────────────────────────────────────────────────────────────

export type FightOutcome = 'victory' | 'survived' | 'dead';

export type FightEvent =
  | { type: 'initiative'; order: string[] }
  | { type: 'attack'; actor: string; target: string; natural: number; total: number; hit: boolean; crit: boolean; damage: number; targetHp: number; kind: 'weapon' | 'spell' }
  | { type: 'blocked'; actor: string }
  | { type: 'burst'; actor: string; targets: { key: string; damage: number; hp: number }[] }
  | { type: 'heal'; actor: string; ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal'; amount: number; hp: number }
  | { type: 'defeated'; key: string }
  | { type: 'down' }
  | { type: 'death-save'; natural: number; successes: number; failures: number }
  | { type: 'rise'; hp: number }
  /** Lucky charm or Luckstone: a failed death save's d20 (
atural) is rolled again, keeping the better. */
  | { type: 'reroll'; natural: number }
  | { type: 'end'; outcome: FightOutcome };

export interface FightInput {
  hero: HeroCombat;
  monsters: MonsterInstance[];
  uses: RestUses;
  potions: number;
  /** Once-per-Run powers still unspent (Deathless Mail, Luckstone, Lucky charm). */
  runPowers: { deathless: boolean; lucky: boolean };
}

export interface FightResult {
  events: FightEvent[];
  outcome: FightOutcome;
  hp: number;
  uses: RestUses;
  potionsUsed: number;
  xp: number;
  defeated: string[];
  runPowers: { deathless: boolean; lucky: boolean };
}

const DEATH_SAVE_DC = 10;
const ROUND_LIMIT = 60;

/**
 * Plays out a whole fight on the server. The web never rolls: it replays
 * `events`. Everything comes from `rng`, so the same seed replays the same fight.
 */
export function simulateFight(rng: Rng, input: FightInput): FightResult {
  const hero = { ...input.hero };
  const mons = input.monsters.map((mm) => ({ ...mm }));
  const uses = { ...input.uses };
  const runPowers = { ...input.runPowers };
  const events: FightEvent[] = [];
  const defeated: string[] = [];
  let potions = input.potions;
  let potionsUsed = 0;
  let secondWind = hero.class === 'fighter';
  let sneakReady = hero.class === 'rogue';
  let firstHitCrit = hero.uniques.includes('gravewhisper');
  let aegis = hero.uniques.includes('ashen-aegis');
  /** The Last Ember: once per fight a missed spell hits for double. */
  let lastEmber = hero.uniques.includes('last-ember');
  /** Saint's Knuckle: the first Cure wounds of a fight gives its use back. */
  let knuckle = hero.uniques.includes('saints-knuckle');
  /** Rogue Uncanny dodge (from level 3, v0): the first hit each round deals half damage. */
  const dodges = hero.class === 'rogue' && hero.level >= 3;
  let dodgeReady = dodges;
  const cls = CLASS_DEFS[hero.class];
  const rerollOnes = RACE_DEFS[hero.race].rerollOnes;
  const mod = (a: Ability) => abilityModifier(hero.scores[a]);
  const prof = proficiencyBonus(hero.level);
  const caster = hero.class === 'wizard' || hero.class === 'cleric';
  const attackAbility: Ability = caster ? cls.primary : hero.weapon?.base.weapon === 'bow' || hero.class === 'rogue' ? 'dex' : 'str';
  const critFrom = Math.max(18, 20 - Math.floor(hero.critChance / 5));
  const alive = () => mons.filter((mm) => mm.hp > 0);

  // Initiative. Rogues strike first: they roll it with advantage.
  const init = new Map<string, number>();
  const heroInit = rollD20(rng, { rerollOnes, edge: hero.class === 'rogue' ? 'advantage' : 'normal' }).natural;
  init.set('hero', hero.uniques.includes('wardens-longbow') ? 99 : heroInit + mod('dex') + (hero.talents.includes('alert') ? 5 : 0));
  for (const mm of mons) init.set(mm.key, rollD20(rng).natural + abilityModifier(mm.dex));
  const order = [...init.entries()].sort((p, q) => q[1] - p[1]).map(([k]) => k);
  events.push({ type: 'initiative', order });

  const heal = (ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal', amount: number) => {
    const gained = Math.max(0, Math.min(hero.maxHp - hero.hp, Math.round(amount)));
    hero.hp += gained;
    events.push({ type: 'heal', actor: 'hero', ability, amount: gained, hp: hero.hp });
  };

  const scaleDice = (level: number) => 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0);

  const heroAttack = (edge: Edge = 'normal') => {
    const targets = alive();
    if (targets.length === 0) return;
    const target = targets.reduce((a, b) => (b.hp < a.hp ? b : a));
    const roll = rollD20(rng, { edge, rerollOnes });
    const total = roll.natural + prof + mod(attackAbility);
    let crit = roll.natural >= critFrom;
    let hit = crit || (roll.natural !== 1 && total >= target.ac);
    const ember = !hit && caster && lastEmber;
    if (ember) {
      lastEmber = false;
      hit = true;
    }
    if (hit && firstHitCrit) {
      crit = true;
      firstHitCrit = false;
    }
    let damage = 0;
    if (hit) {
      const targetDef = monsterById(target.id);
      if (caster) {
        const [n, sides] = hero.class === 'wizard' ? [scaleDice(hero.level), 10] : [scaleDice(hero.level), 8];
        damage = sum(rollDice(rng, crit ? n * 2 : n, sides)) + mod(cls.primary);
        damage *= 1 + hero.spellPower / 100;
        if (hero.class === 'cleric' && targetDef.kin === 'undead') damage *= 2;
        if (hero.uniques.includes('lantern-of-the-deep') && (targetDef.kin === 'undead' || targetDef.kin === 'demon')) damage *= 1.25;
        if (ember) damage *= 2;
      } else {
        const [n, sides] = hero.weapon?.base.damage ?? [1, 4];
        const once = () => sum(rollDice(rng, crit ? n * 2 : n, sides));
        let dice = once();
        if (hero.talents.includes('savage-attacker')) dice = Math.max(dice, once());
        damage = dice * (hero.weapon?.factor ?? 1) + mod(attackAbility);
        if (sneakReady) {
          const sneak = Math.ceil(hero.level / 2);
          damage += sum(rollDice(rng, crit ? sneak * 2 : sneak, 6));
          sneakReady = false;
        }
      }
      damage *= 1 + hero.damagePct / 100;
      if (hero.uniques.includes('oathbreaker') && hero.hp < hero.maxHp / 2) damage *= 1.5;
      if (hero.uniques.includes('dragonbone-blade') && targetDef.kin === 'dragonkin') damage *= 2;
      if (crit && hero.uniques.includes('ember-fang')) damage += sum(rollDice(rng, 2, 6));
      damage = Math.max(1, Math.round(damage));
      target.hp = Math.max(0, target.hp - damage);
    }
    events.push({ type: 'attack', actor: 'hero', target: target.key, natural: roll.natural, total, hit, crit, damage, targetHp: target.hp, kind: caster ? 'spell' : 'weapon' });
    if (hit && hero.lifeSteal > 0) heal('life-steal', (damage * hero.lifeSteal) / 100);
    if (hit && crit && hero.uniques.includes('wyrmfire')) {
      for (const other of alive()) {
        if (other === target) continue;
        other.hp = Math.max(0, other.hp - Math.round(damage / 2));
        events.push({ type: 'attack', actor: 'hero', target: other.key, natural: roll.natural, total, hit: true, crit: false, damage: Math.round(damage / 2), targetHp: other.hp, kind: 'weapon' });
      }
    }
    for (const mm of mons) {
      if (mm.hp <= 0 && !defeated.includes(mm.key)) {
        defeated.push(mm.key);
        events.push({ type: 'defeated', key: mm.key });
      }
    }
  };

  const heroTurn = () => {
    const low = hero.hp < hero.maxHp * 0.45;
    if (low && secondWind) {
      secondWind = false;
      heal('second-wind', sum(rollDice(rng, 1, 10)) + hero.level);
      return;
    }
    if (low && uses.heals > 0) {
      if (knuckle) knuckle = false;
      else uses.heals--;
      heal('cure-wounds', (sum(rollDice(rng, 1 + Math.floor(hero.level / 4), 8)) + mod('wis')) * (1 + hero.healing / 100));
      return;
    }
    if (hero.hp < hero.maxHp * 0.3 && potions > 0) {
      potions--;
      potionsUsed++;
      heal('potion', (sum(rollDice(rng, 2, 4)) + 2) * (hero.talents.includes('field-medic') ? 1.5 : 1) * (1 + hero.healing / 100));
      return;
    }
    if (hero.class === 'wizard' && uses.spells > 0 && alive().length >= 2) {
      uses.spells--;
      const dice = 2 + Math.floor(hero.level / 3);
      const targets = alive().map((mm) => {
        const damage = Math.max(1, Math.round(sum(rollDice(rng, dice, 6)) * (1 + hero.spellPower / 100)));
        mm.hp = Math.max(0, mm.hp - damage);
        return { key: mm.key, damage, hp: mm.hp };
      });
      events.push({ type: 'burst', actor: 'hero', targets });
      for (const mm of mons) {
        if (mm.hp <= 0 && !defeated.includes(mm.key)) {
          defeated.push(mm.key);
          events.push({ type: 'defeated', key: mm.key });
        }
      }
      return;
    }
    const attacks = hero.class === 'fighter' ? 1 + (hero.level >= 5 ? 1 : 0) + (hero.level >= 11 ? 1 : 0) + (hero.level >= 20 ? 1 : 0) : 1;
    for (let i = 0; i < attacks && alive().length > 0; i++) heroAttack();
  };

  const monsterTurn = (mm: MonsterInstance) => {
    const roll = rollD20(rng);
    const total = roll.natural + mm.attack;
    const crit = roll.natural === 20 && !hero.uniques.includes('drowned-crown');
    const hit = roll.natural === 20 || (roll.natural !== 1 && total >= hero.ac);
    let damage = 0;
    if (hit && aegis) {
      aegis = false;
      events.push({ type: 'blocked', actor: mm.key });
      return;
    }
    if (hit) {
      const [n, sides, plus] = mm.damage;
      damage = Math.max(1, sum(rollDice(rng, crit ? n * 2 : n, sides)) + plus);
      if (dodgeReady) {
        dodgeReady = false;
        damage = Math.max(1, Math.floor(damage / 2));
      }
      hero.hp = Math.max(0, hero.hp - damage);
      if (hero.hp === 0 && runPowers.deathless && hero.uniques.includes('deathless-mail')) {
        runPowers.deathless = false;
        hero.hp = 1;
      }
    }
    events.push({ type: 'attack', actor: mm.key, target: 'hero', natural: roll.natural, total, hit, crit, damage, targetHp: hero.hp, kind: 'weapon' });
  };

  /** 3 successes (10+) or 3 failures; a natural 20 stands up, a natural 1 counts twice. */
  const deathSaves = (): 'rise' | 'survived' | 'dead' => {
    events.push({ type: 'down' });
    let successes = 0;
    let failures = 0;
    while (successes < 3 && failures < 3) {
      let { natural } = rollD20(rng, { rerollOnes });
      if (natural < DEATH_SAVE_DC && runPowers.lucky && (hero.talents.includes('lucky-charm') || hero.uniques.includes('luckstone'))) {
        runPowers.lucky = false;
        events.push({ type: 'reroll', natural });
        natural = Math.max(natural, rollD20(rng, { rerollOnes }).natural);
      }
      if (natural === 20) {
        hero.hp = Math.max(1, Math.floor(hero.maxHp / 4));
        events.push({ type: 'death-save', natural, successes, failures });
        events.push({ type: 'rise', hp: hero.hp });
        return 'rise';
      }
      if (natural === 1) failures += 2;
      else if (natural >= DEATH_SAVE_DC) successes++;
      else failures++;
      events.push({ type: 'death-save', natural, successes: Math.min(successes, 3), failures: Math.min(failures, 3) });
    }
    if (successes >= 3) {
      hero.hp = 1;
      return 'survived';
    }
    return 'dead';
  };

  let outcome: FightOutcome | null = null;
  for (let round = 1; round <= ROUND_LIMIT && outcome === null; round++) {
    dodgeReady = dodges;
    for (const key of order) {
      if (outcome !== null) break;
      if (key === 'hero') heroTurn();
      else {
        const mm = mons.find((x) => x.key === key)!;
        if (mm.hp > 0) monsterTurn(mm);
      }
      if (alive().length === 0) outcome = 'victory';
      else if (hero.hp <= 0) {
        const save = deathSaves();
        if (save !== 'rise') outcome = save;
      }
    }
  }
  // A fight that runs out of rounds ends with the Hero pulling back, alive.
  outcome ??= 'survived';
  events.push({ type: 'end', outcome });

  const xp = mons.filter((mm) => defeated.includes(mm.key)).reduce((s, mm) => s + mm.xp, 0);
  return { events, outcome, hp: outcome === 'dead' ? 0 : hero.hp, uses, potionsUsed, xp, defeated, runPowers };
}
