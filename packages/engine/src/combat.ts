import { type Ability, type AbilityScores, abilityModifier } from './abilities.js';
import { type CheckInput, check } from './check.js';
import { type GearBase, baseById, isGear } from './content/bases.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { type ThemeId, themeOf } from './content/floors.js';
import { RADIANT_BOOST } from './content/loot.js';
import {
  ELITE_CHANCE, ELITE_HP, ELITES, type EliteId, GILDED_HP, type MonsterDef, type MonsterPower, type MonsterPowerId, MONSTERS, monsterById,
} from './content/monsters.js';
import type { OmenDef } from './content/omens.js';
import { type PathId, PATH_MASTERY, onPath } from './content/paths.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import { DEFAULT_STANCE, STANCE_DEFS, type StanceId } from './content/stances.js';
import type { TalentId } from './content/talents.js';
import { type Edge, rollD20, rollDice, sum } from './dice.js';
import { type Rng, createRng } from './rng.js';
import {
  type RestUses, UNCANNY_DODGE_LEVEL, attacksPerTurn, burstDice, cureDice, proficiencyBonus, sneakDice, spellDice,
} from './levels.js';
import { armorClass, gearFactor } from './stats.js';

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
  /** The Path chosen at level 3, if any (content/paths.ts). */
  path: PathId | null;
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
  /** "+N% escape chance" Bonus stats: every 5% is +1 on Sneak and Escape rolls. */
  escape: number;
  /** Heavy body armor clanks: Sneaking with disadvantage. */
  heavyArmor: boolean;
  uniques: string[];
}

/** Battle-hardened: +1 AC on top of gear. */
export const talentArmor = (talents: readonly TalentId[]): number => (talents.includes('battle-hardened') ? 1 : 0);

const bonus = (worn: WornForCombat[], stat: string) =>
  worn.reduce((total, g) => total + g.bonusStats
    .filter((b) => b.stat === stat)
    .reduce((s, b) => s + (g.radiant ? Math.round(b.value * RADIANT_BOOST) : b.value), 0), 0);

/** Full health with gear on: the Hero's own plus its "+N max health" Bonus stats. */
export const maxHealth = (base: number, worn: Pick<WornForCombat, 'bonusStats' | 'radiant'>[]): number =>
  base + worn.reduce((total, g) => total + g.bonusStats
    .filter((b) => b.stat === 'maxHp')
    .reduce((s, b) => s + (g.radiant ? Math.round(b.value * RADIANT_BOOST) : b.value), 0), 0);

/**
 * A Healing potion (v0): 2d4 + 2 plus a tenth of the drinker's full health, so it
 * still matters deep down. Field medics get half again as much.
 */
export function potionHealing(rng: Rng, fullHealth: number, fieldMedic: boolean): number {
  return (sum(rollDice(rng, 2, 4)) + 2 + Math.round(fullHealth * 0.1)) * (fieldMedic ? 1.5 : 1);
}

