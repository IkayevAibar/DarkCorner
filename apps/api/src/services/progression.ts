import type { Hero } from '@prisma/client';
import {
  type Ability, CLASS_DEFS, type ClassId, MAX_LEVEL, RACE_DEFS, type RaceId, type Rng, abilityModifier, levelForXp,
  restUses, rollDie,
} from '@dark/engine';

/** Ability score increases come at these levels (SRD); v0 puts +2 into the Class's main ability. */
const ASI_LEVELS = new Set([4, 8, 12, 16, 19]);

export interface LevelUp {
  data: Partial<Pick<Hero, 'xp' | 'level' | 'maxHp' | 'hp' | 'spellUses' | 'healUses' | Ability>>;
  newLevel: number | null;
}

/**
 * Adds XP and applies every level gained: health rolls on the hit die (never
 * below its average), the main ability grows at 4, 8, 12, 16 and 19, and rest
 * uses grow with the level.
 */
export function gainXp(rng: Rng, hero: Hero, gained: number): LevelUp {
  const xp = hero.xp + gained;
  const target = Math.min(MAX_LEVEL, levelForXp(xp));
  if (target <= hero.level) return { data: { xp }, newLevel: null };

  const cls = CLASS_DEFS[hero.class as ClassId];
  const race = RACE_DEFS[hero.race as RaceId];
  const tough = hero.talents.includes('tough') ? 2 : 0;
  let maxHp = hero.maxHp;
  let hp = hero.hp;
  let primary = hero[cls.primary];
  for (let level = hero.level + 1; level <= target; level++) {
    if (ASI_LEVELS.has(level)) primary = Math.min(20, primary + 2);
    const con = cls.primary === 'con' ? primary : hero.con;
    const average = cls.hitDie / 2 + 1;
    const gain = Math.max(1, Math.max(average, rollDie(rng, cls.hitDie)) + abilityModifier(con) + race.hpPerLevel + tough);
    maxHp += gain;
    hp += gain;
  }
  const before = restUses(hero.class as ClassId, hero.level);
  const after = restUses(hero.class as ClassId, target);
  return {
    data: {
      xp,
      level: target,
      maxHp,
      hp,
      [cls.primary]: primary,
      spellUses: hero.spellUses + (after.spells - before.spells),
      healUses: hero.healUses + (after.heals - before.heals),
    },
    newLevel: target,
  };
}
