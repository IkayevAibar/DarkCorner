import { type Ability, type AbilityScores, abilityModifier } from './abilities.js';
import { type CheckInput, check } from './check.js';
import { type GearBase, baseById, isGear } from './content/bases.js';
import { CASTERS, CLASS_DEFS, type ClassId } from './content/classes.js';
import { type ThemeId, themeOf } from './content/floors.js';
import type { BonusStatId } from './content/loot.js';
import { type StatGear, statTotal } from './items.js';
import {
  DUO_ELITE_CHANCE, ELITE_CHANCE, ELITE_HP, ELITES, type EliteId, GILDED_HP, type MonsterDef, type MonsterPower, type MonsterPowerId, MONSTERS, TWIN_WARDENS, WARDENS, monsterById,
} from './content/monsters.js';
import type { OmenDef } from './content/omens.js';
import { type PathId, PATH_MASTERY, onPath } from './content/paths.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import { DEFAULT_STANCE, STANCE_DEFS, type StanceId } from './content/stances.js';
import type { TalentId } from './content/talents.js';
import { type Edge, rollD20, rollDice, sum } from './dice.js';
import { type Rng, createRng } from './rng.js';
import {
  ARCHERY_BONUS, AURA_LEVEL, EVASION_LEVEL, FLURRY_STRIKES, MARK_DICE, MARTIAL_STRIKES, type RestUses, agathys, UNCANNY_DODGE_LEVEL, attacksPerTurn, burstDice, cureDice,
  BEAST_TWIN_CLAWS, inspirationDie, layOnHands, martialDie, proficiencyBonus, rageDamage, smiteDice, sneakDice, spellDice, wildShapeHealth,
} from './levels.js';
import { type WornGear, armorClass, gearFactor } from './stats.js';

// ─── The Hero as it fights ────────────────────────────────────────────────

