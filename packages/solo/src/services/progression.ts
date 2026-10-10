import type { Hero, Prisma, Season } from '@prisma/client';
import { COMPANION_PLAYER } from './companion.js';
import {
  type ClassId, MAX_LEVEL, type PathId, type RaceId, type Rng, type TalentId, lateJoinerBoost, levelForXp, medianLevel, restUses,
  rollLevelHealth,
} from '@dark/engine';

/**
 * Extra XP for Heroes who joined late: +25% per full week after the Season
 * started, up to +100%, until they reach the Season's median level
 * (docs/design.md → Seasons, Late joiners). Returns the XP to add.
 */
export async function boostedXp(tx: Prisma.TransactionClient, hero: Hero, season: Season, gained: number): Promise<number> {
  const boost = lateJoinerBoost(season.startsAt, hero.createdAt);
  if (boost === 0 || gained === 0) return gained;
  // A Companion is no Hero of the Season's (companion.ts).
  const levels = await tx.hero.findMany({ where: { seasonId: season.id, retiredAt: null, playerId: { not: COMPANION_PLAYER } }, select: { level: true } });
  if (hero.level >= medianLevel(levels.map((l) => l.level))) return gained;
  return Math.round(gained * (1 + boost));
}

export interface XpGain {
  data: Pick<Hero, 'xp'>;
  /** The level this XP made ready for the first time, or null. */
  newLevel: number | null;
}

/**
 * Adds XP. Levels wait for the Player, who takes each one on the level-up
 * screen and sees what it gives (docs/design.md → Levels): the report only says
 * that a new one is ready.
 */
export function gainXp(hero: Pick<Hero, 'xp' | 'level'>, gained: number): XpGain {
  const xp = hero.xp + gained;
  const ready = Math.min(MAX_LEVEL, levelForXp(xp));
  const before = Math.max(hero.level, Math.min(MAX_LEVEL, levelForXp(hero.xp)));
  return { data: { xp }, newLevel: ready > before ? ready : null };
}

/** Whether the Hero has the XP for its next level. */
export const levelReady = (hero: Pick<Hero, 'xp' | 'level'>): boolean => hero.level < MAX_LEVEL && levelForXp(hero.xp) > hero.level;

/**
 * One level up: health rolls on the Hit Die (never below its average), and rest
 * uses grow with the level. The level's choice (a Path, or abilities or a
 * Talent) is applied by the caller in the same transaction.
 */
export function raiseLevel(rng: Rng, hero: Hero): { data: Prisma.HeroUpdateInput; health: { roll: number; gain: number } } {
  const cls = hero.class as ClassId;
  const path = hero.path as PathId | null;
  const level = hero.level + 1;
  const health = rollLevelHealth(rng, { class: cls, race: hero.race as RaceId, con: hero.con, talents: hero.talents as TalentId[] });
  const before = restUses(cls, hero.level, path);
  const after = restUses(cls, level, path);
  return {
    data: {
      level,
      maxHp: { increment: health.gain },
      hp: { increment: health.gain },
      spellUses: { increment: after.spells - before.spells },
      healUses: { increment: after.heals - before.heals },
    },
    health,
  };
}
