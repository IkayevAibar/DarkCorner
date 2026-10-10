import type { Hero, Item } from '@prisma/client';
import { type ClassId, type PathId, SHORT_RESTS, STAMINA_MAX, restUses } from '@dark/engine';
import { fullHealth } from './heroes.js';

/**
 * Solo: what a night's sleep gives back, at the Tavern or in a Camp
 * (docs/plan-solo-offline.md → Days): full health, every use, Stamina and both
 * short rests, all counted from the morning the Hero wakes to. A night costs
 * nothing: it is how the Day passes, and waking always brings full Stamina.
 */
export function wokenRested(hero: Hero & { items: Item[] }, morning: Date) {
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  return {
    hp: fullHealth(hero), hpAt: morning, spellUses: uses.spells, healUses: uses.heals,
    stamina: STAMINA_MAX, staminaAt: morning, shortRests: SHORT_RESTS, shortRestsAt: morning,
  };
}
