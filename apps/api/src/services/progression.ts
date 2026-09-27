import type { Hero, Prisma, Season } from '@prisma/client';
import {
  type Ability, CLASS_DEFS, type ClassId, MAX_LEVEL, type PathId, RACE_DEFS, type RaceId, type Rng, abilityModifier, lateJoinerBoost,
  levelForXp, medianLevel, restUses, rollDie,
} from '@dark/engine';

/**
 * Extra XP for Heroes who joined late: +25% per full week after the Season
 * started, up to +100%, until they reach the Season's median level
 * (docs/design.md → Seasons, Late joiners). Returns the XP to add.
 */
export async function boostedXp(tx: Prisma.TransactionClient, hero: Hero, season: Season, gained: number): Promise<number> {
  const boost = lateJoinerBoost(season.startsAt, hero.createdAt);
  if (boost === 0 || gained === 0) return gained;
  const levels = await tx.hero.findMany({ where: { seasonId: season.id, retiredAt: null }, select: { level: true } });
  if (hero.level >= medianLevel(levels.map((l) => l.level))) return gained;
  return Math.round(gained * (1 + boost));
}

export interface LevelUp {
  data: Partial<Pick<Hero, 'xp' | 'level' | 'maxHp' | 'hp' | 'spellUses' | 'healUses' | Ability>>;
  newLevel: number | null;
}

/**
 * Adds XP and applies every level gained: health rolls on the hit die (never
 * below its average), and rest uses grow with the level. The Player chooses
 * what else grows (a Path at 3, abilities or a Talent at 4, 8, 12, 16 and 19).
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
  for (let level = hero.level + 1; level <= target; level++) {
    const average = cls.hitDie / 2 + 1;
    const gain = Math.max(1, Math.max(average, rollDie(rng, cls.hitDie)) + abilityModifier(hero.con) + race.hpPerLevel + tough);
    maxHp += gain;
    hp += gain;
  }
  const path = hero.path as PathId | null;
  const before = restUses(hero.class as ClassId, hero.level, path);
  const after = restUses(hero.class as ClassId, target, path);
  return {
    data: {
      xp,
      level: target,
      maxHp,
      hp,
      spellUses: hero.spellUses + (after.spells - before.spells),
      healUses: hero.healUses + (after.heals - before.heals),
    },
    newLevel: target,
  };
}
