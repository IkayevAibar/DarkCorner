import type { Season } from '@prisma/client';
import type { OmenDef } from '@dark/engine';
import { worldSettings } from '../settings.js';
import type { WorldSettings } from '../world.js';
import { omenOf } from './omens.js';
import { gameNow } from '../gameClock.js';

/**
 * Story, Normal or Hard (docs/plan-solo-offline.md, decision 5): how much health
 * monsters have and how hard they hit. Normal is the server's own numbers, for a
 * Hero alone. *(v0)*
 */
export const DIFFICULTY: Record<WorldSettings['difficulty'], { monsterHp: number; monsterDamage: number }> = {
  story: { monsterHp: 0.75, monsterDamage: 0.75 },
  normal: { monsterHp: 1, monsterDamage: 1 },
  hard: { monsterHp: 1.25, monsterDamage: 1.25 },
};

/**
 * The day's Omen as monsters feel it: with the Save's difficulty on top. Only where
 * monsters are made; the Omen the Player reads stays the day's own.
 */
export function monsterOmen(season: Pick<Season, 'seed' | 'status'>, now = gameNow()): OmenDef | null {
  const omen = omenOf(season, now);
  const d = DIFFICULTY[worldSettings().difficulty];
  if (d.monsterHp === 1 && d.monsterDamage === 1) return omen;
  // A plain day still has the difficulty: an Omen with nothing else to it.
  const base = omen ?? ({ id: 'plain', name: { en: '', ru: '' }, description: { en: '', ru: '' } } as unknown as OmenDef);
  return { ...base, monsterHp: (omen?.monsterHp ?? 1) * d.monsterHp, monsterDamage: (omen?.monsterDamage ?? 1) * d.monsterDamage };
}
