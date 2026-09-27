import { type Ability, ABILITIES, abilityModifier } from './abilities.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import { ORIGIN_TALENTS, TALENTS, type TalentId } from './content/talents.js';
import { createRng } from './rng.js';

export const STAMINA_MAX = 20;
/** One Stamina point comes back every 24 minutes: an empty bar refills in 8 hours (v0). */
export const STAMINA_REFILL_MS = 24 * 60 * 1000;

export const BANNER_COLORS = ['#9e2a2a', '#3b5fa8', '#3f7a4a', '#b08a2e', '#6b3f8f', '#2f7f86', '#8a8a8a', '#c2682b'] as const;

/** Slots in the Bag (stacks count once) and in Storage (docs/design.md, v0). */
export const BAG_SLOTS = 20;
export const STORAGE_SLOTS = 60;

/** Gold a new Hero starts with (v0): enough for a few Keys or scrolls. */
export const STARTING_GOLD = 100;

/** Healing potions in every Starter kit. */
export const STARTER_POTIONS = 2;

/**
 * Health at level 1: the Class hit die at its maximum plus the CON modifier, as in
 * the SRD, plus the Dwarf's and Tough's per-level bonuses. Never below 1.
 */
export function startingHealth(classId: ClassId, raceId: RaceId, talents: readonly TalentId[], con: number): number {
  const perLevel = RACE_DEFS[raceId].hpPerLevel + (talents.includes('tough') ? 2 : 0);
  return Math.max(1, CLASS_DEFS[classId].hitDie + abilityModifier(con) + perLevel);
}

export interface HeroChoices {
  name: string;
  race: RaceId;
  class: ClassId;
  talents: TalentId[];
}

/** Problems with a creation request, as stable codes. Empty means valid. */
export function validateHeroChoices(choices: HeroChoices): string[] {
  const problems: string[] = [];
  const name = choices.name.trim();
  if (name.length < 2 || name.length > 20) problems.push('name_length');
  if (!/^[\p{L}\p{N}' -]+$/u.test(name)) problems.push('name_characters');
  if (!(choices.race in RACE_DEFS)) problems.push('unknown_race');
  if (!(choices.class in CLASS_DEFS)) problems.push('unknown_class');
  const picks = RACE_DEFS[choices.race]?.talentPicks ?? 1;
  const unique = new Set(choices.talents);
  if (choices.talents.length !== picks || unique.size !== picks) problems.push('talent_count');
  if (choices.talents.some((t) => !(ORIGIN_TALENTS as readonly string[]).includes(t))) problems.push('unknown_talent');
  return problems;
}

/** Stamina now, counting points that came back since it was last saved. */
export function currentStamina(saved: number, savedAt: Date, now: Date): { stamina: number; savedAt: Date } {
  if (saved >= STAMINA_MAX) return { stamina: STAMINA_MAX, savedAt: now };
  const gained = Math.floor((now.getTime() - savedAt.getTime()) / STAMINA_REFILL_MS);
  if (gained <= 0) return { stamina: saved, savedAt };
  const stamina = Math.min(STAMINA_MAX, saved + gained);
  // Keep the unspent part of the current 24 minutes, unless the bar is full.
  const next = stamina >= STAMINA_MAX ? now : new Date(savedAt.getTime() + gained * STAMINA_REFILL_MS);
  return { stamina, savedAt: next };
}

// ─── Growing ──────────────────────────────────────────────────────────────

/**
 * Levels where a Hero grows (the SRD's ability score increase levels): +2 to one
 * ability, +1 to two, or a new Talent (docs/design.md → Growing, v0).
 */
export const GROWTH_LEVELS = [4, 8, 12, 16, 19] as const;
export const TALENTS_OFFERED = 3;
export const ABILITY_CAP = 20;

export type GrowthChoice =
  | { kind: 'ability'; ability: Ability }
  | { kind: 'abilities'; abilities: [Ability, Ability] }
  | { kind: 'talent'; talent: TalentId };
export type Growth = GrowthChoice & { level: number };

/** Growth levels reached and not yet chosen, lowest first. */
export function pendingGrowth(level: number, growths: readonly Pick<Growth, 'level'>[]): number[] {
  return GROWTH_LEVELS.filter((l) => l <= level && !growths.some((g) => g.level === l));
}

/** The Talents offered at one growth level: three the Hero lacks, the same every time it looks. */
export function talentOffer(heroId: string, level: number, owned: readonly TalentId[]): TalentId[] {
  const rng = createRng(`${heroId}:talents:${level}`);
  const pool = TALENTS.filter((t) => !owned.includes(t));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, TALENTS_OFFERED);
}

/** Problems with a growth choice, as stable codes. Empty means valid. */
export function validateGrowth(choice: GrowthChoice, scores: Record<Ability, number>, offer: readonly TalentId[]): string[] {
  switch (choice.kind) {
    case 'ability':
      if (!ABILITIES.includes(choice.ability)) return ['unknown_ability'];
      return scores[choice.ability] + 2 > ABILITY_CAP ? ['ability_cap'] : [];
    case 'abilities': {
      const [a, b] = choice.abilities;
      if (!ABILITIES.includes(a) || !ABILITIES.includes(b)) return ['unknown_ability'];
      if (a === b) return ['same_ability'];
      return scores[a] + 1 > ABILITY_CAP || scores[b] + 1 > ABILITY_CAP ? ['ability_cap'] : [];
    }
    case 'talent':
      return offer.includes(choice.talent) ? [] : ['not_offered'];
  }
}

