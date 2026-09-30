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
  ARCHERY_BONUS, MARK_DICE, type RestUses, UNCANNY_DODGE_LEVEL, attacksPerTurn, burstDice, cureDice, proficiencyBonus, rageDamage, sneakDice,
  spellDice,
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
  | { type: 'blocked'; actor: string; by: 'aegis' | 'shield'; target?: string }
  | { type: 'burst'; actor: string; source: 'spell' | 'bomb'; targets: { key: string; damage: number; hp: number }[] }
  /** `actor` is who is healed; `by` the other Hero when a Cleric mends its partner. */
  | { type: 'heal'; actor: string; ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal'; amount: number; hp: number; by?: string }
  /**
   * A Hero's Class or Path at work: `survivor` heals `amount` to `hp`; `indomitable` and
   * `relentless` keep it standing at `hp` 1; `ward` is raised (`left`) or soaks `amount`
   * of a hit (`left` after); `rage` begins a Barbarian's Rage; `mark` puts a Ranger's
   * Hunter's mark on the monster `target`.
   */
  | { type: 'feature'; feature: 'survivor' | 'indomitable' | 'ward' | 'rage' | 'mark' | 'relentless'; amount?: number; hp?: number; left?: number; target?: string; actor?: string }
  /**
   * A monster's power at work. `amount` is gold stolen (thief), health restored
   * (mend, drain) or damage dealt (breath, explode, wail); `hp` is the target's health after it.
   */
  | { type: 'power'; actor: string; power: MonsterPowerId; target?: string; amount?: number; hp?: number }
  /** A saving throw the Hero makes against a monster's power. */
  | { type: 'save'; ability: Ability; natural: number; total: number; dc: number; success: boolean; actor?: string }
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
  | { type: 'down'; actor?: string }
  | { type: 'death-save'; natural: number; successes: number; failures: number; actor?: string }
  | { type: 'rise'; hp: number; actor?: string }
  /** Lucky charm or Luckstone: a failed death save's d20 (`natural`) is rolled again, keeping the better. */
  | { type: 'reroll'; natural: number; actor?: string }
  /** An Escape roll, made by Stance when the Hero is badly hurt. */
  | { type: 'escape'; natural: number; total: number; dc: number; success: boolean; actor?: string }
  | { type: 'end'; outcome: FightOutcome };

/** Which Hero an event is about: the one whose fight it is, or its Duo partner. */
export type HeroKey = 'hero' | 'ally';

/** A Duo partner fighting alongside: its own fighter, uses, potions, Run powers, Stance and carried gold. */
export interface AllyInput {
  hero: HeroCombat;
  uses: RestUses;
  potions: number;
  runPowers: { deathless: boolean; lucky: boolean };
  stance?: StanceId;
  gold?: number;
}

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
  /**
   * A Duo partner fighting alongside (docs/design.md → Duos). Monsters pick either Hero;
   * breath, blasts, wails and fear reach both; nobody runs alone, and nobody is spared.
   */
  ally?: AllyInput | null;
}

/** How the fight went for one Hero. */
export interface SideResult {
  outcome: FightOutcome;
  hp: number;
  uses: RestUses;
  potionsUsed: number;
  runPowers: { deathless: boolean; lucky: boolean };
  /** Carried gold that ran off with a thief. */
  goldStolen: number;
}

export interface FightResult extends SideResult {
  events: FightEvent[];
  xp: number;
  defeated: string[];
  /** The Duo partner's side of it, when there was one. */
  ally: SideResult | null;
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
  const mons = input.monsters.map((mm) => ({ ...mm }));
  const events: FightEvent[] = [];
  const defeated: string[] = [];
  const fled = new Set<string>();
  /** A Duo fights side by side: no one runs alone, and nobody is spared a fall. */
  const duo = Boolean(input.ally);
  /** The round being fought, for features that grow as a fight drags on. */
  let currentRound = 0;

