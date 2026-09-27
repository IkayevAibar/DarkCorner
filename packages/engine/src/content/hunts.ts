import type { Rng } from '../rng.js';
import { KIN_NAMES, KIN_OF } from './bounties.js';
import { themeOf } from './floors.js';
import type { MonsterKin } from './monsters.js';
import { type Text, text } from './text.js';

/**
 * The Hunt (docs/design.md → The Hunt, v0): each week the whole server goes after
 * one kin of monster together, and everyone who helped shares the reward.
 */
export const HUNT_PER_HERO = 40;
/** Kills a Hero needs to share the reward. */
export const HUNT_MIN = 10;

/** This week's quarry: one of the kins living on the Floors down to where most Heroes are. */
export function huntKin(rng: Rng, depth: number): MonsterKin {
  const kins = new Set<MonsterKin>();
  for (let floor = 1; floor <= Math.min(10, Math.max(3, depth)); floor++) {
    for (const kin of KIN_OF[themeOf(floor)]) kins.add(kin);
  }
  return rng.pick([...kins]);
}

/**
 * How many the server must defeat: 40 for every Hero seen that week, never fewer than for
 * three, and only its share of that when the Hunt is posted with fewer than 7 days to go.
 */
export const huntTarget = (heroes: number, daysLeft = 7): number =>
  Math.max(HUNT_PER_HERO, Math.round((HUNT_PER_HERO * Math.max(3, heroes) * Math.min(7, Math.max(1, daysLeft))) / 7));

export const huntTitle = (kin: MonsterKin): Text => text(`The Hunt: ${KIN_NAMES[kin].en}`, `Охота на ${KIN_NAMES[kin].ru}`);