/** Puts a Hero, its scores and its worn gear together into one fighter. */
export function heroCombat(input: {
  name: string; class: ClassId; race: RaceId; level: number; talents: TalentId[]; path?: PathId | null;
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
      factor: gearFactor(weaponGear),
    }
    : null;

  const maxHp = maxHealth(input.maxHp, input.worn);
  return {
    name: input.name,
    class: input.class,
    race: input.race,
    level: input.level,
    talents: input.talents,
    path: input.path ?? null,
    scores,
    maxHp,
    // Gear taken off since the last fight can leave more health than now fits.
    hp: Math.min(input.hp, maxHp),
    ac: armorClass(scores.dex, input.worn) + talentArmor(input.talents),
    weapon,
    damagePct: bonus(input.worn, 'damage'),
    critChance: bonus(input.worn, 'crit'),
    spellPower: bonus(input.worn, 'spellPower'),
    healing: bonus(input.worn, 'healing'),
    lifeSteal: bonus(input.worn, 'lifeSteal'),
    escape: bonus(input.worn, 'escape'),
    heavyArmor: input.worn.some((w) => {
      const b = baseById(w.base);
      return isGear(b) && b.slot === 'body' && b.armor === 'heavy';
    }),
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
  /** A weakened Boss hits softer and a Frenzied elite harder (1 = as written). */
  damageFactor: number;
  /** Floors below where its theme starts: its save DCs grow by 1 for every two. */
  depth: number;
  elite: EliteId | null;
  /** Its own powers plus whatever its elite gift adds. */
  powers: MonsterPower[];
}

const THEME_START: Record<ThemeId, number> = { warrens: 1, crypts: 4, depths: 7, lair: 10 };

/**
 * A monster scaled to its Floor: each Floor deeper into a theme adds 15% health
 * and +1 to hit and damage. An elite gift toughens it further (content/monsters.ts).
 */
export function instantiate(def: MonsterDef, floor: number, key: string, weakening = 0, elite: EliteId | null = null): MonsterInstance {
  // Monsters that turn up anywhere grow as if they lived on the Floor; the Dragon is its own measure.
  const depth = Math.max(0, floor - THEME_START[def.anywhere ? themeOf(floor) : def.theme]);
  const might = def.role === 'boss' ? { hp: 1, hit: 0, damage: 0 } : floorMight(floor);
  const toughness = elite === 'gilded' ? GILDED_HP : elite ? ELITE_HP : 1;
  const hp = Math.round(def.hp * (1 + 0.15 * depth) * might.hp * (1 - weakening) * toughness);
  const powers = [...(def.powers ?? [])];
  if (elite === 'vampiric' && !powers.some((p) => p.id === 'drain')) powers.push({ id: 'drain' });
  if (elite === 'swift') {
    const multi = powers.find((p) => p.id === 'multiattack');
    if (multi?.id === 'multiattack') powers.splice(powers.indexOf(multi), 1, { id: 'multiattack', attacks: multi.attacks + 1 });
    else powers.push({ id: 'multiattack', attacks: 2 });
    if (!powers.some((p) => p.id === 'quick')) powers.push({ id: 'quick' });
  }
  return {
    key,
    id: def.id,
    hp,
    maxHp: hp,
    ac: def.ac + (elite === 'armored' ? 3 : 0),
    attack: def.attack + depth + might.hit,
    damage: [def.damage[0], def.damage[1], def.damage[2] + depth + might.damage],
    dex: def.dex,
    xp: Math.round(def.xp * (1 + 0.1 * depth) * (elite ? 2 : 1)),
    damageFactor: (1 - weakening) * (elite === 'frenzied' ? 1.5 : 1),
    depth,
    elite,
    powers,
  };
}

/**
 * Depth's own weight, on top of the theme (v0): every monster grows tougher the deeper
 * its Floor, to keep pace with Heroes whose gear keeps getting better.
 */
export function floorMight(floor: number): { hp: number; hit: number; damage: number } {
  const below = Math.max(0, floor - 2);
  return { hp: 1 + MIGHT.hp * below, hit: Math.round(MIGHT.hit * below), damage: Math.round(MIGHT.damage * below) };
}
export const MIGHT = { hp: 0.2, hit: 0.75, damage: 0.55 };

/** The day's Omen on a monster: more or less health, harder or softer blows. */
function underOmen(mm: MonsterInstance, omen: OmenDef | null): MonsterInstance {
  if (!omen || (!omen.monsterHp && !omen.monsterDamage)) return mm;
  const hp = Math.max(1, Math.round(mm.maxHp * (omen.monsterHp ?? 1)));
  return { ...mm, hp, maxHp: hp, damageFactor: mm.damageFactor * (omen.monsterDamage ?? 1) };
}

/**
 * Who waits in a Room. A fight Room holds 1–2 monsters on Floor 1 and up to 3
 * deeper down, at most one of them a brute; from Floor 2 its strongest may be an
 * elite. A Mini-boss or the Boss comes with its escort. The day's Omen may make
 * them tougher or weaker, and elites more common.
 */
export function spawnEncounter(rng: Rng, floor: number, kind: 'fight' | 'miniboss' | 'boss', weakening = 0, omen: OmenDef | null = null): MonsterInstance[] {
  const out = spawnGroup(rng, floor, kind, weakening, omen);
  return out.map((mm) => underOmen(mm, omen));
}

function spawnGroup(rng: Rng, floor: number, kind: 'fight' | 'miniboss' | 'boss', weakening: number, omen: OmenDef | null): MonsterInstance[] {
  const theme = themeOf(floor);
  if (kind !== 'fight') {
    const def = MONSTERS.find((d) => d.theme === theme && d.role === kind);
    if (!def) throw new Error(`no ${kind} for theme ${theme}`);
    const leader = instantiate(def, floor, 'm0', kind === 'boss' ? weakening : 0);
    return [leader, ...(def.escort ?? []).map((id, i) => instantiate(monsterById(id), floor, `m${i + 1}`))];
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
  if (floor >= 2 && rng.chance(Math.min(1, ELITE_CHANCE[theme] * (omen?.elites ?? 1)))) {
    const strongest = out.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
    out[out.indexOf(strongest)] = instantiate(monsterById(strongest.id), floor, strongest.key, 0, rng.pick([...ELITES]));
  }
  return out;
}

// ─── The fight ────────────────────────────────────────────────────────────

/** Escaped: an Escape roll got the Hero out; like surviving, it ends back in the last safe Room. */
export type FightOutcome = 'victory' | 'survived' | 'escaped' | 'dead';

/** Lasting effects: burning and poisoned hurt each turn, paralyzed loses a turn, frightened attacks with disadvantage. */
export type StatusId = 'burning' | 'paralyzed' | 'frightened' | 'poisoned';

export type FightEvent =
  | { type: 'initiative'; order: string[] }
  /** That side was caught off guard and loses its turns in the first round. */
  | { type: 'surprise'; side: 'hero' | 'monsters' }
  | { type: 'attack'; actor: string; target: string; natural: number; total: number; hit: boolean; crit: boolean; damage: number; targetHp: number; kind: 'weapon' | 'spell' }
  /** A blow turned aside: by the Ashen Aegis, or by a Wizard's Shield. */
  | { type: 'blocked'; actor: string; by: 'aegis' | 'shield' }
  | { type: 'burst'; actor: string; source: 'spell' | 'bomb'; targets: { key: string; damage: number; hp: number }[] }
  | { type: 'heal'; actor: string; ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal'; amount: number; hp: number }
  /**
   * A Hero's Path at work: `survivor` heals `amount` to `hp`; `indomitable` keeps it
   * standing at `hp` 1; `ward` is raised (`left`) or soaks `amount` of a hit (`left` after).
   */
  | { type: 'feature'; feature: 'survivor' | 'indomitable' | 'ward'; amount?: number; hp?: number; left?: number }
  /**
   * A monster's power at work. `amount` is gold stolen (thief), health restored
   * (mend, drain) or damage dealt (breath, explode, wail); `hp` is the target's health after it.
   */
  | { type: 'power'; actor: string; power: MonsterPowerId; target?: string; amount?: number; hp?: number }
  /** A saving throw the Hero makes against a monster's power. */
  | { type: 'save'; ability: Ability; natural: number; total: number; dc: number; success: boolean }
  | { type: 'status'; target: string; status: StatusId; turns: number }
  /** Damage at the start of a turn: burning, or `status` poisoned. */
  | { type: 'tick'; target: string; damage: number; hp: number; status?: 'poisoned' }
  /** Paralyzed: the turn is lost. */
  | { type: 'held'; target: string }
  /**
   * A lasting effect wears off while the fight goes on: burning and poison after their
   * last tick, paralysis after the lost turn, fear at the end of its last round.
   * (Going down or falling ends them too, without this event.)
   */
  | { type: 'expire'; target: string; status: StatusId }
  /** A monster runs off, a thief with what it stole. */
  | { type: 'fled'; key: string }
  | { type: 'defeated'; key: string }
  | { type: 'down' }
  | { type: 'death-save'; natural: number; successes: number; failures: number }
  | { type: 'rise'; hp: number }
  /** Lucky charm or Luckstone: a failed death save's d20 (`natural`) is rolled again, keeping the better. */
  | { type: 'reroll'; natural: number }
  /** An Escape roll, made by Stance when the Hero is badly hurt. */
  | { type: 'escape'; natural: number; total: number; dc: number; success: boolean }
  | { type: 'end'; outcome: FightOutcome };

export interface FightInput {
  hero: HeroCombat;
  monsters: MonsterInstance[];
  uses: RestUses;
  potions: number;
  /** Once-per-Run powers still unspent (Deathless Mail, Luckstone, Lucky charm). */
  runPowers: { deathless: boolean; lucky: boolean };
  /** How the Hero fights; Steady when left out. */
  stance?: StanceId;
  /** The side caught off guard: it loses its turns in the first round. */
  surprise?: 'hero' | 'monsters' | null;
  /** A Fire bomb thrown before the first round: one roll that every monster takes. */
  bomb?: { dice: number; sides: number; bonus: number } | null;
  /** Gold the Hero carries, for thieves to steal. */
  gold?: number;
  /** Added to Escape rolls (the day's Omen). */
  escapeBonus?: number;
  /** The Player was shown this fight as Trivial: the Hero can be knocked down, never killed. */
  spare?: boolean;
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
  /** Carried gold that ran off with a thief. */
  goldStolen: number;
}

const DEATH_SAVE_DC = 10;
/** A Hero drinks at most this many potions in one fight (v0), however many it carries. */
export const POTIONS_PER_FIGHT = 3;
const ROUND_LIMIT = 60;
/** Thief, Ghost: the round from which every round's Sneak attack gets the full dice (v0). */
export const THIEF_STUDY_ROUND = 4;
/** Ember Fang: a critical hit leaves the enemy burning (v0). */
const EMBER_BURN = { turns: 3, dice: [1, 6] as [number, number] };

/** Advantage and disadvantage cancel out, as in the SRD. */
function combine(a: Edge, b: Edge): Edge {
  if (a === 'normal') return b;
  if (b === 'normal' || a === b) return a;
  return 'normal';
}

function powerOf<P extends MonsterPowerId>(mm: MonsterInstance, id: P): Extract<MonsterPower, { id: P }> | null {
  return (mm.powers.find((p) => p.id === id) as Extract<MonsterPower, { id: P }> | undefined) ?? null;
}

/**
 * Plays out a whole fight on the server. The web never rolls: it replays
 * `events`. Everything comes from `rng`, so the same seed replays the same fight.
 */
export function simulateFight(rng: Rng, input: FightInput): FightResult {
  const stance = STANCE_DEFS[input.stance ?? DEFAULT_STANCE];
  const hero = { ...input.hero, ac: input.hero.ac + stance.ac };
  const mons = input.monsters.map((mm) => ({ ...mm }));
  const uses = { ...input.uses };
  const runPowers = { ...input.runPowers };
  const events: FightEvent[] = [];
  const defeated: string[] = [];
  const fled = new Set<string>();
  let potions = input.potions;
  let potionsUsed = 0;
  let goldLeft = input.gold ?? 0;
  let secondWind = hero.class === 'fighter';
  let sneakReady = hero.class === 'rogue';
  let openedFight = false;
  /** The round being fought, for features that grow as a fight drags on. */
  let currentRound = 0;
  const path = (id: PathId, from?: typeof PATH_MASTERY) => onPath(hero, id, from);
  let firstHitCrit = hero.uniques.includes('gravewhisper') || path('assassin', PATH_MASTERY);
  let riposteReady = false;
  /** War, Divine strike: once per turn. */
  let struckThisTurn = false;
  let indomitable = path('guardian', PATH_MASTERY);
  const intMod = abilityModifier(hero.scores.int);
  let ward = path('abjurer') ? 4 * hero.level + intMod : 0;
  const wardMax = ward;
  const fireproof = hero.talents.includes('fireproof');
  const heavyHitter = hero.talents.includes('heavy-hitter') ? 2 : 0;
  /** Life: potions and Cure wounds heal half again as much. */
  const lifeBoost = path('life') ? 1.5 : 1;
  /** Life, Preserve life: the first Cure wounds of a fight doesn't cost the turn. */
  let quickCure = path('life', PATH_MASTERY);
  let aegis = hero.uniques.includes('ashen-aegis');
  /** Wizard, Shield: the first blow of each fight that would land is turned aside. */
  let shield = hero.class === 'wizard';
  /** The Last Ember: once per fight a missed spell hits for double. */
  let lastEmber = hero.uniques.includes('last-ember');
  /** Saint's Knuckle: the first Cure wounds of a fight gives its use back. */
  let knuckle = hero.uniques.includes('saints-knuckle');
  /** Rogue Uncanny dodge (from level 3, v0): the first hit each round deals half damage. */
  const dodges = hero.class === 'rogue' && hero.level >= UNCANNY_DODGE_LEVEL;
  let dodgeReady = dodges;
  const cls = CLASS_DEFS[hero.class];
  const rerollOnes = RACE_DEFS[hero.race].rerollOnes;
  const mod = (a: Ability) => abilityModifier(hero.scores[a]);
  const prof = proficiencyBonus(hero.level);
  const caster = hero.class === 'wizard' || hero.class === 'cleric';
  const attackAbility: Ability = caster ? cls.primary : hero.weapon?.base.weapon === 'bow' || hero.class === 'rogue' ? 'dex' : 'str';
  const champion = path('champion') ? 1 : 0;
  const critFrom = Math.max(18 - champion, 20 - Math.floor(hero.critChance / 5) - champion);

  // What lasts between turns.
  const burning = new Map<string, { turns: number; dice: [number, number] }>();
  /** Only the Hero is ever poisoned. */
  const poisoned = { turns: 0, dice: [1, 4] as [number, number] };
  let held = 0;
  let frightened = 0;
  const stolen = new Map<string, number>();
  const breathReady = new Set(mons.filter((mm) => powerOf(mm, 'breath')).map((mm) => mm.key));
  const mended = new Set<string>();
  const stoodUp = new Set<string>();
  const enraged = new Set<string>();
  let escaped = false;

  const alive = () => mons.filter((mm) => mm.hp > 0 && !fled.has(mm.key));
  const markDefeated = () => {
    for (const mm of mons) {
      if (mm.hp <= 0 && !defeated.includes(mm.key)) {
        defeated.push(mm.key);
        stolen.delete(mm.key);
        events.push({ type: 'defeated', key: mm.key });
        // A sapper's bomb goes off as it falls.
        const blast = powerOf(mm, 'explode');
        if (blast && hero.hp > 0) {
          const full = Math.round(sum(rollDice(rng, blast.dice[0], blast.dice[1])) * mm.damageFactor * (fireproof ? 0.5 : 1));
          const saved = heroSave('dex', dcOf(mm, blast.dc));
          const damage = Math.max(1, saved ? Math.floor(full / 2) : full);
          const after = hurtHero(damage);
          events.push({ type: 'power', actor: mm.key, power: 'explode', target: 'hero', amount: damage, hp: hero.hp }, ...after);
        }
      }
    }
  };
  const proficientSaves = new Set<Ability>([...cls.saves, ...(hero.talents.includes('iron-will') ? (['con', 'wis'] as const) : [])]);
  const heroSave = (ability: Ability, dc: number) => {
    const result = check(rng, {
      modifier: mod(ability) + (proficientSaves.has(ability) ? prof : 0), dc, rerollOnes,
      edge: path('abjurer', PATH_MASTERY) ? 'advantage' : 'normal',
    });
    events.push({ type: 'save', ability, natural: result.roll.natural, total: result.total, dc, success: result.success });
    return result.success;
  };
  const dcOf = (mm: MonsterInstance, dc: number) => dc + Math.floor(mm.depth / 2);
  /**
   * Damage to the Hero: the Abjurer's ward soaks it first; Indomitable or Deathless
   * Mail may keep it standing. Returns the events to add after the blow itself.
   */
  const hurtHero = (damage: number): FightEvent[] => {
    const after: FightEvent[] = [];
    if (ward > 0 && damage > 0) {
      const soaked = Math.min(ward, damage);
      ward -= soaked;
      damage -= soaked;
      after.push({ type: 'feature', feature: 'ward', amount: soaked, left: ward });
    }
    hero.hp = Math.max(0, hero.hp - damage);
    if (hero.hp === 0 && indomitable) {
      indomitable = false;
      hero.hp = 1;
      after.push({ type: 'feature', feature: 'indomitable', hp: 1 });
    }
    if (hero.hp === 0 && runPowers.deathless && hero.uniques.includes('deathless-mail')) {
      runPowers.deathless = false;
      hero.hp = 1;
    }
    return after;
  };
  /**
   * Damage to a monster: an undying one may stay up at 1 health once, and one
   * that enrages does so the first time it drops below half. Returns the events
   * to add after the blow itself.
   */
  const wound = (mm: MonsterInstance, damage: number, crit: boolean): FightEvent[] => {
    const after: FightEvent[] = [];
    mm.hp = Math.max(0, mm.hp - damage);
    if (mm.hp === 0 && !crit && powerOf(mm, 'undying') && !stoodUp.has(mm.key) && rng.chance(0.5)) {
      stoodUp.add(mm.key);
      mm.hp = 1;
      after.push({ type: 'power', actor: mm.key, power: 'undying', hp: 1 });
    }
    if (mm.hp > 0 && mm.hp < mm.maxHp / 2 && powerOf(mm, 'enrage') && !enraged.has(mm.key)) {
      enraged.add(mm.key);
      mm.ac += 2;
      mm.attack += 1;
      if (powerOf(mm, 'breath')) breathReady.add(mm.key);
      after.push({ type: 'power', actor: mm.key, power: 'enrage' });
    }
    return after;
  };

  // Initiative. Rogues strike first: they roll it with advantage. Quick monsters add 5.
  const init = new Map<string, number>();
  const heroInit = rollD20(rng, { rerollOnes, edge: hero.class === 'rogue' ? 'advantage' : 'normal' }).natural;
  init.set('hero', hero.uniques.includes('wardens-longbow') ? 99 : heroInit + mod('dex') + (hero.talents.includes('alert') ? 5 : 0));
  for (const mm of mons) init.set(mm.key, rollD20(rng).natural + abilityModifier(mm.dex) + (powerOf(mm, 'quick') ? 5 : 0));
  const order = [...init.entries()].sort((p, q) => q[1] - p[1]).map(([k]) => k);
  events.push({ type: 'initiative', order });
  if (input.surprise) events.push({ type: 'surprise', side: input.surprise });
  if (input.bomb) {
    const damage = sum(rollDice(rng, input.bomb.dice, input.bomb.sides)) + input.bomb.bonus;
    const after: FightEvent[] = [];
    const targets = mons.map((mm) => {
      const taken = damage * (powerOf(mm, 'swarm') ? 2 : 1);
      after.push(...wound(mm, taken, false));
      return { key: mm.key, damage: taken, hp: mm.hp };
    });
    events.push({ type: 'burst', actor: 'hero', source: 'bomb', targets }, ...after);
    markDefeated();
  }
  if (ward > 0) events.push({ type: 'feature', feature: 'ward', left: ward });
  // Fear comes before the first blow: the most fearsome monster only.
  const dread = alive().find((mm) => powerOf(mm, 'frighten'));
  if (dread) {
    const fear = powerOf(dread, 'frighten')!;
    events.push({ type: 'power', actor: dread.key, power: 'frighten', target: 'hero' });
    if (!heroSave('wis', dcOf(dread, fear.dc))) {
      frightened = fear.rounds;
      events.push({ type: 'status', target: 'hero', status: 'frightened', turns: fear.rounds });
    }
  }
  // Every wail is heard before the first blow; steady nerves (a WIS save) take half.
  for (const mm of alive().filter((x) => powerOf(x, 'wail'))) {
    if (hero.hp <= 0) break;
    const wail = powerOf(mm, 'wail')!;
    const full = Math.round(sum(rollDice(rng, wail.dice[0], wail.dice[1])) * mm.damageFactor);
    const saved = heroSave('wis', dcOf(mm, wail.dc));
    const damage = Math.max(1, saved ? Math.floor(full / 2) : full);
    const after = hurtHero(damage);
    events.push({ type: 'power', actor: mm.key, power: 'wail', target: 'hero', amount: damage, hp: hero.hp }, ...after);
  }

  const heal = (ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal', amount: number) => {
    const gained = Math.max(0, Math.min(hero.maxHp - hero.hp, Math.round(amount)));
    hero.hp += gained;
    events.push({ type: 'heal', actor: 'hero', ability, amount: gained, hp: hero.hp });
  };


  const heroAttack = (at?: MonsterInstance) => {
    const targets = alive();
    if (targets.length === 0) return;
    // A riposte answers its attacker; otherwise a thief running with gold, then whoever is closest to falling.
    const target = (at && at.hp > 0 ? at : null)
      ?? targets.find((mm) => (stolen.get(mm.key) ?? 0) > 0)
      ?? targets.reduce((a, b) => (b.hp < a.hp ? b : a));
    const roll = rollD20(rng, { edge: combine(stance.attackEdge, frightened > 0 ? 'disadvantage' : 'normal'), rerollOnes });
    const total = roll.natural + prof + mod(attackAbility) + stance.toHit;
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
    let after: FightEvent[] = [];
    if (hit) {
      const targetDef = monsterById(target.id);
      if (caster) {
        const [n, sides] = spellDice(hero.class, hero.level)!;
        damage = sum(rollDice(rng, crit ? n * 2 : n, sides)) + mod(cls.primary) * (path('evoker') ? 2 : 1);
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
          // The fight's first hit, or an Assassin's every round, gets the full dice; other rounds a sixth of the level.
          // A master Thief has studied its prey by the fourth round: from then on, a third of the level.
          const full = !openedFight || path('assassin');
          const studied = path('thief', PATH_MASTERY) && currentRound >= THIEF_STUDY_ROUND;
          const sneak = full ? sneakDice(hero.level) : Math.ceil(hero.level / (studied ? 3 : 6));
          damage += sum(rollDice(rng, crit ? sneak * 2 : sneak, 6));
          sneakReady = false;
          openedFight = true;
        }
        // Bones break under blunt weapons, and arrows and points slip between them.
        if (powerOf(target, 'brittle')) {
          const hits = hero.weapon?.base.hits ?? 'bludgeon';
          damage *= hits === 'bludgeon' ? 1.5 : hits === 'pierce' ? 0.75 : 1;
        }
      }
      if (path('war') && !struckThisTurn) damage += sum(rollDice(rng, crit ? 2 : 1, 8));
      struckThisTurn = true;
      damage *= 1 + hero.damagePct / 100;
      damage += heavyHitter;
      if (hero.uniques.includes('oathbreaker') && hero.hp < hero.maxHp / 2) damage *= 1.5;
      if (hero.uniques.includes('dragonbone-blade') && targetDef.kin === 'dragonkin') damage *= 2;
      if (!caster && powerOf(target, 'swarm')) damage *= 0.5;
      damage = Math.max(1, Math.round(damage));
      after = wound(target, damage, crit);
    }
    events.push({ type: 'attack', actor: 'hero', target: target.key, natural: roll.natural, total, hit, crit, damage, targetHp: target.hp, kind: caster ? 'spell' : 'weapon' }, ...after);
    if (hit && crit && hero.uniques.includes('ember-fang') && target.hp > 0) {
      burning.set(target.key, { ...EMBER_BURN });
      events.push({ type: 'status', target: target.key, status: 'burning', turns: EMBER_BURN.turns });
    }
    if (hit && hero.lifeSteal > 0) heal('life-steal', (damage * hero.lifeSteal) / 100);
    if (hit && crit && hero.uniques.includes('wyrmfire')) {
      for (const other of alive()) {
        if (other === target) continue;
        const splash = Math.round(damage / 2);
        const more = wound(other, splash, false);
        events.push({ type: 'attack', actor: 'hero', target: other.key, natural: roll.natural, total, hit: true, crit: false, damage: splash, targetHp: other.hp, kind: 'weapon' }, ...more);
      }
    }
    markDefeated();
  };

  const heroTurn = () => {
    struckThisTurn = false;
    // Abjurer: the ward mends by the INT modifier each turn, never past where it started.
    if (wardMax > 0 && ward < wardMax) {
      ward = Math.min(wardMax, ward + Math.max(1, intMod));
      events.push({ type: 'feature', feature: 'ward', left: ward });
    }
    const low = hero.hp < hero.maxHp * 0.45;
    if (low && secondWind) {
      secondWind = false;
      heal('second-wind', sum(rollDice(rng, 1, 10)) + hero.level);
      return;
    }
    if (low && uses.heals > 0) {
      if (knuckle) knuckle = false;
      else uses.heals--;
      const cure = (sum(rollDice(rng, cureDice(hero.level), 8)) + mod('wis')) * lifeBoost * (1 + hero.healing / 100);
      heal('cure-wounds', cure);
      if (!quickCure) return;
      quickCure = false;
    }
    if (hero.hp < hero.maxHp * 0.3 && potions > 0 && potionsUsed < POTIONS_PER_FIGHT) {
      potions--;
      potionsUsed++;
      heal('potion', potionHealing(rng, hero.maxHp, hero.talents.includes('field-medic')) * lifeBoost * (1 + hero.healing / 100));
      // Thief: Fast hands drink potions without losing the turn.
      if (!path('thief')) return;
    }
    if (stance.escapeBelow > 0 && hero.hp < hero.maxHp * stance.escapeBelow) {
      const roll = check(rng, escapeCheck(hero, alive().length, input.escapeBonus ?? 0));
      events.push({ type: 'escape', natural: roll.roll.natural, total: roll.total, dc: roll.dc, success: roll.success });
      escaped = roll.success;
      return;
    }
    if (hero.class === 'wizard' && uses.spells > 0 && alive().length >= (path('evoker', PATH_MASTERY) ? 1 : 2)) {
      uses.spells--;
      const dice = burstDice(hero.level);
      const empowered = path('evoker') ? 2 * intMod : 0;
      const after: FightEvent[] = [];
      const lone = alive().length === 1 ? 2 : 1;
      const targets = alive().map((mm) => {
        const swarm = powerOf(mm, 'swarm') ? 2 : 1;
        const damage = Math.max(1, Math.round((sum(rollDice(rng, dice, 6)) + empowered) * lone * swarm * (1 + hero.spellPower / 100)));
        after.push(...wound(mm, damage, false));
        return { key: mm.key, damage, hp: mm.hp };
      });
      events.push({ type: 'burst', actor: 'hero', source: 'spell', targets }, ...after);
      markDefeated();
      return;
    }
    const attacks = attacksPerTurn(hero.class, hero.level, hero.path);
    for (let i = 0; i < attacks && alive().length > 0 && hero.hp > 0; i++) heroAttack();
  };

  const monsterAttack = (mm: MonsterInstance) => {
    const pack = powerOf(mm, 'pack') !== null && alive().some((other) => other !== mm);
    const roll = rollD20(rng, { edge: combine(stance.defendEdge, pack ? 'advantage' : 'normal') });
    const total = roll.natural + mm.attack;
    const crit = roll.natural === 20 && !hero.uniques.includes('drowned-crown');
    const hit = roll.natural === 20 || (roll.natural !== 1 && total >= hero.ac);
    if (hit && (aegis || shield)) {
      const by = aegis ? 'aegis' : 'shield';
      if (aegis) aegis = false;
      else shield = false;
      events.push({ type: 'blocked', actor: mm.key, by });
      return;
    }
    let damage = 0;
    let after: FightEvent[] = [];
    if (hit) {
      const [n, sides, plus] = mm.damage;
      damage = Math.max(1, Math.round((sum(rollDice(rng, crit ? n * 2 : n, sides)) + plus) * mm.damageFactor));
      if (dodgeReady) {
        dodgeReady = false;
        damage = Math.max(1, Math.floor(damage / 2));
      }
      after = hurtHero(damage);
    }
    events.push({ type: 'attack', actor: mm.key, target: 'hero', natural: roll.natural, total, hit, crit, damage, targetHp: hero.hp, kind: 'weapon' }, ...after);
    if (!hit) {
      // Guardian: a miss is an opening, once a round.
      if (riposteReady && hero.hp > 0) {
        riposteReady = false;
        heroAttack(mm);
      }
      return;
    }

    if (powerOf(mm, 'drain')) {
      const gained = Math.min(mm.maxHp - mm.hp, Math.floor(damage / 2));
      if (gained > 0) {
        mm.hp += gained;
        events.push({ type: 'power', actor: mm.key, power: 'drain', amount: gained, hp: mm.hp });
      }
    }
    const thief = powerOf(mm, 'thief');
    if (thief && goldLeft > 0 && !stolen.has(mm.key)) {
      const amount = Math.min(goldLeft, sum(rollDice(rng, 2, 10)) * (mm.depth + 1));
      goldLeft -= amount;
      stolen.set(mm.key, amount);
      events.push({ type: 'power', actor: mm.key, power: 'thief', target: 'hero', amount });
    }
    if (hero.hp <= 0) return;
    const burn = powerOf(mm, 'burn');
    if (burn) {
      burning.set('hero', { turns: burn.turns, dice: burn.dice });
      events.push({ type: 'status', target: 'hero', status: 'burning', turns: burn.turns });
    }
    const paralyze = powerOf(mm, 'paralyze');
    if (paralyze && held === 0 && !heroSave('con', dcOf(mm, paralyze.dc))) {
      held = 1;
      events.push({ type: 'status', target: 'hero', status: 'paralyzed', turns: 1 });
    }
    const poison = powerOf(mm, 'poison');
    if (poison && poisoned.turns === 0 && !heroSave('con', dcOf(mm, poison.dc))) {
      poisoned.turns = poison.turns;
      poisoned.dice = poison.dice;
      events.push({ type: 'status', target: 'hero', status: 'poisoned', turns: poison.turns });
    }
  };

  const monsterTurn = (mm: MonsterInstance) => {
    // A thief that got its hands on gold runs with it.
    if (stolen.has(mm.key)) {
      fled.add(mm.key);
      events.push({ type: 'fled', key: mm.key });
      return;
    }
    const mend = powerOf(mm, 'mend');
    if (mend && !mended.has(mm.key)) {
      const hurt = alive().filter((other) => other !== mm && other.hp < other.maxHp / 2).sort((a, b) => a.hp - b.hp)[0];
      if (hurt) {
        mended.add(mm.key);
        const gained = Math.min(hurt.maxHp - hurt.hp, sum(rollDice(rng, mend.dice[0], mend.dice[1])) + mm.depth);
        hurt.hp += gained;
        events.push({ type: 'power', actor: mm.key, power: 'mend', target: hurt.key, amount: gained, hp: hurt.hp });
        return;
      }
    }
    const breath = powerOf(mm, 'breath');
    if (breath) {
      if (!breathReady.has(mm.key) && rollDice(rng, 1, 6)[0]! >= 5) breathReady.add(mm.key);
      if (breathReady.has(mm.key)) {
        breathReady.delete(mm.key);
        const full = Math.round(sum(rollDice(rng, breath.dice[0], breath.dice[1])) * mm.damageFactor * (fireproof ? 0.5 : 1));
        const saved = heroSave('dex', dcOf(mm, breath.dc));
        const damage = Math.max(1, saved ? Math.floor(full / 2) : full);
        const after = hurtHero(damage);
        events.push({ type: 'power', actor: mm.key, power: 'breath', target: 'hero', amount: damage, hp: hero.hp }, ...after);
        return;
      }
    }
    const attacks = powerOf(mm, 'multiattack')?.attacks ?? 1;
    for (let i = 0; i < attacks && hero.hp > 0; i++) monsterAttack(mm);
  };

  /** Burning bites at the start of a turn; returns whether the fighter can still act. */
  const startTurn = (key: string): boolean => {
    const fire = burning.get(key);
    if (fire && fire.turns > 0) {
      fire.turns--;
      const rolled = sum(rollDice(rng, fire.dice[0], fire.dice[1]));
      const damage = key === 'hero' && fireproof ? Math.max(1, Math.floor(rolled / 2)) : rolled;
      if (key === 'hero') {
        const after = hurtHero(damage);
        events.push({ type: 'tick', target: 'hero', damage, hp: hero.hp }, ...after);
        if (hero.hp <= 0) return false;
      } else {
        const mm = mons.find((x) => x.key === key)!;
        const after = wound(mm, damage, false);
        events.push({ type: 'tick', target: key, damage, hp: mm.hp }, ...after);
        markDefeated();
        if (mm.hp <= 0) return false;
      }
      if (fire.turns === 0) events.push({ type: 'expire', target: key, status: 'burning' });
    }
    if (key === 'hero' && poisoned.turns > 0) {
      poisoned.turns--;
      const damage = sum(rollDice(rng, poisoned.dice[0], poisoned.dice[1]));
      const after = hurtHero(damage);
      events.push({ type: 'tick', target: 'hero', damage, hp: hero.hp, status: 'poisoned' }, ...after);
      if (hero.hp <= 0) return false;
      if (poisoned.turns === 0) events.push({ type: 'expire', target: 'hero', status: 'poisoned' });
    }
    if (key === 'hero' && held > 0) {
      held--;
      events.push({ type: 'held', target: 'hero' });
      if (held === 0) events.push({ type: 'expire', target: 'hero', status: 'paralyzed' });
      return false;
    }
    // Champion, Survivor: a little health back each turn while below half.
    if (key === 'hero' && path('champion', PATH_MASTERY) && hero.hp > 0 && hero.hp < hero.maxHp / 2) {
      const gained = Math.min(hero.maxHp - hero.hp, 2 + mod('con'));
      if (gained > 0) {
        hero.hp += gained;
        events.push({ type: 'feature', feature: 'survivor', amount: gained, hp: hero.hp });
      }
    }
    return true;
  };

  /** 3 successes (10+) or 3 failures; a natural 20 stands up, a natural 1 counts twice. */
  const deathSaves = (): 'rise' | 'survived' | 'dead' => {
    events.push({ type: 'down' });
    burning.delete('hero');
    poisoned.turns = 0;
    held = 0;
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
  /** A Trivial fight's promise: the Hero goes down and is left for dead, with 1 health. */
  const spared = (): 'survived' => {
    events.push({ type: 'down' });
    burning.delete('hero');
    poisoned.turns = 0;
    held = 0;
    hero.hp = 1;
    return 'survived';
  };

  let outcome: FightOutcome | null = alive().length === 0 ? 'victory' : null;
  for (let round = 1; round <= ROUND_LIMIT && outcome === null; round++) {
    currentRound = round;
    dodgeReady = dodges;
    riposteReady = path('guardian');
    // Rogues find another opening each round.
    if (hero.class === 'rogue') sneakReady = true;
    for (const key of order) {
      if (outcome !== null) break;
      // Whoever was surprised stands still for the first round.
      if (round === 1 && input.surprise === (key === 'hero' ? 'hero' : 'monsters')) continue;
      if (key === 'hero') {
        if (hero.hp > 0 && startTurn('hero')) heroTurn();
      } else {
        const mm = mons.find((x) => x.key === key)!;
        if (mm.hp > 0 && !fled.has(mm.key) && startTurn(mm.key)) monsterTurn(mm);
      }
      if (escaped) outcome = 'escaped';
      else {
        if (hero.hp <= 0) {
          const save = input.spare ? spared() : deathSaves();
          if (save !== 'rise') outcome = save;
        }
        if (outcome === null && alive().length === 0) outcome = 'victory';
      }
    }
    if (frightened > 0) {
      frightened--;
      if (frightened === 0 && outcome === null) events.push({ type: 'expire', target: 'hero', status: 'frightened' });
    }
  }
  // A fight that runs out of rounds ends with the Hero pulling back, alive.
  outcome ??= 'survived';
  events.push({ type: 'end', outcome });

  const xp = mons.filter((mm) => defeated.includes(mm.key)).reduce((s, mm) => s + mm.xp, 0);
  const goldStolen = [...stolen.entries()].filter(([key]) => fled.has(key)).reduce((s, [, amount]) => s + amount, 0);
  return { events, outcome, hp: outcome === 'dead' ? 0 : hero.hp, uses, potionsUsed, xp, defeated, runPowers, goldStolen };
}

// ─── Before and around the fight ──────────────────────────────────────────

/** A Fire bomb (v0): 2d6 + 2 per Floor to every monster, before the first round. */
export const fireBomb = (floor: number) => ({ dice: 2, sides: 6, bonus: 2 * floor });

const escapeBonus = (hero: HeroCombat) =>
  abilityModifier(hero.scores.dex) + (hero.class === 'rogue' ? proficiencyBonus(hero.level) : 0) + Math.floor(hero.escape / 5)
  + (hero.talents.includes('light-step') ? 2 : 0) + (onPath(hero, 'thief', PATH_MASTERY) ? 5 : 0);

/** An Escape roll's difficulty (v0): the more monsters still standing, the harder. */
export const escapeDc = (monsters: number): number => 8 + 2 * monsters;

/** A DEX Check to get out of a fight. Rogues roll with advantage and add their proficiency. */
export function escapeCheck(hero: HeroCombat, monsters: number, bonus = 0): CheckInput {
  return {
    modifier: escapeBonus(hero) + bonus,
    dc: escapeDc(monsters),
    edge: hero.class === 'rogue' ? 'advantage' : 'normal',
    rerollOnes: RACE_DEFS[hero.race].rerollOnes,
  };
}

/** Sneaking past a Room's monsters (v0): harder deeper down and with more of them. */
export const sneakDc = (floor: number, monsters: number): number => 10 + Math.floor(floor / 2) + 2 * (monsters - 1);

/**
 * The DEX Check to Sneak past. Rogues roll with advantage and add their
 * proficiency; heavy armor gives disadvantage; escape Bonus stats help.
 */
export function sneakCheck(hero: HeroCombat, floor: number, monsters: number, bonus = 0): CheckInput {
  return {
    modifier: escapeBonus(hero) + bonus,
    dc: sneakDc(floor, monsters),
    edge: hero.heavyArmor && !hero.talents.includes('light-step') ? 'disadvantage' : hero.class === 'rogue' ? 'advantage' : 'normal',
    rerollOnes: RACE_DEFS[hero.race].rerollOnes,
  };
}

export const THREATS = ['trivial', 'easy', 'risky', 'dangerous', 'deadly'] as const;
export type ThreatId = (typeof THREATS)[number];

export interface FightOdds {
  win: number;
  death: number;
}

/** How many times the server plays a fight over to rate its Threat. */
export const THREAT_SAMPLES = 60;

/**
 * Plays the fight over many times, each on its own seed and never the real
 * one, to see how it tends to go for this Hero as it stands.
 */
export function fightOdds(seed: string, input: FightInput, samples = THREAT_SAMPLES): FightOdds {
  let win = 0;
  let death = 0;
  for (let i = 0; i < samples; i++) {
    const { outcome } = simulateFight(createRng(`${seed}:${i}`), input);
    if (outcome === 'victory') win++;
    else if (outcome === 'dead') death++;
  }
  return { win: win / samples, death: death / samples };
}

/** The Threat a Player sees on a Door's other side (v0 thresholds). */
export function threatOf({ win, death }: FightOdds): ThreatId {
  if (death >= 0.35) return 'deadly';
  if (death >= 0.15 || win < 0.5) return 'dangerous';
  if (death >= 0.05 || win < 0.8) return 'risky';
  if (death > 0 || win < 0.97) return 'easy';
  return 'trivial';
}