  /** One Hero's side of the fight: its fighter, its uses, and everything its Class and Path keep track of. */
  const makeSide = (key: HeroKey, from: { hero: HeroCombat; uses: RestUses; potions: number; runPowers: { deathless: boolean; lucky: boolean }; stance?: StanceId; gold?: number }) => {
    const stance = STANCE_DEFS[from.stance ?? DEFAULT_STANCE];
    const c = { ...from.hero, ac: from.hero.ac + stance.ac };
    const path = (id: PathId, level?: typeof PATH_MASTERY) => onPath(c, id, level);
    const cls = CLASS_DEFS[c.class];
    const caster = c.class === 'wizard' || c.class === 'cleric';
    const intMod = abilityModifier(c.scores.int);
    const ward = path('abjurer') ? 4 * c.level + intMod : 0;
    const champion = path('champion') ? 1 : 0;
    return {
      key, c, stance, path, cls, caster, intMod,
      uses: { ...from.uses },
      runPowers: { ...from.runPowers },
      potions: from.potions,
      potionsUsed: 0,
      goldLeft: from.gold ?? 0,
      secondWind: c.class === 'fighter',
      sneakReady: c.class === 'rogue',
      openedFight: false,
      firstHitCrit: c.uniques.includes('gravewhisper') || path('assassin', PATH_MASTERY),
      riposteReady: false,
      /** War, Divine strike: once per turn. */
      struckThisTurn: false,
      indomitable: path('guardian', PATH_MASTERY),
      ward,
      wardMax: ward,
      fireproof: c.talents.includes('fireproof'),
      heavyHitter: c.talents.includes('heavy-hitter') ? 2 : 0,
      /** Life: potions and Cure wounds heal half again as much. */
      lifeBoost: path('life') ? 1.5 : 1,
      /** Life, Preserve life: the first Cure wounds of a fight doesn't cost the turn. */
      quickCure: path('life', PATH_MASTERY),
      aegis: c.uniques.includes('ashen-aegis'),
      /** Wizard, Shield: the first blow of each fight that would land is turned aside. */
      shield: c.class === 'wizard',
      /** The Last Ember: once per fight a missed spell hits for double. */
      lastEmber: c.uniques.includes('last-ember'),
      /** Saint's Knuckle: the first Cure wounds of a fight gives its use back. */
      knuckle: c.uniques.includes('saints-knuckle'),
      /** Rogue Uncanny dodge (from level 3, v0): the first hit each round deals half damage. */
      dodges: c.class === 'rogue' && c.level >= UNCANNY_DODGE_LEVEL,
      dodgeReady: c.class === 'rogue' && c.level >= UNCANNY_DODGE_LEVEL,
      /** Barbarian: in a Rage for the rest of the fight. */
      raging: false,
      /** Bear-heart, Relentless: the CON save that keeps a raging Hero up grows harder each time. */
      relentlessDc: 10,
      /** Ranger: the monster under the Hunter's mark. */
      marked: null as string | null,
      /** Hunter, Colossus slayer: once per turn. */
      slewThisTurn: false,
      rerollOnes: RACE_DEFS[c.race].rerollOnes,
      mod: (a: Ability) => abilityModifier(c.scores[a]),
      prof: proficiencyBonus(c.level),
      attackAbility: (caster ? cls.primary
        : c.weapon?.base.weapon === 'bow' || c.class === 'rogue' || c.class === 'ranger' ? 'dex' : 'str') as Ability,
      /** Ranger, Archery. */
      archery: c.class === 'ranger' && c.weapon?.base.weapon === 'bow' ? ARCHERY_BONUS : 0,
      critFrom: Math.max(18 - champion, 20 - Math.floor(c.critChance / 5) - champion),
      proficientSaves: new Set<Ability>([...cls.saves, ...(c.talents.includes('iron-will') ? (['con', 'wis'] as const) : [])]),
      /** Only Heroes are ever poisoned. */
      poisoned: { turns: 0, dice: [1, 4] as [number, number] },
      held: 0,
      frightened: 0,
      escaped: false,
      /** Out of the fight: fell and made its death saves one way or the other, or ran. */
      out: null as FightOutcome | null,
    };
  };
  type Side = ReturnType<typeof makeSide>;
  const hero = makeSide('hero', input);
  const sides: Side[] = input.ally ? [hero, makeSide('ally', input.ally)] : [hero];
  const sideOf = (key: string) => sides.find((s) => s.key === key);
  /** The ally's lines name it; the Hero's stay as they always were. */
  const tag = (s: Side) => (s.key === 'hero' ? {} : { actor: s.key });
  const standing = () => sides.filter((s) => s.out === null && s.c.hp > 0);

  // What lasts between turns.
  const burning = new Map<string, { turns: number; dice: [number, number] }>();
  /** A thief that got its hands on gold, and whose it was. */
  const stolen = new Map<string, { amount: number; from: HeroKey }>();
  const breathReady = new Set(mons.filter((mm) => powerOf(mm, 'breath')).map((mm) => mm.key));
  const mended = new Set<string>();
  const stoodUp = new Set<string>();
  const enraged = new Set<string>();

