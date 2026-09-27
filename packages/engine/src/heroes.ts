import { abilityModifier } from './abilities.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { RACE_DEFS, type RaceId } from './content/races.js';
import { TALENTS, type TalentId } from './content/talents.js';

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
  if (choices.talents.some((t) => !TALENTS.includes(t))) problems.push('unknown_talent');
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