export interface WornForCombat extends StatGear {
  base: string;
  quality: number | null;
  upgrade: number;
  uniqueId: string | null;
  /** The worn slot: which hand holds a weapon. Without it, the first weapon worn is the main one. */
  slot?: string | null;
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
  /** A light weapon in the off-hand: it strikes once more each turn (docs/design.md → Hands). */
  offHand?: { base: GearBase; factor: number } | null;
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

/** Draconic resilience: a Draconic Sorcerer's scales add this to its Armor Class. */
export const DRACONIC_AC = 2;

/**
 * A Hero's Armor Class: its gear's (stats.ts), Battle-hardened's +1, a Monk's WIS while it
 * wears no body armor and no shield (Unarmored defense), and a Draconic Sorcerer's scales.
 * `scores` already carry the gear's Bonus stats. The Character sheet and the fights both use it.
 */
export function heroArmorClass(
  hero: { class: ClassId; level: number; path?: PathId | null; talents: readonly TalentId[]; scores: AbilityScores },
  worn: WornGear[],
): number {
  const armored = worn.some((w) => {
    const b = baseById(w.base);
    return isGear(b) && b.ac !== undefined && (b.slot === 'body' || b.offHand === 'shield');
  });
  return armorClass(hero.scores.dex, worn) + talentArmor(hero.talents)
    + (hero.class === 'monk' && !armored ? abilityModifier(hero.scores.wis) : 0)
    + (onPath({ path: hero.path ?? null, level: hero.level }, 'draconic') ? DRACONIC_AC : 0);
}

/** Full health with gear on: the Hero's own plus its "+N max health" Bonus stats. */
export const maxHealth = (base: number, worn: readonly StatGear[]): number => base + statTotal(worn, 'maxHp');

/** Ability scores with worn gear: its ability Bonus stats, and the Lich's Phylactery's +2 to each. Fights and Checks both use these. */
export function gearScores(scores: AbilityScores, worn: readonly (StatGear & { uniqueId: string | null })[]): AbilityScores {
  const phylactery = worn.some((w) => w.uniqueId === 'phylactery') ? 2 : 0;
  const out = { ...scores };
  for (const a of Object.keys(out) as Ability[]) out[a] += statTotal(worn, a) + phylactery;
  return out;
}

/** Critical chance counts in steps (v0): every full 5% lets one more face of the d20 crit. */
export const CRIT_STEP = 5;
/** The lowest natural d20 that crits: 20 alone, down to 18 (17 for a Champion). */
export const critFromOf = (critChance: number, champion: boolean): number =>
  Math.max(18 - Number(champion), 20 - Math.floor(critChance / CRIT_STEP) - Number(champion));
/** Escape chance counts in steps too: every full 5% is +1 on Sneak and Escape rolls. */
export const escapeSteps = (escape: number): number => Math.floor(escape / 5);

/**
 * A Healing potion (v0): 2d4 + 2 plus a tenth of the drinker's full health, so it
 * still matters deep down. Field medics get half again as much.
 */
export function potionHealing(rng: Rng, fullHealth: number, fieldMedic: boolean): number {
  return (sum(rollDice(rng, 2, 4)) + 2 + Math.round(fullHealth * 0.1)) * (fieldMedic ? 1.5 : 1);
}

/** Who gets half again from a Healing potion: a Field medic, or a Druid (Herbalist). */
export const herbalist = (hero: { class: ClassId; talents: readonly TalentId[] }): boolean =>
  hero.talents.includes('field-medic') || hero.class === 'druid';

/** Puts a Hero, its scores and its worn gear together into one fighter. */
export function heroCombat(input: {
  name: string; class: ClassId; race: RaceId; level: number; talents: TalentId[]; path?: PathId | null;
  scores: AbilityScores; maxHp: number; hp: number; worn: WornForCombat[];
}): HeroCombat {
  const uniques = input.worn.map((w) => w.uniqueId).filter((u): u is string => Boolean(u));
  const scores = gearScores(input.scores, input.worn);
  const bonus = (stat: BonusStatId) => statTotal(input.worn, stat);

  const armed = (w: WornForCombat) => {
    const b = baseById(w.base);
    return isGear(b) && b.damage !== undefined;
  };
  const held = (w: WornForCombat | undefined) => (w ? { base: baseById(w.base) as GearBase, factor: gearFactor(w) } : null);
  const sorted = input.worn.some((w) => w.slot);
  // Worn slots say which hand holds what; a dagger alone in the off-hand fights as the main weapon.
  const mainGear = sorted ? input.worn.find((w) => w.slot === 'main' && armed(w)) : input.worn.find((w) => armed(w) && (baseById(w.base) as GearBase).slot === 'main');
  const offGear = sorted ? input.worn.find((w) => w.slot === 'off' && armed(w)) : undefined;
  const weapon = held(mainGear ?? offGear);
  const offHand = mainGear ? held(offGear) : null;

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
    ac: heroArmorClass({ ...input, scores }, input.worn),
    weapon,
    offHand,
    damagePct: bonus('damage'),
    critChance: bonus('crit'),
    spellPower: bonus('spellPower'),
    healing: bonus('healing'),
    lifeSteal: bonus('lifeSteal'),
    escape: bonus('escape'),
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
export function instantiate(def: MonsterDef, floor: number, key: string, weakening = 0, elite: EliteId | null = null, alone = true): MonsterInstance {
  // Monsters that turn up anywhere grow as if they lived on the Floor; the Dragon is its own measure.
  const depth = Math.max(0, floor - THEME_START[def.anywhere ? themeOf(floor) : def.theme]);
  const might = def.role === 'boss' ? { hp: 1, hit: 0, damage: 0 } : floorMight(floor, alone);
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
export function floorMight(floor: number, alone = true): { hp: number; hit: number; damage: number } {
  const below = Math.max(0, floor - 2);
  // From Floor 3 on, a step up all at once for a Hero alone (v0, 2026-10-10: the game was too easy alone).
  // Floors 1 and 2 stay gentle, and a Duo's monsters keep their numbers (duo.ts tunes those on their own).
  const step = floor >= 3 && alone ? 1 : 0;
  return {
    hp: 1 + MIGHT.hp * below + MIGHT.stepHp * step,
    hit: Math.round(MIGHT.hit * below + MIGHT.stepHit * step),
    damage: Math.round(MIGHT.damage * below + MIGHT.stepDamage * step),
  };
}
export const MIGHT = { hp: 0.2, hit: 0.75, damage: 0.55, stepHp: 0.25, stepHit: 1, stepDamage: 1 };

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
export function spawnEncounter(rng: Rng, floor: number, kind: EncounterKind, weakening = 0, omen: OmenDef | null = null, alone = true): MonsterInstance[] {
  const out = spawnGroup(rng, floor, kind, weakening, omen, alone);
  return out.map((mm) => underOmen(mm, omen));
}

/** What waits in a Room: a group, a Mini-boss, the Boss, or the Twin Wardens (for a Duo, behind a Twin door). */
export type EncounterKind = 'fight' | 'miniboss' | 'boss' | 'twin';

function spawnGroup(rng: Rng, floor: number, kind: EncounterKind, weakening: number, omen: OmenDef | null, alone: boolean): MonsterInstance[] {
  const theme = themeOf(floor);
  if (kind === 'twin') {
    // The lair has no Twin door; past the depths the Wardens keep the depths' numbers.
    const home = theme === 'lair' ? 'depths' : theme;
    return TWIN_WARDENS.map((id, i) => instantiate({ ...monsterById(id), ...WARDENS[home], theme: home }, floor, `m${i}`, 0, null, false));
  }
  if (kind !== 'fight') {
    // Each Floor of a theme has its own Mini-boss, in the bestiary's order (docs/design.md → Monsters).
    const defs = MONSTERS.filter((d) => d.theme === theme && d.role === kind);
    const def = defs[(floor - THEME_START[theme]) % Math.max(1, defs.length)];
    if (!def) throw new Error(`no ${kind} for theme ${theme}`);
    const leader = instantiate(def, floor, 'm0', kind === 'boss' ? weakening : 0, null, alone);
    return [leader, ...(def.escort ?? []).map((id, i) => instantiate(monsterById(id), floor, `m${i + 1}`, 0, null, alone))];
  }
  // Alone, more threes from Floor 3 (v0, 2026-10-10); a Duo's groups keep the old odds.
  const sizes: [number, number][] = floor === 1 ? [[1, 70], [2, 30]] : floor === 2 ? [[1, 40], [2, 50], [3, 10]]
    : alone ? [[1, 25], [2, 50], [3, 25]] : [[1, 30], [2, 50], [3, 20]];
  let r = rng.next() * 100;
  const size = sizes.find(([, w]) => (r -= w) < 0)?.[0] ?? 1;
  const pool = MONSTERS.filter((d) => d.theme === theme && (d.role === 'minion' || d.role === 'brute') && d.weight > 0 && floor >= (d.from ?? 0));
  const out: MonsterInstance[] = [];
  let brutes = 0;
  for (let i = 0; i < size; i++) {
    const options = pool.filter((d) => d.role === 'minion' || brutes === 0);
    const total = options.reduce((s, d) => s + d.weight, 0);
    let pick = rng.next() * total;
    const def = options.find((d) => (pick -= d.weight) < 0) ?? options[0]!;
    if (def.role === 'brute') brutes++;
    out.push(instantiate(def, floor, `m${i}`, 0, null, alone));
  }
  if (floor >= 2 && rng.chance(Math.min(1, (alone ? ELITE_CHANCE : DUO_ELITE_CHANCE)[theme] * (omen?.elites ?? 1)))) {
    const strongest = out.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
    out[out.indexOf(strongest)] = instantiate(monsterById(strongest.id), floor, strongest.key, 0, rng.pick([...ELITES]), alone);
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
  | { type: 'attack'; actor: string; target: string; natural: number; total: number; hit: boolean; crit: boolean; damage: number; targetHp: number; kind: 'weapon' | 'spell'; hand?: 'off' }
  /** A blow turned aside: by the Ashen Aegis, a Wizard's Shield, a Great Old One's Entropic ward or a Shadow Monk's Cloak of shadows. */
  | { type: 'blocked'; actor: string; by: BlockedBy; target?: string }
  | { type: 'burst'; actor: string; source: 'spell' | 'bomb'; targets: { key: string; damage: number; hp: number }[] }
  /**
   * `actor` is who is healed; `by` the other Hero when a Cleric, Druid or Paladin mends its partner.
   * `lay-on-hands` is a Paladin's, `wholeness` an Open Hand Monk's Wholeness of body, `dark-blessing`
   * a Fiend Warlock's Dark one's blessing on a kill.
   */
  | { type: 'heal'; actor: string; ability: HealAbility; amount: number; hp: number; by?: string }
  /**
   * A Hero's Class or Path at work: `survivor` heals `amount` to `hp`; `indomitable` and
   * `relentless` keep it standing at `hp` 1; `ward` is raised (`left`) or soaks `amount`
   * of a hit (`left` after); `rage` begins a Barbarian's Rage; `mark` puts a Ranger's
   * Hunter's mark on the monster `target`. Chosen in a manual fight: `dodge` (blows at it
   * have disadvantage until its next turn), `help` (its partner `target`'s next attack has
   * advantage) and `guard` (blows at its partner `target` come to it until its next turn).
   * The newer Classes: `smite` (a Paladin's Divine smite blazes on the hit at `target`), `hex`
   * (a Warlock's Hex goes on `target`), `flurry` (a Monk's Flurry of blows), `wild-shape` (a
   * Druid becomes a beast with `left` health, or the beast soaks `amount` of a hit and has
   * `left`; 0 is its own shape again), `inspiration` (a Bard's die, `amount`, turns its missed
   * spell into a hit), `cutting-words` (a Bard's die, `amount`, turns aside `target`'s blow)
   * and `quickened` (a Sorcerer casts two attack spells this turn).
   */
  | {
    type: 'feature'; feature: FeatureEventId;
    amount?: number; hp?: number; left?: number; target?: string; actor?: string;
  }
  /** A Hero pulls its fallen Duo partner (`target`) up: a WIS check; on a success it stands with `hp`. */
  | { type: 'revive'; target: string; natural: number; total: number; dc: number; success: boolean; hp: number; actor?: string }
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

/** What turned a blow aside. */
export type BlockedBy = 'aegis' | 'shield' | 'entropic-ward' | 'cloak-of-shadows';
export type HealAbility = 'second-wind' | 'cure-wounds' | 'potion' | 'life-steal' | 'lay-on-hands' | 'wholeness' | 'dark-blessing';
export type FeatureEventId = 'survivor' | 'indomitable' | 'ward' | 'rage' | 'mark' | 'relentless' | 'dodge' | 'help' | 'guard'
  | 'smite' | 'hex' | 'flurry' | 'wild-shape' | 'inspiration' | 'cutting-words' | 'quickened';

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

// ─── Manual fights (docs/design.md → Manual fights) ─────────────────────────

/** What a Hero can do with its turn when its Player chooses. */
export const HERO_ACTIONS = ['attack', 'burst', 'cure', 'second-wind', 'potion', 'escape', 'dodge', 'help', 'guard', 'revive'] as const;
export type HeroActionKind = (typeof HERO_ACTIONS)[number];

/**
 * One Hero's choice for a turn. `target` is the monster to attack (the AI picks when
 * left out) or the Hero ('hero', 'ally') to cure. `rage` and `mark` cost no turn and come
 * before the action. `rage` is the Class's own power: a Barbarian starts its Rage, a
 * Paladin calls a Divine smite for this turn's first hit, a Monk a Flurry of blows for
 * this turn's attack, a Druid takes its Wild shape, a Sorcerer Quickens this turn's attack
 * spell. `mark` puts a Ranger's Hunter's mark
 * or a Warlock's Hex on that monster. 'auto' hands the Hero to the AI for the rest of the
 * fight; 'ai' lets the AI take just this turn (a Duo turn that ran out of time).
 */
export interface HeroAction {
  kind: HeroActionKind | 'auto' | 'ai';
  target?: string;
  rage?: boolean;
  mark?: string;
}
export interface HeroChoice { hero: HeroKey; action: HeroAction }

/** Which Heroes their Players play by hand, and every choice made so far, in the order the fight asked for them. */
export interface FightControl {
  manual: HeroKey[];
  choices: HeroChoice[];
}

/** A Hero's turn waiting for its Player: what it can do now. */
export interface TurnOptions {
  hero: HeroKey;
  round: number;
  /** A second action in the same turn: after Preserve life's free Cure wounds, or a Thief's Fast hands. */
  continuing: boolean;
  actions: HeroActionKind[];
  /** Monsters it can attack or mark. */
  targets: string[];
  /** Heroes its Cure wounds (or Lay on hands) can reach, a fallen partner too. */
  cure: HeroKey[];
  /** It can call its Class's power (Rage, Divine smite, Flurry of blows, Wild shape, Quickened spell), or place a Hunter's mark or a Hex, before acting. */
  rage: boolean;
  mark: boolean;
  /** Attacks an 'attack' makes this turn. */
  attacks: number;
  spells: number;
  heals: number;
  /** Healing potions it can still drink this fight. */
  potions: number;
}

/** A fight stopped at a Hero's turn: everything so far, and what that Hero can do. */
export interface PausedFight {
  paused: true;
  events: FightEvent[];
  turn: TurnOptions;
}

/** A choice the fight can't take: not that Hero's turn, or not something it can do now. */
export class InvalidChoice extends Error {
  constructor(readonly code: 'not_your_turn' | 'bad_action', message: string) {
    super(message);
    this.name = 'InvalidChoice';
  }
}

/** Thrown to stop a fight at a Hero's turn with no choice made yet. */
class Pause {
  constructor(readonly turn: TurnOptions) {}
}

/** Pulling a fallen partner up (v0): a WIS check against this; Clerics add their proficiency. */
export const REVIVE_DC = 10;

const DEATH_SAVE_DC = 10;
/** A Hero drinks at most this many potions in one fight (v0), however many it carries. */
export const POTIONS_PER_FIGHT = 3;
const ROUND_LIMIT = 60;
/** Twin Wardens: one that fell while its twin stands rises at the end of the round with this share of its health (v0). */
export const TWIN_RISE = 0.5;
/** A sundering monster cracks this much Armor Class at most in one fight (v0). */
export const SUNDER_MAX = 3;
/** The Worldbreaker cracks this much of a monster's Armor Class at most in one fight. */
export const WORLDBREAKER_MAX = 5;
/** Trollheart: the share of full health back at the start of each turn. */
export const TROLLHEART_SHARE = 0.03;
/** Thief, Ghost: the round from which every round's Sneak attack gets the full dice (v0). */
export const THIEF_STUDY_ROUND = 4;
/** Ember Fang: a critical hit leaves the enemy burning (v0). */
const EMBER_BURN = { turns: 3, dice: [1, 6] as [number, number] };
/** Hellfire: a master Fiend Warlock's blasts leave what they hit burning (v0). */
const HELLFIRE_BURN = { turns: 2, dice: [1, 6] as [number, number] };
/** Wholeness of body: a master of the Open Hand gets this many times its level back, once a fight. */
export const WHOLENESS_PER_LEVEL = 3;
/** A Druid's beast claws (v0): this die each, plus WIS; Primal strike adds one more. */
const CLAW_DIE = 8;

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
  return runFight(rng, input, null) as FightResult;
}

/**
 * A fight played by hand (docs/design.md → Manual fights): it runs until a manual
 * Hero's turn that has no choice left in `control.choices`, and stops there, or to
 * its end. The same seed and choices always give the same fight, so the server keeps
 * only those. Throws InvalidChoice for a choice the fight can't take.
 */
export function playFight(rng: Rng, input: FightInput, control: FightControl): FightResult | PausedFight {
  return runFight(rng, input, control);
}

function runFight(rng: Rng, input: FightInput, control: FightControl | null): FightResult | PausedFight {
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
    const caster = CASTERS.includes(c.class);
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
      /** Fireproof talent, or a Draconic Sorcerer's Draconic resilience: fire deals half. */
      fireproof: c.talents.includes('fireproof') || path('draconic'),
      heavyHitter: c.talents.includes('heavy-hitter') ? 2 : 0,
      /** Life: potions and Cure wounds heal half again as much. */
      lifeBoost: path('life') ? 1.5 : 1,
      /** Life, Preserve life: the first Cure wounds of a fight doesn't cost the turn. */
      quickCure: path('life', PATH_MASTERY),
      aegis: c.uniques.includes('ashen-aegis'),
      /**
       * The first blow of each fight that would land is turned aside: a Wizard's Shield, a master
       * Great Old One's Entropic ward, a master Shadow Monk's Cloak of shadows.
       */
      shield: (c.class === 'wizard' ? 'shield' : path('old-one', PATH_MASTERY) ? 'entropic-ward' : path('shadows', PATH_MASTERY) ? 'cloak-of-shadows' : null) as BlockedBy | null,
      /** The Last Ember: once per fight a missed spell hits for double. */
      lastEmber: c.uniques.includes('last-ember'),
      /** Saint's Knuckle: the first Cure wounds of a fight gives its use back. */
      knuckle: c.uniques.includes('saints-knuckle'),
      /**
       * Rogue Uncanny dodge (from level 3, v0): the first hit of each fight deals half damage.
       * Every round's first hit made Rogues all but unbeatable by Mini-bosses (balance:par).
       */
      dodgeReady: c.class === 'rogue' && c.level >= UNCANNY_DODGE_LEVEL,
      /** Bracers of the Bulwark: the first hit of each fight deals half damage. */
      bracers: c.uniques.includes('bulwark-bracers'),
      /** Barbarian: in a Rage for the rest of the fight. */
      raging: false,
      /** Bear-heart, Relentless: the CON save that keeps a raging Hero up grows harder each time. */
      relentlessDc: 10,
      /** Ranger or Warlock: the monster under the Hunter's mark or the Hex. */
      marked: null as string | null,
      markFeature: (c.class === 'warlock' ? 'hex' : 'mark') as 'hex' | 'mark',
      /** Paladin: a Divine smite called for this turn, spent on its first hit. */
      smiting: false,
      /** Paladin or Monk: a Divine smite or a Flurry of blows already spent this fight (the AI keeps the rest for Mini-bosses and the Boss). */
      smote: false,
      /** Paladin, Vow of enmity: the monster it swore against. */
      vowed: null as string | null,
      /** Monk: a Flurry of blows called for this turn. */
      flurry: false,
      /** Monk: the Flurry of blows being struck right now. */
      flurrying: false,
      /** Druid: its beast form's health left; 0 is its own shape. */
      beast: 0,
      /** Druid: it took its Wild shape this fight (once a fight). */
      shaped: false,
      /** Sorcerer: a Quickened spell called for this turn. */
      quicken: false,
      /** Open Hand, Wholeness of body: once a fight. */
      wholeness: path('open-hand', PATH_MASTERY),
      /** Wild Magic, Tides of chaos: once a fight. */
      tides: path('wild'),
      /** Aura of devotion or Countercharm: neither fear nor a mesmerizing gaze takes hold. */
      fearless: path('devotion', PATH_MASTERY) || path('lore', PATH_MASTERY),
      /** Aura of protection: a Paladin's CHA modifier (at least +1) on every save. */
      aura: c.class === 'paladin' && c.level >= AURA_LEVEL ? Math.max(1, abilityModifier(c.scores.cha)) : 0,
      /** Hunter, Colossus slayer: once per turn. */
      slewThisTurn: false,
      rerollOnes: RACE_DEFS[c.race].rerollOnes,
      mod: (a: Ability) => abilityModifier(c.scores[a]),
      prof: proficiencyBonus(c.level),
      attackAbility: (caster ? cls.primary
        : c.weapon?.base.weapon === 'bow' || c.class === 'rogue' || c.class === 'ranger' || c.class === 'monk' ? 'dex' : 'str') as Ability,
      /** Ranger, Archery. */
      archery: c.class === 'ranger' && c.weapon?.base.weapon === 'bow' ? ARCHERY_BONUS : 0,
      critFrom: critFromOf(c.critChance, champion === 1),
      proficientSaves: new Set<Ability>([...cls.saves, ...(c.talents.includes('iron-will') ? (['con', 'wis'] as const) : [])]),
      /** Only Heroes are ever poisoned. */
      poisoned: { turns: 0, dice: [1, 4] as [number, number] },
      held: 0,
      frightened: 0,
      /** Armor a sundering monster has cracked this fight (each point is 1 less Armor Class). */
      sundered: 0,
      escaped: false,
      /** Out of the fight: fell and made its death saves one way or the other, or ran. */
      out: null as FightOutcome | null,
      /** Played by its Player, turn by turn, rather than by the AI. */
      manual: false,
      /** Until its next turn: Dodging (blows at it have disadvantage), or Guarding its partner (blows at the partner come to it). */
      dodging: false,
      guarding: false,
      /** Its partner Helped it: its next attack roll has advantage. */
      helped: false,
      /** A fallen Duo Hero: a death save each turn, until it is stable, dead, or pulled back up. */
      down: null as { successes: number; failures: number } | null,
    };
  };
  type Side = ReturnType<typeof makeSide>;
  const hero = makeSide('hero', input);
  const sides: Side[] = input.ally ? [hero, makeSide('ally', input.ally)] : [hero];
  for (const s of sides) s.manual = control?.manual.includes(s.key) ?? false;
  const sideOf = (key: string) => sides.find((s) => s.key === key);
  const partnerOf = (s: Side) => sides.find((x) => x !== s) ?? null;
  /** Which Heroes have gone for each monster this round: a Rogue flanks its partner's quarry. */
  const struckThisRound = new Map<string, Set<HeroKey>>();
  /** Monsters a Bard's Vicious mockery stung or an Open Hand Monk's Flurry of blows staggered: all their attacks next turn have disadvantage. */
  const staggered = new Set<string>();
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
  /** Monsters fire touched since their last turn: a regenerating one heals nothing then. */
  const scorched = new Set<string>();
  /** Armor the Worldbreaker has cracked on each monster this fight. */
  const cracked = new Map<string, number>();
  const enraged = new Set<string>();

  const alive = () => mons.filter((mm) => mm.hp > 0 && !fled.has(mm.key));
  /** The monster a Hunter's mark goes to: the one with the most health left. */
  const toughest = () => alive().reduce<MonsterInstance | null>((a, b) => (a === null || b.hp > a.hp ? b : a), null);
  /** A fight worth a Rage or a Hunter's mark: two or more monsters, an elite, a Mini-boss or the Boss. */
  const hardFight = () => alive().length >= 2 || alive().some((mm) => mm.elite !== null || monsterById(mm.id).role === 'miniboss' || monsterById(mm.id).role === 'boss');
  /** Who a monster goes for: the one Hero left standing, or either of two; a Guarding partner steps into the blow. */
  const pickTarget = (): Side | null => {
    const up = standing();
    if (up.length <= 1) return up[0] ?? null;
    const picked = up[rng.int(0, up.length - 1)]!;
    return up.find((x) => x !== picked && x.guarding) ?? picked;
  };
  const markDefeated = () => {
    for (const mm of mons) {
      if (mm.hp <= 0 && !defeated.includes(mm.key)) {
        defeated.push(mm.key);
        stolen.delete(mm.key);
        events.push({ type: 'defeated', key: mm.key });
        // The Hunter's mark (or the Hex) moves on to the next quarry; a Vow of enmity waits for the next hard fight.
        for (const s of sides) {
          if (s.vowed === mm.key) s.vowed = null;
          if (s.marked !== mm.key) continue;
          s.marked = toughest()?.key ?? null;
          if (s.marked) events.push({ type: 'feature', feature: s.markFeature, target: s.marked, ...tag(s) });
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
      modifier: s.mod(ability) + (s.proficientSaves.has(ability) ? s.prof : 0) + s.aura, dc, rerollOnes: s.rerollOnes,
      // Spell resistance, a Barbarian's Danger sense against what it can see coming, or an Awakened mind.
      edge: s.path('abjurer', PATH_MASTERY) || (s.c.class === 'barbarian' && ability === 'dex') || (s.path('old-one') && ability === 'wis')
        ? 'advantage' : 'normal',
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
  /** A DEX save against breath or a blast: half on a success, or with Evasion (a master Stalker, a Monk from level 7) none, and half on a failure. */
  const dodgeBlast = (s: Side, full: number, saved: boolean): number =>
    s.path('stalker', PATH_MASTERY) || (s.c.class === 'monk' && s.c.level >= EVASION_LEVEL)
      ? (saved ? 0 : Math.floor(full / 2)) : Math.max(1, saved ? Math.floor(full / 2) : full);
  /**
   * Damage to a Hero: the Abjurer's ward soaks it first, then a Druid's beast form;
   * Indomitable, Relentless or Deathless Mail may keep it standing. Returns the events
   * to add after the blow itself.
   */
  const hurtHero = (s: Side, damage: number): FightEvent[] => {
    const after: FightEvent[] = [];
    if (s.ward > 0 && damage > 0) {
      const soaked = Math.min(s.ward, damage);
      s.ward -= soaked;
      damage -= soaked;
      after.push({ type: 'feature', feature: 'ward', amount: soaked, left: s.ward, ...tag(s) });
    }
    if (s.beast > 0 && damage > 0) {
      const soaked = Math.min(s.beast, damage);
      s.beast -= soaked;
      damage -= soaked;
      // The beast falls away and the Druid casts again; what the beast couldn't take carries over.
      if (s.beast === 0) s.caster = true;
      after.push({ type: 'feature', feature: 'wild-shape', amount: soaked, left: s.beast, ...tag(s) });
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
    init.set(s.key, s.c.uniques.includes('wardens-longbow') ? 99
      : natural + s.mod('dex') + (s.c.talents.includes('alert') ? 5 : 0) + (s.path('old-one') ? 5 : 0));
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
      scorched.add(mm.key);
      after.push(...wound(mm, taken, false));
      return { key: mm.key, damage: taken, hp: mm.hp };
    });
    events.push({ type: 'burst', actor: 'hero', source: 'bomb', targets }, ...after);
    markDefeated();
  }
  // Armor of Agathys: frost wraps a Warlock as a hard fight begins.
  for (const s of sides) if (s.c.class === 'warlock' && hardFight()) s.ward = agathys(s.c.level, s.c.scores.cha);
  for (const s of sides) if (s.ward > 0) events.push({ type: 'feature', feature: 'ward', left: s.ward, ...tag(s) });
  // A mesmerizing gaze holds a Hero through its first turn, unless a WIS save breaks it.
  for (const mm of alive().filter((x) => powerOf(x, 'mesmerize'))) {
    const gaze = powerOf(mm, 'mesmerize')!;
    for (const s of sides) {
      if (s.held > 0 || s.c.uniques.includes('circlet-of-calm') || s.fearless) continue;
      events.push({ type: 'power', actor: mm.key, power: 'mesmerize', target: s.key });
      if (!heroSave(s, 'wis', dcOf(mm, gaze.dc))) {
        s.held = 1;
        events.push({ type: 'status', target: s.key, status: 'paralyzed', turns: 1 });
      }
    }
  }
  // Fear comes before the first blow: the most fearsome monster only, on every Hero.
  const dread = alive().find((mm) => powerOf(mm, 'frighten'));
  if (dread) {
    const fear = powerOf(dread, 'frighten')!;
    for (const s of sides) {
      if (s.c.uniques.includes('circlet-of-calm') || s.fearless) continue;
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

  /** Healing on `to` (the healer's own side unless it mends its partner); it brings a fallen partner back up. */
  const heal = (to: Side, ability: HealAbility, amount: number, by?: Side) => {
    const gained = Math.max(0, Math.min(to.c.maxHp - to.c.hp, Math.round(amount)));
    to.c.hp += gained;
    if (to.down && to.c.hp > 0) to.down = null;
    events.push({ type: 'heal', actor: to.key, ability, amount: gained, hp: to.c.hp, ...(by && by !== to ? { by: by.key } : {}) });
  };

  /** One attack; `offHand`: the extra blow of a light weapon in the off-hand. */
  const heroAttack = (s: Side, at?: MonsterInstance, prefer?: string, offHand = false) => {
    const targets = alive();
    if (targets.length === 0) return;
    const { c } = s;
    // A riposte answers its attacker; then the Player's choice; otherwise a thief running with gold, a Ranger's quarry,
    // the healthier of two Twin Wardens (to wear both down together), then whoever is closest to falling.
    const twins = targets.filter((mm) => powerOf(mm, 'twin'));
    const target = (at && at.hp > 0 ? at : null)
      ?? (prefer ? targets.find((mm) => mm.key === prefer) : undefined)
      ?? targets.find((mm) => (stolen.get(mm.key)?.amount ?? 0) > 0)
      ?? targets.find((mm) => mm.key === s.marked)
      ?? targets.find((mm) => mm.key === s.vowed)
      ?? (twins.length >= 2 ? twins.reduce((a, b) => (b.hp > a.hp ? b : a)) : undefined)
      ?? targets.find((mm) => powerOf(mm, 'protect'))
      ?? targets.reduce((a, b) => (b.hp < a.hp ? b : a));
    // A protector standing between them: blows at the others come at a disadvantage.
    const shielded = !powerOf(target, 'protect') && targets.some((mm) => mm !== target && powerOf(mm, 'protect'));
    // A Stalker's ambush, Shadow arts, or a Vow of enmity on this monster.
    const ambush = (currentRound === 1 && (s.path('stalker') || s.path('shadows'))) || s.vowed === target.key;
    const edge = combine(combine(combine(combine(s.stance.attackEdge, s.frightened > 0 ? 'disadvantage' : 'normal'), ambush ? 'advantage' : 'normal'),
      s.helped ? 'advantage' : 'normal'), shielded ? 'disadvantage' : 'normal');
    s.helped = false;
    const roll = rollD20(rng, { edge, rerollOnes: s.rerollOnes });
    const partner = partnerOf(s);
    // A Rogue whose partner went for the same monster this round flanks it.
    const flanked = partner !== null && (struckThisRound.get(target.key)?.has(partner.key) ?? false);
    if (!struckThisRound.has(target.key)) struckThisRound.set(target.key, new Set());
    struckThisRound.get(target.key)!.add(s.key);
    // Devotion, Sacred weapon: +2 to hit with weapons.
    const total = roll.natural + s.prof + s.mod(s.attackAbility) + s.stance.toHit + s.archery + (s.path('devotion') && !s.caster ? 2 : 0);
    let crit = roll.natural >= s.critFrom;
    let hit = crit || (roll.natural !== 1 && total >= target.ac);
    // The Unwritten Page: an attack spell finds its mark.
    if (!hit && s.caster && c.uniques.includes('unwritten-page')) hit = true;
    const ember = !hit && s.caster && s.lastEmber;
    if (ember) {
      s.lastEmber = false;
      hit = true;
    }
    /** Events that come before the attack's own: a Bard's inspiration, a Paladin's smite. */
    const before: FightEvent[] = [];
    // Bardic inspiration: a die on a missed spell; spent only when it lands the spell.
    let inspired = 0;
    if (!hit && s.caster && c.class === 'bard' && s.uses.spells > 0 && roll.natural !== 1) {
      const die = rollDice(rng, 1, inspirationDie(c.level, c.path))[0]!;
      if (total + die >= target.ac) {
        s.uses.spells--;
        hit = true;
        inspired = die;
        before.push({ type: 'feature', feature: 'inspiration', amount: die, target: target.key, ...tag(s) });
      }
    }
    if (hit && s.firstHitCrit) {
      crit = true;
      s.firstHitCrit = false;
    }
    let damage = 0;
    let after: FightEvent[] = [];
    if (hit) {
      const targetDef = monsterById(target.id);
      if (s.beast > 0) {
        // A Druid's beast: claws of 1d8 + WIS (Primal strike: a d8 more), as strong as its spells would be.
        const dice = 1 + (s.path('moon', PATH_MASTERY) ? 1 : 0);
        damage = (sum(rollDice(rng, crit ? dice * 2 : dice, CLAW_DIE)) + s.mod('wis')) * (1 + c.spellPower / 100);
      } else if (s.caster) {
        const [n, sides_] = spellDice(c.class, c.level)!;
        // Elemental affinity: a master Draconic Sorcerer's spells add CHA once more.
        damage = sum(rollDice(rng, crit ? n * 2 : n, sides_)) + s.mod(s.cls.primary) * (s.path('evoker') ? 2 : 1)
          + (s.path('draconic', PATH_MASTERY) ? s.mod('cha') : 0);
        // Combat inspiration: a Valor Bard's die counts in the damage too; Battle magic: a master's every hit adds one, free.
        if (s.path('valor')) damage += inspired;
        if (s.path('valor', PATH_MASTERY)) damage += rollDice(rng, 1, inspirationDie(c.level, c.path))[0]!;
        damage *= 1 + c.spellPower / 100;
        if (c.class === 'cleric' && targetDef.kin === 'undead') damage *= 2;
        if (c.uniques.includes('lantern-of-the-deep') && (targetDef.kin === 'undead' || targetDef.kin === 'demon')) damage *= 1.25;
        if (ember) damage *= 2;
      } else {
        const weapon = offHand ? c.offHand : c.weapon;
        const [n, sides_] = weaponDice(s, weapon);
        const once = () => sum(rollDice(rng, crit ? n * 2 : n, sides_));
        let dice = once();
        if (c.talents.includes('savage-attacker')) dice = Math.max(dice, once());
        // The off-hand's blow adds no ability modifier, unless that is a penalty (SRD two-weapon fighting).
        const mod = s.mod(s.attackAbility);
        damage = dice * (weapon?.factor ?? 1) + (offHand ? Math.min(0, mod) : mod);
        // The off-hand's quick blow is no Sneak attack: it waits for a proper hit.
        if (s.sneakReady && !offHand) {
          // The fight's first hit, or an Assassin's every round, gets the full dice; other rounds a sixth of the level.
          // A master Thief has studied its prey by the fourth round: from then on, a third of the level.
          const full = !s.openedFight || s.path('assassin') || flanked;
          const studied = s.path('thief', PATH_MASTERY) && currentRound >= THIEF_STUDY_ROUND;
          const sneak = full ? sneakDice(c.level) : Math.ceil(c.level / (studied ? 3 : 6));
          damage += sum(rollDice(rng, crit ? sneak * 2 : sneak, 6));
          s.sneakReady = false;
          s.openedFight = true;
        }
        if (c.uniques.includes('dawnbringer') && targetDef.kin === 'undead') damage *= 1.5;
        if (c.uniques.includes('titanfall') && (targetDef.role === 'miniboss' || targetDef.role === 'boss')) damage *= 1.25;
        // Bones break under blunt weapons, and arrows and points slip between them.
        if (powerOf(target, 'brittle')) {
          const hits = weapon?.base.hits ?? 'bludgeon';
          damage *= hits === 'bludgeon' ? 1.5 : hits === 'pierce' ? 0.75 : 1;
        }
      }
      if (s.path('war') && !s.struckThisTurn) damage += sum(rollDice(rng, crit ? 2 : 1, 8));
      s.struckThisTurn = true;
      // Divine smite: the turn's first hit pours in holy fire, a d8 more on the undead and demons.
      if (s.smiting && !offHand && s.uses.spells > 0) {
        s.smiting = false;
        s.smote = true;
        s.uses.spells--;
        const dice = smiteDice(c.level, c.path) + (targetDef.kin === 'undead' || targetDef.kin === 'demon' ? 1 : 0);
        damage += sum(rollDice(rng, crit ? dice * 2 : dice, 8));
        before.push({ type: 'feature', feature: 'smite', target: target.key, ...tag(s) });
      }
      if (s.raging) damage += rageDamage(c.level);
      // A Hunter's mark counts for both Heroes of a Duo.
      if (s.marked === target.key || partner?.marked === target.key) damage += sum(rollDice(rng, crit ? MARK_DICE[0] * 2 : MARK_DICE[0], MARK_DICE[1]));
      if (s.path('hunter') && !s.slewThisTurn && target.hp < target.maxHp) {
        s.slewThisTurn = true;
        damage += sum(rollDice(rng, crit ? 2 : 1, 8));
      }
      damage *= 1 + c.damagePct / 100;
      damage += s.heavyHitter;
      if (c.uniques.includes('oathbreaker') && c.hp < c.maxHp / 2) damage *= 1.5;
      if (c.uniques.includes('dragonbone-blade') && targetDef.kin === 'dragonkin') damage *= 2;
      if (!s.caster && (powerOf(target, 'swarm') || powerOf(target, 'incorporeal'))) damage *= 0.5;
      damage -= powerOf(target, 'hide')?.cut ?? 0;
      damage = Math.max(1, Math.round(damage));
      after = wound(target, damage, crit);
    }
    events.push(...before, {
      type: 'attack', actor: s.key, target: target.key, natural: roll.natural, total: total + inspired, hit, crit, damage, targetHp: target.hp,
      kind: s.caster ? 'spell' : 'weapon', ...(offHand ? { hand: 'off' as const } : {}),
    }, ...after);
    if (hit && target.hp > 0) {
      // Vicious mockery stings, and Open hand technique throws a monster the Flurry of blows lands on off balance: its next turn's attacks come at a disadvantage.
      if ((s.caster && c.class === 'bard') || (s.flurrying && s.path('open-hand'))) staggered.add(target.key);
      // Hellfire: a master Fiend's blast sets what it hits burning.
      if (s.caster && s.path('fiend', PATH_MASTERY) && !((burning.get(target.key)?.turns ?? 0) > 0)) {
        burning.set(target.key, { ...HELLFIRE_BURN });
        events.push({ type: 'status', target: target.key, status: 'burning', turns: HELLFIRE_BURN.turns });
      }
    }
    // Dark one's blessing: a Fiend's spell that fells a monster feeds its caster.
    if (hit && target.hp <= 0 && s.caster && s.path('fiend') && c.hp > 0) heal(s, 'dark-blessing', s.mod('cha') + c.level);
    if (hit && crit && c.uniques.includes('ember-fang') && target.hp > 0) {
      burning.set(target.key, { ...EMBER_BURN });
      events.push({ type: 'status', target: target.key, status: 'burning', turns: EMBER_BURN.turns });
    }
    const thorns = hit && !s.caster ? powerOf(target, 'thorns') : null;
    if (thorns && c.hp > 0) {
      const prick = soften(s, sum(rollDice(rng, thorns.dice[0], thorns.dice[1])) + Math.floor(target.depth / 2), false);
      const pricked = hurtHero(s, prick);
      events.push({ type: 'power', actor: target.key, power: 'thorns', target: s.key, amount: prick, hp: c.hp }, ...pricked);
    }
    if (hit && c.lifeSteal > 0 && c.hp > 0) heal(s, 'life-steal', (damage * c.lifeSteal) / 100);
    if (hit && !s.caster && c.uniques.includes('worldbreaker') && (cracked.get(target.key) ?? 0) < WORLDBREAKER_MAX) {
      cracked.set(target.key, (cracked.get(target.key) ?? 0) + 1);
      target.ac--;
    }
    if (hit && target.hp <= 0 && c.hp > 0 && c.uniques.includes('gravechain')) heal(s, 'life-steal', c.maxHp / 10);
    if (hit && crit && c.uniques.includes('wyrmfire')) {
      for (const other of alive()) {
        if (other === target) continue;
        const splash = Math.round(damage / 2);
        scorched.add(other.key);
        const more = wound(other, splash, false);
        events.push({ type: 'attack', actor: s.key, target: other.key, natural: roll.natural, total, hit: true, crit: false, damage: splash, targetHp: other.hp, kind: 'weapon' }, ...more);
      }
    }
    markDefeated();
    // Tides of chaos: a Wild Magic Sorcerer's missed spell is cast again, once a fight.
    if (!hit && s.caster && s.tides && c.hp > 0) {
      s.tides = false;
      heroAttack(s, target);
    }
  };

  /** The dice of a weapon blow: the weapon's, or a Monk's martial arts die when that is bigger; bare hands 1d4. */
  const weaponDice = (s: Side, weapon: HeroCombat['weapon'] | undefined): [number, number] => {
    const [n, sides_] = weapon?.base.damage ?? [1, 4];
    if (s.c.class !== 'monk') return [n, sides_];
    const die = martialDie(s.c.level);
    return n * (sides_ + 1) >= die + 1 ? [n, sides_] : [1, die];
  };

  /**
   * Attacks an 'attack' makes this turn: Extra Attack, a Berserker's Frenzy (raging and below half health), a master Hunter,
   * a Stalker's first round, a Druid beast's second claw from level 5, a Monk's Martial arts strike.
   */
  const attacksFor = (s: Side) => attacksPerTurn(s.c.class, s.c.level, s.c.path)
    + (s.raging && s.path('berserker') && s.c.hp < s.c.maxHp / 2 ? 1 : 0)
    + (s.path('hunter', PATH_MASTERY) ? 1 : 0)
    + (currentRound === 1 && s.path('stalker') ? 1 : 0)
    + (currentRound === 1 && s.c.uniques.includes('quickdraw') ? 1 : 0)
    + (s.beast > 0 && s.c.level >= BEAST_TWIN_CLAWS ? 1 : 0)
    + (s.c.class === 'monk' ? MARTIAL_STRIKES : 0);
  /** A light weapon in the off-hand adds a blow to every 'attack' (spells cast with neither hand, and a Druid's beast has claws). */
  const offHanded = (s: Side) => Boolean(s.c.offHand) && !s.caster && s.beast === 0;

  /**
   * Where a turn stands: its first choice, or a second after Preserve life's free Cure
   * wounds ('after-cure') or a Thief's Fast hands potion ('after-potion').
   */
  type Stage = 'start' | 'after-cure' | 'after-potion';

  /** Who Cure wounds (or Lay on hands) can reach: Heroes still in the fight and hurt, a fallen partner too. */
  const curable = (s: Side, stage: Stage): Side[] =>
    s.uses.heals <= 0 || stage === 'after-cure' ? []
      : sides.filter((x) => x.out === null && (x.down !== null || (x.c.hp > 0 && x.c.hp < x.c.maxHp)));

  /** Whether a Hero can call its Class's power now: a Rage, a Divine smite, a Flurry of blows, a Wild shape, a Quickened spell. */
  const powerReady = (s: Side): boolean => s.uses.spells > 0 && alive().length > 0 && (
    s.c.class === 'barbarian' ? !s.raging
      : s.c.class === 'druid' ? !s.shaped
        : s.c.class === 'paladin' || s.c.class === 'monk' || s.c.class === 'sorcerer');

  /** What a Hero can do at this point of its turn. */
  const options = (s: Side, stage: Stage): TurnOptions => {
    const partner = partnerOf(s);
    const up = alive();
    const cure = curable(s, stage);
    const potions = Math.min(s.potions, POTIONS_PER_FIGHT - s.potionsUsed);
    const actions: HeroActionKind[] = [];
    if (up.length > 0) actions.push('attack');
    if ((s.c.class === 'wizard' || s.c.class === 'sorcerer') && s.uses.spells > 0 && up.length > 0) actions.push('burst');
    if (cure.length > 0) actions.push('cure');
    if (s.secondWind && stage === 'start') actions.push('second-wind');
    if (potions > 0 && stage !== 'after-potion') actions.push('potion');
    if (!duo) actions.push('escape');
    actions.push('dodge');
    if (partner && partner.out === null && partner.c.hp > 0) actions.push('help', 'guard');
    if (partner && partner.out === null && partner.down) actions.push('revive');
    return {
      hero: s.key, round: currentRound, continuing: stage !== 'start', actions,
      targets: up.map((mm) => mm.key), cure: cure.map((x) => x.key),
      rage: stage === 'start' && powerReady(s),
      mark: stage === 'start' && (s.c.class === 'ranger' || s.c.class === 'warlock') && s.marked === null && s.uses.spells > 0 && up.length > 0,
      attacks: attacksFor(s) + (offHanded(s) ? 1 : 0), spells: s.uses.spells, heals: s.uses.heals, potions,
    };
  };

  /** About what a Hero's 'attack' deals this turn, every attack of it together: the AI's sums against Twin Wardens. */
  const blowOf = (s: Side): number => {
    const { c } = s;
    if (s.beast > 0) return ((1 + (s.path('moon', PATH_MASTERY) ? 1 : 0)) * (CLAW_DIE + 1) / 2 + s.mod('wis')) * (1 + c.spellPower / 100) * attacksFor(s);
    if (s.caster) {
      const [n, sides_] = spellDice(c.class, c.level)!;
      return ((n * (sides_ + 1)) / 2 + s.mod(s.cls.primary) * (s.path('evoker') ? 2 : 1) + (s.path('draconic', PATH_MASTERY) ? s.mod('cha') : 0))
        * (1 + c.spellPower / 100) * attacksFor(s);
    }
    const [n, sides_] = weaponDice(s, c.weapon);
    const each = ((n * (sides_ + 1)) / 2) * (c.weapon?.factor ?? 1) + s.mod(s.attackAbility) + (s.raging ? rageDamage(c.level) : 0);
    const [on, osides] = c.offHand?.base.damage ?? [0, 0];
    const off = offHanded(s) ? ((on * (osides + 1)) / 2) * (c.offHand?.factor ?? 1) + Math.min(0, s.mod(s.attackAbility)) : 0;
    return (each * attacksFor(s) + off) * (1 + c.damagePct / 100);
  };
  /** What a Burst of fire adds to its dice on each monster: an Evoker's INT twice, a master Draconic Sorcerer's CHA. */
  const burstBonus = (s: Side): number => (s.path('evoker') ? 2 * s.intMod : 0) + (s.path('draconic', PATH_MASTERY) ? s.mod('cha') : 0);
  /** What multiplies a Burst of fire: the Ember Codex, a master Wild Magic Sorcerer's Wild surge, spell power. */
  const burstFactor = (s: Side): number => (s.c.uniques.includes('ember-codex') ? 1.5 : 1) * (s.path('wild', PATH_MASTERY) ? 1.5 : 1)
    * (1 + s.c.spellPower / 100);
  /** A master Evoker, or a master of Wild Magic, Bursts even a lone monster (for double). */
  const loneBurst = (s: Side): boolean => s.path('evoker', PATH_MASTERY) || s.path('wild', PATH_MASTERY);
  /** About what a Burst of fire deals each monster. */
  const burstOf = (s: Side): number => (burstDice(s.c.level) * 3.5 + burstBonus(s)) * burstFactor(s);

  /**
   * Against the Twin Wardens a blow that fells one is wasted unless the other falls in
   * the same round: the AI wears both down together, the healthier first, and Helps its
   * partner rather than fell one alone. Null when there are no Twins to think about.
   */
  const twinsPlan = (s: Side, burst: boolean): HeroAction | null => {
    const twins = alive().filter((mm) => powerOf(mm, 'twin'));
    if (twins.length < 2) return null;
    const [hi, lo] = [...twins].sort((a, b) => b.hp - a.hp) as [MonsterInstance, MonsterInstance];
    // A burst that fells only the weaker one waits; one that fells both, or neither, lands evenly.
    if (burst && !(hi.hp <= burstOf(s) || lo.hp > burstOf(s))) burst = false;
    if (burst) return { kind: 'burst' };
    const partner = partnerOf(s);
    const helper = partner && partner.out === null && !partner.down && partner.c.hp > 0 ? partner : null;
    const mine = blowOf(s);
    // Two attacks or more can fell both; or its partner, still to act this round, can fell the other.
    const both = attacksFor(s) >= 2 && hi.hp + lo.hp <= mine;
    const followed = helper !== null && order.indexOf(helper.key) > order.indexOf(s.key) && lo.hp <= blowOf(helper);
    if (hi.hp <= mine && !both && !followed) return { kind: helper ? 'help' : 'dodge' };
    return { kind: 'attack', target: hi.key };
  };

  /** What a Hero does when nobody chooses for it: the AI of every automatic fight. */
  const ai = (s: Side, stage: Stage): HeroAction => {
    const { c } = s;
    const action: HeroAction = { kind: 'attack' };
    if (stage === 'start') {
      // A Rage, a Wild shape (once a fight), a Hunter's mark or a Hex cost no turn: when a fight turns hard (or the Hero is hurt), while uses last.
      // A Divine smite or a Flurry of blows goes once in a hard fight, and every turn against a Mini-boss or the Boss.
      const big = alive().some((mm) => monsterById(mm.id).role === 'miniboss' || monsterById(mm.id).role === 'boss');
      if (powerReady(s)) {
        if ((c.class === 'barbarian' || c.class === 'druid') && (hardFight() || c.hp < c.maxHp / 2)) action.rage = true;
        if (c.class === 'paladin' && (big || (hardFight() && !s.smote))) action.rage = true;
        if (c.class === 'monk' && (big || (hardFight() && !s.smote))) action.rage = true;
        // A Sorcerer Bursts while two or more stand, and Quickens its spell on a lone hard foe (a master of Wild Magic Bursts that too).
        if (c.class === 'sorcerer' && hardFight() && alive().length === 1 && !loneBurst(s)) action.rage = true;
      }
      if ((c.class === 'ranger' || c.class === 'warlock') && s.marked === null && s.uses.spells > 0 && hardFight()) {
        const quarry = toughest();
        if (quarry) action.mark = quarry.key;
      }
      if (c.hp < c.maxHp * 0.45 && s.secondWind) return { ...action, kind: 'second-wind' };
      // A fallen partner comes first: Cure wounds or Lay on hands raises it, anyone else pulls it up.
      const partner = partnerOf(s);
      if (partner && partner.out === null && partner.down) {
        return s.uses.heals > 0 ? { ...action, kind: 'cure', target: partner.key } : { ...action, kind: 'revive' };
      }
      // Cure wounds goes to whichever Hero is hurt worst, below 45% health.
      const patient = standing().filter((x) => x.c.hp < x.c.maxHp * 0.45).sort((a, b) => a.c.hp / a.c.maxHp - b.c.hp / b.c.maxHp)[0];
      if (patient && s.uses.heals > 0) return { ...action, kind: 'cure', target: patient.key };
    }
    if (stage !== 'after-potion' && c.hp < c.maxHp * 0.3 && s.potions > 0 && s.potionsUsed < POTIONS_PER_FIGHT) return { ...action, kind: 'potion' };
    if (!duo && s.stance.escapeBelow > 0 && c.hp < c.maxHp * s.stance.escapeBelow) return { ...action, kind: 'escape' };
    const burst = (c.class === 'wizard' || c.class === 'sorcerer') && s.uses.spells > 0 && alive().length >= (loneBurst(s) ? 1 : 2);
    const twins = twinsPlan(s, burst);
    if (twins) return { ...action, ...twins };
    if (burst) return { ...action, kind: 'burst' };
    return action;
  };

  /** The next choice for a Hero: its Player's (in the order they were made), or the AI's. */
  let cursor = 0;
  const decide = (s: Side, stage: Stage): HeroAction => {
    if (!s.manual) return ai(s, stage);
    const next = control?.choices[cursor];
    if (!next) throw new Pause(options(s, stage));
    if (next.hero !== s.key) throw new InvalidChoice('not_your_turn', `It is ${s.key}'s turn`);
    cursor++;
    const { action } = next;
    if (action.kind === 'auto') s.manual = false;
    if (action.kind === 'auto' || action.kind === 'ai') return ai(s, stage);
    const can = options(s, stage);
    const bad = (why: string) => { throw new InvalidChoice('bad_action', why); };
    if (!can.actions.includes(action.kind)) bad(`${action.kind} is not possible now`);
    if (action.kind === 'attack' && action.target !== undefined && !can.targets.includes(action.target)) bad('No such monster to attack');
    if (action.kind === 'cure' && !can.cure.includes(action.target as HeroKey)) bad('Nobody to cure there');
    if (action.rage && !can.rage) bad('No Rage now');
    if (action.mark !== undefined && (!can.mark || !can.targets.includes(action.mark))) bad('No Hunter\'s mark now');
    return action;
  };

  const startRage = (s: Side) => {
    s.uses.spells--;
    s.raging = true;
    events.push({ type: 'feature', feature: 'rage', ...tag(s) });
    // Mindless rage burns fear away.
    if (s.path('berserker', PATH_MASTERY) && s.frightened > 0) {
      s.frightened = 0;
      events.push({ type: 'expire', target: s.key, status: 'frightened' });
    }
  };
  const placeMark = (s: Side, key: string) => {
    s.uses.spells--;
    s.marked = key;
    events.push({ type: 'feature', feature: s.markFeature, target: key, ...tag(s) });
  };
  /** The Class's own power, called before the action: a Rage, a Divine smite, a Flurry of blows, a Wild shape, a Quickened spell. */
  const callPower = (s: Side) => {
    if (s.c.class === 'barbarian') startRage(s);
    // A smite waits for the turn's first hit and a Flurry for its attack: neither is spent without one.
    if (s.c.class === 'paladin') s.smiting = true;
    if (s.c.class === 'monk') s.flurry = true;
    if (s.c.class === 'sorcerer') s.quicken = true;
    if (s.c.class === 'druid') {
      s.uses.spells--;
      s.shaped = true;
      s.beast = wildShapeHealth(s.c.level, s.c.path);
      s.caster = false;
      events.push({ type: 'feature', feature: 'wild-shape', left: s.beast, ...tag(s) });
    }
  };
  /** Pulling a fallen partner up: a WIS check (Clerics proficient); on a success it stands with a quarter of its health. */
  const revive = (s: Side, p: Side) => {
    const roll = check(rng, { modifier: s.mod('wis') + (s.c.class === 'cleric' ? s.prof : 0), dc: REVIVE_DC, rerollOnes: s.rerollOnes });
    if (roll.success) {
      p.down = null;
      p.c.hp = Math.max(1, Math.floor(p.c.maxHp / 4));
    }
    events.push({ type: 'revive', target: p.key, natural: roll.roll.natural, total: roll.total, dc: REVIVE_DC, success: roll.success, hp: p.c.hp, ...tag(s) });
  };

  const heroTurn = (s: Side) => {
    const { c } = s;
    s.struckThisTurn = false;
    s.slewThisTurn = false;
    s.dodging = false;
    s.guarding = false;
    s.smiting = false;
    s.flurry = false;
    s.quicken = false;
    // Vengeance, Vow of enmity: sworn against the toughest monster of a hard fight.
    if (s.path('vengeance') && s.vowed === null && hardFight()) s.vowed = toughest()?.key ?? null;
    let stage: Stage = 'start';
    let action = decide(s, stage);
    if (action.rage) callPower(s);
    if (action.mark) placeMark(s, action.mark);
    // Abjurer: the ward mends by the INT modifier each turn, never past where it started.
    if (s.wardMax > 0 && s.ward < s.wardMax) {
      s.ward = Math.min(s.wardMax, s.ward + Math.max(1, s.intMod));
      events.push({ type: 'feature', feature: 'ward', left: s.ward, ...tag(s) });
    }
    for (;;) {
      switch (action.kind) {
        case 'second-wind':
          s.secondWind = false;
          heal(s, 'second-wind', sum(rollDice(rng, 1, 10)) + c.level);
          return;
        case 'cure': {
          const patient = sideOf(action.target ?? s.key)!;
          if (s.knuckle) s.knuckle = false;
          else s.uses.heals--;
          // A Paladin lays on hands; a Cleric, a Druid or a Bard (with CHA) casts Cure wounds.
          if (c.class === 'paladin') heal(patient, 'lay-on-hands', layOnHands(c.level) * (1 + c.healing / 100), s);
          else {
            const cure = sum(rollDice(rng, cureDice(c.level), 8)) + s.mod(c.class === 'bard' ? 'cha' : 'wis');
            heal(patient, 'cure-wounds', cure * s.lifeBoost * (1 + c.healing / 100), s);
          }
          if (!s.quickCure) return;
          s.quickCure = false;
          stage = 'after-cure';
          break;
        }
        case 'potion':
          s.potions--;
          s.potionsUsed++;
          heal(s, 'potion', potionHealing(rng, c.maxHp, herbalist(c)) * s.lifeBoost * (1 + c.healing / 100));
          // Thief: Fast hands drink potions without losing the turn.
          if (!s.path('thief')) return;
          stage = 'after-potion';
          break;
        case 'escape': {
          const roll = check(rng, escapeCheck(c, alive().length, input.escapeBonus ?? 0));
          events.push({ type: 'escape', natural: roll.roll.natural, total: roll.total, dc: roll.dc, success: roll.success, ...tag(s) });
          s.escaped = roll.success;
          return;
        }
        case 'burst': {
          s.uses.spells--;
          const dice = burstDice(c.level);
          const after: FightEvent[] = [];
          const lone = alive().length === 1 ? 2 : 1;
          const targets = alive().map((mm) => {
            const swarm = powerOf(mm, 'swarm') ? 2 : 1;
            const damage = Math.max(1, Math.round((sum(rollDice(rng, dice, 6)) + burstBonus(s)) * lone * swarm * burstFactor(s)));
            scorched.add(mm.key);
            after.push(...wound(mm, damage, false));
            return { key: mm.key, damage, hp: mm.hp };
          });
          events.push({ type: 'burst', actor: s.key, source: 'spell', targets }, ...after);
          markDefeated();
          return;
        }
        case 'dodge':
          s.dodging = true;
          events.push({ type: 'feature', feature: 'dodge', ...tag(s) });
          return;
        case 'help': {
          const partner = partnerOf(s)!;
          partner.helped = true;
          events.push({ type: 'feature', feature: 'help', target: partner.key, ...tag(s) });
          return;
        }
        case 'guard':
          s.guarding = true;
          events.push({ type: 'feature', feature: 'guard', target: partnerOf(s)!.key, ...tag(s) });
          return;
        case 'revive':
          revive(s, partnerOf(s)!);
          return;
        default: {
          let attacks = attacksFor(s);
          // Flurry of blows: a ki for another strike.
          if (s.flurry && s.uses.spells > 0) {
            s.uses.spells--;
            s.smote = true;
            s.flurrying = true;
            attacks += FLURRY_STRIKES;
            events.push({ type: 'feature', feature: 'flurry', ...tag(s) });
          }
          // Quickened spell: a sorcery point for a second attack spell.
          if (s.quicken && s.uses.spells > 0) {
            s.uses.spells--;
            attacks += 1;
            events.push({ type: 'feature', feature: 'quickened', ...tag(s) });
          }
          for (let i = 0; i < attacks && alive().length > 0 && c.hp > 0; i++) heroAttack(s, undefined, action.target);
          if (offHanded(s) && alive().length > 0 && c.hp > 0) heroAttack(s, undefined, action.target, true);
          s.flurrying = false;
          return;
        }
      }
      action = decide(s, stage);
    }
  };

  const monsterAttack = (mm: MonsterInstance, s: Side) => {
    const pack = powerOf(mm, 'pack') !== null && alive().some((other) => other !== mm);
    // Stung by a Vicious mockery or staggered by an Open Hand: its whole turn.
    const shaken = staggered.has(mm.key);
    const roll = rollD20(rng, {
      edge: combine(combine(combine(s.stance.defendEdge, pack ? 'advantage' : 'normal'), s.dodging ? 'disadvantage' : 'normal'), shaken ? 'disadvantage' : 'normal'),
    });
    let total = roll.natural + mm.attack;
    const crit = roll.natural === 20 && !s.c.uniques.includes('drowned-crown');
    // Bastion of the Fallen: 3 more Armor Class once its wearer is below half health.
    const ac = s.c.ac + (s.c.uniques.includes('bastion-plate') && s.c.hp < s.c.maxHp / 2 ? 3 : 0);
    let hit = roll.natural === 20 || (roll.natural !== 1 && total >= ac);
    // Cutting words: a Bard's inspiration die off the blow; spent only when it turns the blow aside.
    if (hit && roll.natural !== 20 && s.c.class === 'bard' && s.uses.spells > 0) {
      const die = rollDice(rng, 1, inspirationDie(s.c.level, s.c.path))[0]!;
      if (total - die < ac) {
        s.uses.spells--;
        total -= die;
        hit = false;
        events.push({ type: 'feature', feature: 'cutting-words', amount: die, target: mm.key, ...tag(s) });
      }
    }
    if (hit && (s.aegis || s.shield)) {
      const by: BlockedBy = s.aegis ? 'aegis' : s.shield!;
      if (s.aegis) s.aegis = false;
      else s.shield = null;
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
      if (s.bracers) {
        s.bracers = false;
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

    if (powerOf(mm, 'sunder') && s.sundered < SUNDER_MAX) {
      s.sundered++;
      s.c.ac--;
      events.push({ type: 'power', actor: mm.key, power: 'sunder', target: s.key, amount: s.sundered });
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
    // Nature's ward: a master of the Land shrugs poison off.
    if (poison && s.poisoned.turns === 0 && !s.path('land', PATH_MASTERY) && !heroSave(s, 'con', dcOf(mm, poison.dc))) {
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
    const pounce = currentRound === 1 && powerOf(mm, 'pounce') !== null;
    if (pounce && standing().length > 0) events.push({ type: 'power', actor: mm.key, power: 'pounce' });
    const attacks = (powerOf(mm, 'multiattack')?.attacks ?? 1) + (pounce ? 1 : 0);
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
        scorched.add(mm.key);
        const after = wound(mm, rolled, false);
        events.push({ type: 'tick', target: key, damage: rolled, hp: mm.hp }, ...after);
        markDefeated();
        if (mm.hp <= 0) return false;
      }
      if (fire.turns === 0) events.push({ type: 'expire', target: key, status: 'burning' });
    }
    if (!s) {
      const mm = mons.find((x) => x.key === key)!;
      const regen = powerOf(mm, 'regenerate');
      if (regen && !scorched.has(mm.key) && mm.hp > 0 && mm.hp < mm.maxHp) {
        const gained = Math.min(mm.maxHp - mm.hp, Math.max(1, Math.round(mm.maxHp * regen.share)));
        mm.hp += gained;
        events.push({ type: 'power', actor: mm.key, power: 'regenerate', amount: gained, hp: mm.hp });
      }
      scorched.delete(mm.key);
      return true;
    }
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
    // Trollheart: 3% of full health back at the start of every turn.
    if (s.c.uniques.includes('trollheart') && s.c.hp > 0 && s.c.hp < s.c.maxHp) {
      const gained = Math.min(s.c.maxHp - s.c.hp, Math.max(1, Math.round(s.c.maxHp * TROLLHEART_SHARE)));
      s.c.hp += gained;
      events.push({ type: 'feature', feature: 'survivor', amount: gained, hp: s.c.hp, ...tag(s) });
    }
    // Open Hand, Wholeness of body: once a fight, below half health.
    if (s.wholeness && s.c.hp > 0 && s.c.hp < s.c.maxHp / 2) {
      s.wholeness = false;
      heal(s, 'wholeness', WHOLENESS_PER_LEVEL * s.c.level);
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
  /** A Duo Hero falls: it stays down while its partner fights on, and makes a death save each turn. */
  const fall = (s: Side) => {
    events.push({ type: 'down', ...tag(s) });
    burning.delete(s.key);
    s.poisoned.turns = 0;
    s.held = 0;
    s.dodging = false;
    s.guarding = false;
    s.helped = false;
    s.down = { successes: 0, failures: 0 };
  };
  /** A fallen Duo Hero's turn: one death save; three of either settle it, and a natural 20 stands it up. */
  const deathSaveTurn = (s: Side) => {
    const d = s.down!;
    let { natural } = rollD20(rng, { rerollOnes: s.rerollOnes });
    if (natural < DEATH_SAVE_DC && s.runPowers.lucky && (s.c.talents.includes('lucky-charm') || s.c.uniques.includes('luckstone'))) {
      s.runPowers.lucky = false;
      events.push({ type: 'reroll', natural, ...tag(s) });
      natural = Math.max(natural, rollD20(rng, { rerollOnes: s.rerollOnes }).natural);
    }
    if (natural === 20) {
      s.down = null;
      s.c.hp = Math.max(1, Math.floor(s.c.maxHp / 4));
      events.push({ type: 'death-save', natural, successes: d.successes, failures: d.failures, ...tag(s) });
      events.push({ type: 'rise', hp: s.c.hp, ...tag(s) });
      return;
    }
    if (natural === 1) d.failures += 2;
    else if (natural >= DEATH_SAVE_DC) d.successes++;
    else d.failures++;
    events.push({ type: 'death-save', natural, successes: Math.min(d.successes, 3), failures: Math.min(d.failures, 3), ...tag(s) });
    if (d.successes >= 3) {
      s.c.hp = 1;
      s.out = 'survived';
    } else if (d.failures >= 3) s.out = 'dead';
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
  try {
    for (let round = 1; round <= ROUND_LIMIT && !over; round++) {
      currentRound = round;
      struckThisRound.clear();
      for (const s of sides) {
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
          if (s.out === null && s.down) deathSaveTurn(s);
          else if (s.out === null && s.c.hp > 0 && startTurn(key)) heroTurn(s);
        } else {
          const mm = mons.find((x) => x.key === key)!;
          if (mm.hp > 0 && !fled.has(mm.key) && startTurn(mm.key)) monsterTurn(mm);
          // A mockery or a stagger lasts until the end of the monster's next turn, used or not.
          staggered.delete(mm.key);
        }
        for (const x of sides) {
          if (x.out !== null) continue;
          if (x.escaped) x.out = 'escaped';
          else if (x.c.hp <= 0 && !x.down) {
            if (duo) fall(x);
            else {
              const save = input.spare ? spared(x) : deathSaves(x);
              if (save !== 'rise') x.out = save;
            }
          }
        }
        if (sides.every((x) => x.out !== null)) over = true;
        else if (alive().length === 0) over = won = true;
      }
      // The round is over: a Twin Warden that fell while its twin still stands rises again.
      for (const mm of over ? [] : mons) {
        const twin = mm.hp <= 0 && !fled.has(mm.key) && powerOf(mm, 'twin') ? alive().find((x) => powerOf(x, 'twin')) : undefined;
        if (!twin) continue;
        mm.hp = Math.max(1, Math.round(mm.maxHp * TWIN_RISE));
        if (defeated.includes(mm.key)) defeated.splice(defeated.indexOf(mm.key), 1);
        events.push({ type: 'power', actor: twin.key, power: 'twin', target: mm.key, hp: mm.hp });
      }
      for (const s of sides) {
        if (s.frightened > 0) {
          s.frightened--;
          if (s.frightened === 0 && !over) events.push({ type: 'expire', target: s.key, status: 'frightened' });
        }
      }
    }
  } catch (e) {
    if (e instanceof Pause) return { paused: true, events, turn: e.turn };
    throw e;
  }
  // A fight won by the Heroes still in it; one that runs out of rounds ends with them pulling back, alive.
  for (const s of sides) {
    // Still down at the end: its partner hauls it up.
    if (s.out === null && s.down) {
      s.down = null;
      s.c.hp = 1;
    }
    s.out ??= won ? 'victory' : 'survived';
  }
  // A Duo that wins hauls its fallen partner up: they stay and share the spoils.
  if (duo && won) for (const s of sides) if (s.out === 'survived') s.out = 'victory';
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

/** Rogues and Monks (Step of the wind) roll Escapes with advantage and their proficiency. */
const slippery = (hero: HeroCombat) => hero.class === 'rogue' || hero.class === 'monk';

const escapeBonus = (hero: HeroCombat) =>
  abilityModifier(hero.scores.dex) + (slippery(hero) ? proficiencyBonus(hero.level) : 0) + escapeSteps(hero.escape)
  + (hero.talents.includes('light-step') ? 2 : 0) + (onPath(hero, 'thief', PATH_MASTERY) ? 5 : 0)
  + (hero.uniques.includes('long-road-greaves') ? 5 : 0);

/** An Escape roll's difficulty (v0): the more monsters still standing, the harder. */
export const escapeDc = (monsters: number): number => 8 + 2 * monsters;

/** A DEX Check to get out of a fight. Rogues and Monks roll with advantage and add their proficiency. */
export function escapeCheck(hero: HeroCombat, monsters: number, bonus = 0): CheckInput {
  return {
    modifier: escapeBonus(hero) + bonus,
    dc: escapeDc(monsters),
    edge: slippery(hero) || hero.uniques.includes('long-road-greaves') ? 'advantage' : 'normal',
    rerollOnes: RACE_DEFS[hero.race].rerollOnes,
  };
}

/** Sneaking past a Room's monsters (v0): harder deeper down and with more of them. */
export const sneakDc = (floor: number, monsters: number): number => 10 + Math.floor(floor / 2) + 2 * (monsters - 1);

/**
 * The DEX Check to Sneak past. Rogues roll with advantage and add their
 * proficiency (Monks add theirs too, and a Shadow Monk rolls with advantage);
 * heavy armor gives disadvantage; escape Bonus stats help.
 */
export function sneakCheck(hero: HeroCombat, floor: number, monsters: number, bonus = 0): CheckInput {
  return {
    modifier: escapeBonus(hero) + bonus,
    dc: sneakDc(floor, monsters),
    edge: hero.heavyArmor && !hero.talents.includes('light-step') ? 'disadvantage'
      : hero.class === 'rogue' || onPath(hero, 'shadows') ? 'advantage' : 'normal',
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