  const alive = () => mons.filter((mm) => mm.hp > 0 && !fled.has(mm.key));
  /** The monster a Hunter's mark goes to: the one with the most health left. */
  const toughest = () => alive().reduce<MonsterInstance | null>((a, b) => (a === null || b.hp > a.hp ? b : a), null);
  /** A fight worth a Rage or a Hunter's mark: two or more monsters, an elite, a Mini-boss or the Boss. */
  const hardFight = () => alive().length >= 2 || alive().some((mm) => mm.elite !== null || monsterById(mm.id).role === 'miniboss' || monsterById(mm.id).role === 'boss');
  /** Who a monster goes for: the one Hero left standing, or either of two. */
  const pickTarget = (): Side | null => {
    const up = standing();
    if (up.length <= 1) return up[0] ?? null;
    return up[rng.int(0, up.length - 1)]!;
  };
  const markDefeated = () => {
    for (const mm of mons) {
      if (mm.hp <= 0 && !defeated.includes(mm.key)) {
        defeated.push(mm.key);
        stolen.delete(mm.key);
        events.push({ type: 'defeated', key: mm.key });
        // The Hunter's mark moves on to the next quarry.
        for (const s of sides) {
          if (s.marked !== mm.key) continue;
          s.marked = toughest()?.key ?? null;
          if (s.marked) events.push({ type: 'feature', feature: 'mark', target: s.marked, ...tag(s) });
        }
        // A sapper's bomb goes off as it falls, on every Hero still standing.
        const blast = powerOf(mm, 'explode');
        if (blast && standing().length > 0) {
          const rolled = sum(rollDice(rng, blast.dice[0], blast.dice[1]));
          for (const s of standing()) {
            const full = Math.round(rolled * mm.damageFactor * (s.fireproof ? 0.5 : 1));
            const saved = heroSave(s, 'dex', dcOf(mm, blast.dc));
            const damage = soften(s, dodgeBlast(s, full, saved), false);
            const after = hurtHero(s, damage);
            events.push({ type: 'power', actor: mm.key, power: 'explode', target: s.key, amount: damage, hp: s.c.hp }, ...after);
          }
        }
      }
    }
  };
  const heroSave = (s: Side, ability: Ability, dc: number) => {
    const result = check(rng, {
      modifier: s.mod(ability) + (s.proficientSaves.has(ability) ? s.prof : 0), dc, rerollOnes: s.rerollOnes,
      // Spell resistance, or a Barbarian's Danger sense against what it can see coming.
      edge: s.path('abjurer', PATH_MASTERY) || (s.c.class === 'barbarian' && ability === 'dex') ? 'advantage' : 'normal',
    });
    events.push({ type: 'save', ability, natural: result.roll.natural, total: result.total, dc, success: result.success, ...tag(s) });
    return result.success;
  };
  const dcOf = (mm: MonsterInstance, dc: number) => dc + Math.floor(mm.depth / 2);
  /** A Rage takes its edge off every blow; a Bear-heart's Thick hide twice that, and the edge off every other harm too. */
  const soften = (s: Side, damage: number, blow: boolean): number => {
    if (!s.raging || !(blow || s.path('bearheart'))) return damage;
    return Math.max(1, damage - rageDamage(s.c.level) * (blow && s.path('bearheart') ? 2 : 1));
  };
  /** A DEX save against breath or a blast: half on a success, or with Evasion none, and half on a failure. */
  const dodgeBlast = (s: Side, full: number, saved: boolean): number =>
    s.path('stalker', PATH_MASTERY) ? (saved ? 0 : Math.floor(full / 2)) : Math.max(1, saved ? Math.floor(full / 2) : full);
  /**
   * Damage to a Hero: the Abjurer's ward soaks it first; Indomitable, Relentless or
   * Deathless Mail may keep it standing. Returns the events to add after the blow itself.
   */
  const hurtHero = (s: Side, damage: number): FightEvent[] => {
    const after: FightEvent[] = [];
    if (s.ward > 0 && damage > 0) {
      const soaked = Math.min(s.ward, damage);
      s.ward -= soaked;
      damage -= soaked;
      after.push({ type: 'feature', feature: 'ward', amount: soaked, left: s.ward, ...tag(s) });
    }
    s.c.hp = Math.max(0, s.c.hp - damage);
    if (s.c.hp === 0 && s.indomitable) {
      s.indomitable = false;
      s.c.hp = 1;
      after.push({ type: 'feature', feature: 'indomitable', hp: 1, ...tag(s) });
    }
    if (s.c.hp === 0 && s.raging && s.path('bearheart', PATH_MASTERY)) {
      const dc = s.relentlessDc;
      s.relentlessDc += 5;
      const save = check(rng, { modifier: s.mod('con') + (s.proficientSaves.has('con') ? s.prof : 0), dc, rerollOnes: s.rerollOnes });
      after.push({ type: 'save', ability: 'con', natural: save.roll.natural, total: save.total, dc, success: save.success, ...tag(s) });
      if (save.success) {
        s.c.hp = 1;
        after.push({ type: 'feature', feature: 'relentless', hp: 1, ...tag(s) });
      }
    }
    if (s.c.hp === 0 && s.runPowers.deathless && s.c.uniques.includes('deathless-mail')) {
      s.runPowers.deathless = false;
      s.c.hp = 1;
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
  for (const s of sides) {
    const natural = rollD20(rng, { rerollOnes: s.rerollOnes, edge: s.c.class === 'rogue' ? 'advantage' : 'normal' }).natural;
    init.set(s.key, s.c.uniques.includes('wardens-longbow') ? 99 : natural + s.mod('dex') + (s.c.talents.includes('alert') ? 5 : 0));
  }
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
  for (const s of sides) if (s.ward > 0) events.push({ type: 'feature', feature: 'ward', left: s.ward, ...tag(s) });
  // Fear comes before the first blow: the most fearsome monster only, on every Hero.
  const dread = alive().find((mm) => powerOf(mm, 'frighten'));
  if (dread) {
    const fear = powerOf(dread, 'frighten')!;
    for (const s of sides) {
      events.push({ type: 'power', actor: dread.key, power: 'frighten', target: s.key });
      if (!heroSave(s, 'wis', dcOf(dread, fear.dc))) {
        s.frightened = fear.rounds;
        events.push({ type: 'status', target: s.key, status: 'frightened', turns: fear.rounds });
      }
    }
  }
  // Every wail is heard before the first blow; steady nerves (a WIS save) take half.
  for (const mm of alive().filter((x) => powerOf(x, 'wail'))) {
    if (standing().length === 0) break;
    const wail = powerOf(mm, 'wail')!;
    const rolled = sum(rollDice(rng, wail.dice[0], wail.dice[1]));
    for (const s of standing()) {
      const full = Math.round(rolled * mm.damageFactor);
      const saved = heroSave(s, 'wis', dcOf(mm, wail.dc));
      const damage = soften(s, Math.max(1, saved ? Math.floor(full / 2) : full), false);
      const after = hurtHero(s, damage);
      events.push({ type: 'power', actor: mm.key, power: 'wail', target: s.key, amount: damage, hp: s.c.hp }, ...after);
    }
  }

  /** Healing on `to` (the healer's own side unless it mends its partner). */
  const heal = (to: Side, ability: 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal', amount: number, by?: Side) => {
    const gained = Math.max(0, Math.min(to.c.maxHp - to.c.hp, Math.round(amount)));
    to.c.hp += gained;
    events.push({ type: 'heal', actor: to.key, ability, amount: gained, hp: to.c.hp, ...(by && by !== to ? { by: by.key } : {}) });
  };

  const heroAttack = (s: Side, at?: MonsterInstance) => {
    const targets = alive();
    if (targets.length === 0) return;
    const { c } = s;
    // A riposte answers its attacker; otherwise a thief running with gold, a Ranger's quarry, then whoever is closest to falling.
    const target = (at && at.hp > 0 ? at : null)
      ?? targets.find((mm) => (stolen.get(mm.key)?.amount ?? 0) > 0)
      ?? targets.find((mm) => mm.key === s.marked)
      ?? targets.reduce((a, b) => (b.hp < a.hp ? b : a));
    const ambush = currentRound === 1 && s.path('stalker');
    const edge = combine(combine(s.stance.attackEdge, s.frightened > 0 ? 'disadvantage' : 'normal'), ambush ? 'advantage' : 'normal');
    const roll = rollD20(rng, { edge, rerollOnes: s.rerollOnes });
    const total = roll.natural + s.prof + s.mod(s.attackAbility) + s.stance.toHit + s.archery;
    let crit = roll.natural >= s.critFrom;
    let hit = crit || (roll.natural !== 1 && total >= target.ac);
    const ember = !hit && s.caster && s.lastEmber;
    if (ember) {
      s.lastEmber = false;
      hit = true;
    }
    if (hit && s.firstHitCrit) {
      crit = true;
      s.firstHitCrit = false;
    }
    let damage = 0;
    let after: FightEvent[] = [];
    if (hit) {
      const targetDef = monsterById(target.id);
      if (s.caster) {
        const [n, sides_] = spellDice(c.class, c.level)!;
        damage = sum(rollDice(rng, crit ? n * 2 : n, sides_)) + s.mod(s.cls.primary) * (s.path('evoker') ? 2 : 1);
        damage *= 1 + c.spellPower / 100;
        if (c.class === 'cleric' && targetDef.kin === 'undead') damage *= 2;
        if (c.uniques.includes('lantern-of-the-deep') && (targetDef.kin === 'undead' || targetDef.kin === 'demon')) damage *= 1.25;
        if (ember) damage *= 2;
      } else {
        const [n, sides_] = c.weapon?.base.damage ?? [1, 4];
        const once = () => sum(rollDice(rng, crit ? n * 2 : n, sides_));
        let dice = once();
        if (c.talents.includes('savage-attacker')) dice = Math.max(dice, once());
        damage = dice * (c.weapon?.factor ?? 1) + s.mod(s.attackAbility);
        if (s.sneakReady) {
          // The fight's first hit, or an Assassin's every round, gets the full dice; other rounds a sixth of the level.
          // A master Thief has studied its prey by the fourth round: from then on, a third of the level.
          const full = !s.openedFight || s.path('assassin');
          const studied = s.path('thief', PATH_MASTERY) && currentRound >= THIEF_STUDY_ROUND;
          const sneak = full ? sneakDice(c.level) : Math.ceil(c.level / (studied ? 3 : 6));
          damage += sum(rollDice(rng, crit ? sneak * 2 : sneak, 6));
          s.sneakReady = false;
          s.openedFight = true;
        }
        // Bones break under blunt weapons, and arrows and points slip between them.
        if (powerOf(target, 'brittle')) {
          const hits = c.weapon?.base.hits ?? 'bludgeon';
          damage *= hits === 'bludgeon' ? 1.5 : hits === 'pierce' ? 0.75 : 1;
        }
      }
      if (s.path('war') && !s.struckThisTurn) damage += sum(rollDice(rng, crit ? 2 : 1, 8));
      s.struckThisTurn = true;
      if (s.raging) damage += rageDamage(c.level);
      if (s.marked === target.key) damage += sum(rollDice(rng, crit ? MARK_DICE[0] * 2 : MARK_DICE[0], MARK_DICE[1]));
      if (s.path('hunter') && !s.slewThisTurn && target.hp < target.maxHp) {
        s.slewThisTurn = true;
        damage += sum(rollDice(rng, crit ? 2 : 1, 8));
      }
      damage *= 1 + c.damagePct / 100;
      damage += s.heavyHitter;
      if (c.uniques.includes('oathbreaker') && c.hp < c.maxHp / 2) damage *= 1.5;
      if (c.uniques.includes('dragonbone-blade') && targetDef.kin === 'dragonkin') damage *= 2;
      if (!s.caster && powerOf(target, 'swarm')) damage *= 0.5;
      damage = Math.max(1, Math.round(damage));
      after = wound(target, damage, crit);
    }
    events.push({ type: 'attack', actor: s.key, target: target.key, natural: roll.natural, total, hit, crit, damage, targetHp: target.hp, kind: s.caster ? 'spell' : 'weapon' }, ...after);
    if (hit && crit && c.uniques.includes('ember-fang') && target.hp > 0) {
      burning.set(target.key, { ...EMBER_BURN });
      events.push({ type: 'status', target: target.key, status: 'burning', turns: EMBER_BURN.turns });
    }
    if (hit && c.lifeSteal > 0) heal(s, 'life-steal', (damage * c.lifeSteal) / 100);
    if (hit && crit && c.uniques.includes('wyrmfire')) {
      for (const other of alive()) {
        if (other === target) continue;
        const splash = Math.round(damage / 2);
        const more = wound(other, splash, false);
        events.push({ type: 'attack', actor: s.key, target: other.key, natural: roll.natural, total, hit: true, crit: false, damage: splash, targetHp: other.hp, kind: 'weapon' }, ...more);
      }
    }
    markDefeated();
  };

  const heroTurn = (s: Side) => {
    const { c } = s;
    s.struckThisTurn = false;
    s.slewThisTurn = false;
    // A Rage and a Hunter's mark cost no turn: when a fight turns hard (or a Barbarian is hurt), while uses last.
    if (c.class === 'barbarian' && !s.raging && s.uses.spells > 0 && (hardFight() || c.hp < c.maxHp / 2)) {
      s.uses.spells--;
      s.raging = true;
      events.push({ type: 'feature', feature: 'rage', ...tag(s) });
      // Mindless rage burns fear away.
      if (s.path('berserker', PATH_MASTERY) && s.frightened > 0) {
        s.frightened = 0;
        events.push({ type: 'expire', target: s.key, status: 'frightened' });
      }
    }
    if (c.class === 'ranger' && s.marked === null && s.uses.spells > 0 && hardFight()) {
      s.uses.spells--;
      s.marked = toughest()?.key ?? null;
      if (s.marked) events.push({ type: 'feature', feature: 'mark', target: s.marked, ...tag(s) });
    }
    // Abjurer: the ward mends by the INT modifier each turn, never past where it started.
    if (s.wardMax > 0 && s.ward < s.wardMax) {
      s.ward = Math.min(s.wardMax, s.ward + Math.max(1, s.intMod));
      events.push({ type: 'feature', feature: 'ward', left: s.ward, ...tag(s) });
    }
    const low = c.hp < c.maxHp * 0.45;
    if (low && s.secondWind) {
      s.secondWind = false;
      heal(s, 'second-wind', sum(rollDice(rng, 1, 10)) + c.level);
      return;
    }
    // Cure wounds goes to whichever Hero is hurt worst, below 45% health.
    const patient = standing().filter((x) => x.c.hp < x.c.maxHp * 0.45).sort((a, b) => a.c.hp / a.c.maxHp - b.c.hp / b.c.maxHp)[0];
    if (patient && s.uses.heals > 0) {
      if (s.knuckle) s.knuckle = false;
      else s.uses.heals--;
      const cure = (sum(rollDice(rng, cureDice(c.level), 8)) + s.mod('wis')) * s.lifeBoost * (1 + c.healing / 100);
      heal(patient, 'cure-wounds', cure, s);
      if (!s.quickCure) return;
      s.quickCure = false;
    }
    if (c.hp < c.maxHp * 0.3 && s.potions > 0 && s.potionsUsed < POTIONS_PER_FIGHT) {
      s.potions--;
      s.potionsUsed++;
      heal(s, 'potion', potionHealing(rng, c.maxHp, c.talents.includes('field-medic')) * s.lifeBoost * (1 + c.healing / 100));
      // Thief: Fast hands drink potions without losing the turn.
      if (!s.path('thief')) return;
    }
    if (!duo && s.stance.escapeBelow > 0 && c.hp < c.maxHp * s.stance.escapeBelow) {
      const roll = check(rng, escapeCheck(c, alive().length, input.escapeBonus ?? 0));
      events.push({ type: 'escape', natural: roll.roll.natural, total: roll.total, dc: roll.dc, success: roll.success, ...tag(s) });
      s.escaped = roll.success;
      return;
    }
    if (c.class === 'wizard' && s.uses.spells > 0 && alive().length >= (s.path('evoker', PATH_MASTERY) ? 1 : 2)) {
      s.uses.spells--;
      const dice = burstDice(c.level);
      const empowered = s.path('evoker') ? 2 * s.intMod : 0;
      const after: FightEvent[] = [];
      const lone = alive().length === 1 ? 2 : 1;
      const targets = alive().map((mm) => {
        const swarm = powerOf(mm, 'swarm') ? 2 : 1;
        const damage = Math.max(1, Math.round((sum(rollDice(rng, dice, 6)) + empowered) * lone * swarm * (1 + c.spellPower / 100)));
        after.push(...wound(mm, damage, false));
        return { key: mm.key, damage, hp: mm.hp };
      });
      events.push({ type: 'burst', actor: s.key, source: 'spell', targets }, ...after);
      markDefeated();
      return;
    }
    const attacks = attacksPerTurn(c.class, c.level, c.path)
      + (s.raging && s.path('berserker') ? 1 : 0)
      + (s.path('hunter', PATH_MASTERY) ? 1 : 0)
      + (currentRound === 1 && s.path('stalker') ? 1 : 0);
    for (let i = 0; i < attacks && alive().length > 0 && c.hp > 0; i++) heroAttack(s);
  };

  const monsterAttack = (mm: MonsterInstance, s: Side) => {
    const pack = powerOf(mm, 'pack') !== null && alive().some((other) => other !== mm);
    const roll = rollD20(rng, { edge: combine(s.stance.defendEdge, pack ? 'advantage' : 'normal') });
    const total = roll.natural + mm.attack;
    const crit = roll.natural === 20 && !s.c.uniques.includes('drowned-crown');
    const hit = roll.natural === 20 || (roll.natural !== 1 && total >= s.c.ac);
    if (hit && (s.aegis || s.shield)) {
      const by = s.aegis ? 'aegis' : 'shield';
      if (s.aegis) s.aegis = false;
      else s.shield = false;
      events.push({ type: 'blocked', actor: mm.key, by, ...(s.key === 'hero' ? {} : { target: s.key }) });
      return;
    }
    let damage = 0;
    let after: FightEvent[] = [];
    if (hit) {
      const [n, sides_, plus] = mm.damage;
      damage = soften(s, Math.max(1, Math.round((sum(rollDice(rng, crit ? n * 2 : n, sides_)) + plus) * mm.damageFactor)), true);
      if (s.dodgeReady) {
        s.dodgeReady = false;
        damage = Math.max(1, Math.floor(damage / 2));
      }
      after = hurtHero(s, damage);
    }
    events.push({ type: 'attack', actor: mm.key, target: s.key, natural: roll.natural, total, hit, crit, damage, targetHp: s.c.hp, kind: 'weapon' }, ...after);
    if (!hit) {
      // Guardian: a miss is an opening, once a round.
      if (s.riposteReady && s.c.hp > 0) {
        s.riposteReady = false;
        heroAttack(s, mm);
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
    if (thief && s.goldLeft > 0 && !stolen.has(mm.key)) {
      const amount = Math.min(s.goldLeft, sum(rollDice(rng, 2, 10)) * (mm.depth + 1));
      s.goldLeft -= amount;
      stolen.set(mm.key, { amount, from: s.key });
      events.push({ type: 'power', actor: mm.key, power: 'thief', target: s.key, amount });
    }
    if (s.c.hp <= 0) return;
    const burn = powerOf(mm, 'burn');
    if (burn) {
      burning.set(s.key, { turns: burn.turns, dice: burn.dice });
      events.push({ type: 'status', target: s.key, status: 'burning', turns: burn.turns });
    }
    const paralyze = powerOf(mm, 'paralyze');
    if (paralyze && s.held === 0 && !(s.raging && s.path('berserker', PATH_MASTERY)) && !heroSave(s, 'con', dcOf(mm, paralyze.dc))) {
      s.held = 1;
      events.push({ type: 'status', target: s.key, status: 'paralyzed', turns: 1 });
    }
    const poison = powerOf(mm, 'poison');
    if (poison && s.poisoned.turns === 0 && !heroSave(s, 'con', dcOf(mm, poison.dc))) {
      s.poisoned.turns = poison.turns;
      s.poisoned.dice = poison.dice;
      events.push({ type: 'status', target: s.key, status: 'poisoned', turns: poison.turns });
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
        // One torrent, and every Hero standing in it saves for itself.
        const rolled = sum(rollDice(rng, breath.dice[0], breath.dice[1]));
        for (const s of standing()) {
          const full = Math.round(rolled * mm.damageFactor * (s.fireproof ? 0.5 : 1));
          const saved = heroSave(s, 'dex', dcOf(mm, breath.dc));
          const damage = soften(s, dodgeBlast(s, full, saved), false);
          const after = hurtHero(s, damage);
          events.push({ type: 'power', actor: mm.key, power: 'breath', target: s.key, amount: damage, hp: s.c.hp }, ...after);
        }
        return;
      }
    }
    const attacks = powerOf(mm, 'multiattack')?.attacks ?? 1;
    for (let i = 0; i < attacks; i++) {
      const target = pickTarget();
      if (!target) break;
      monsterAttack(mm, target);
    }
  };

  /** Burning bites at the start of a turn; returns whether the fighter can still act. */
  const startTurn = (key: string): boolean => {
    const s = sideOf(key);
    const fire = burning.get(key);
    if (fire && fire.turns > 0) {
      fire.turns--;
      const rolled = sum(rollDice(rng, fire.dice[0], fire.dice[1]));
      if (s) {
        const damage = soften(s, s.fireproof ? Math.max(1, Math.floor(rolled / 2)) : rolled, false);
        const after = hurtHero(s, damage);
        events.push({ type: 'tick', target: key, damage, hp: s.c.hp }, ...after);
        if (s.c.hp <= 0) return false;
      } else {
        const mm = mons.find((x) => x.key === key)!;
        const after = wound(mm, rolled, false);
        events.push({ type: 'tick', target: key, damage: rolled, hp: mm.hp }, ...after);
        markDefeated();
        if (mm.hp <= 0) return false;
      }
      if (fire.turns === 0) events.push({ type: 'expire', target: key, status: 'burning' });
    }
    if (!s) return true;
    if (s.poisoned.turns > 0) {
      s.poisoned.turns--;
      const damage = soften(s, sum(rollDice(rng, s.poisoned.dice[0], s.poisoned.dice[1])), false);
      const after = hurtHero(s, damage);
      events.push({ type: 'tick', target: key, damage, hp: s.c.hp, status: 'poisoned' }, ...after);
      if (s.c.hp <= 0) return false;
      if (s.poisoned.turns === 0) events.push({ type: 'expire', target: key, status: 'poisoned' });
    }
    if (s.held > 0) {
      s.held--;
      events.push({ type: 'held', target: key });
      if (s.held === 0) events.push({ type: 'expire', target: key, status: 'paralyzed' });
      return false;
    }
    // Champion, Survivor: a little health back each turn while below half.
    if (s.path('champion', PATH_MASTERY) && s.c.hp > 0 && s.c.hp < s.c.maxHp / 2) {
      const gained = Math.min(s.c.maxHp - s.c.hp, 2 + s.mod('con'));
      if (gained > 0) {
        s.c.hp += gained;
        events.push({ type: 'feature', feature: 'survivor', amount: gained, hp: s.c.hp, ...tag(s) });
      }
    }
    return true;
  };

  /** 3 successes (10+) or 3 failures; a natural 20 stands up, a natural 1 counts twice. */
  const deathSaves = (s: Side): 'rise' | 'survived' | 'dead' => {
    events.push({ type: 'down', ...tag(s) });
    burning.delete(s.key);
    s.poisoned.turns = 0;
    s.held = 0;
    let successes = 0;
    let failures = 0;
    while (successes < 3 && failures < 3) {
      let { natural } = rollD20(rng, { rerollOnes: s.rerollOnes });
      if (natural < DEATH_SAVE_DC && s.runPowers.lucky && (s.c.talents.includes('lucky-charm') || s.c.uniques.includes('luckstone'))) {
        s.runPowers.lucky = false;
        events.push({ type: 'reroll', natural, ...tag(s) });
        natural = Math.max(natural, rollD20(rng, { rerollOnes: s.rerollOnes }).natural);
      }
      if (natural === 20) {
        s.c.hp = Math.max(1, Math.floor(s.c.maxHp / 4));
        events.push({ type: 'death-save', natural, successes, failures, ...tag(s) });
        events.push({ type: 'rise', hp: s.c.hp, ...tag(s) });
        return 'rise';
      }
      if (natural === 1) failures += 2;
      else if (natural >= DEATH_SAVE_DC) successes++;
      else failures++;
      events.push({ type: 'death-save', natural, successes: Math.min(successes, 3), failures: Math.min(failures, 3), ...tag(s) });
    }
    if (successes >= 3) {
      s.c.hp = 1;
      return 'survived';
    }
    return 'dead';
  };
  /** A Trivial fight's promise: the Hero goes down and is left for dead, with 1 health. */
  const spared = (s: Side): 'survived' => {
    events.push({ type: 'down', ...tag(s) });
    burning.delete(s.key);
    s.poisoned.turns = 0;
    s.held = 0;
    s.c.hp = 1;
    return 'survived';
  };

  /** Heroes who ran or fell drop out; the fight is over when no Hero or no monster is left in it. */
  let over = alive().length === 0;
  let won = over;
  for (let round = 1; round <= ROUND_LIMIT && !over; round++) {
    currentRound = round;
    for (const s of sides) {
      s.dodgeReady = s.dodges;
      s.riposteReady = s.path('guardian');
      // Rogues find another opening each round.
      if (s.c.class === 'rogue') s.sneakReady = true;
    }
    for (const key of order) {
      if (over) break;
      const s = sideOf(key);
      // Whoever was surprised stands still for the first round.
      if (round === 1 && input.surprise === (s ? 'hero' : 'monsters')) continue;
      if (s) {
        if (s.out === null && s.c.hp > 0 && startTurn(key)) heroTurn(s);
      } else {
        const mm = mons.find((x) => x.key === key)!;
        if (mm.hp > 0 && !fled.has(mm.key) && startTurn(mm.key)) monsterTurn(mm);
      }
      for (const x of sides) {
        if (x.out !== null) continue;
        if (x.escaped) x.out = 'escaped';
        else if (x.c.hp <= 0) {
          const save = input.spare && !duo ? spared(x) : deathSaves(x);
          if (save !== 'rise') x.out = save;
        }
      }
      if (sides.every((x) => x.out !== null)) over = true;
      else if (alive().length === 0) over = won = true;
    }
    for (const s of sides) {
      if (s.frightened > 0) {
        s.frightened--;
        if (s.frightened === 0 && !over) events.push({ type: 'expire', target: s.key, status: 'frightened' });
      }
    }
  }
  // A fight won by the Heroes still in it; one that runs out of rounds ends with them pulling back, alive.
  for (const s of sides) s.out ??= won ? 'victory' : 'survived';
  const outcome = hero.out!;
  events.push({ type: 'end', outcome });

  const xp = mons.filter((mm) => defeated.includes(mm.key)).reduce((sum_, mm) => sum_ + mm.xp, 0);
  const lost = (s: Side) => [...stolen.entries()].filter(([key, t]) => fled.has(key) && t.from === s.key).reduce((sum_, [, t]) => sum_ + t.amount, 0);
  const sideResult = (s: Side): SideResult => ({
    outcome: s.out!, hp: s.out === 'dead' ? 0 : s.c.hp, uses: s.uses, potionsUsed: s.potionsUsed, runPowers: s.runPowers, goldStolen: lost(s),
  });
  const ally = sides[1] ? sideResult(sides[1]) : null;
  return { ...sideResult(hero), events, xp, defeated, ally };
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
