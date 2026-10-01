import type { GearBase } from './bases.js';
import type { MonsterDef, MonsterKin } from './monsters.js';

// How a fighter lands its blows, so the fight scene can draw a sword's arc, an
// arrow's flight or a ghost's touch. Spells are the attack's own `kind`.

export const STRIKES = ['slash', 'pierce', 'blunt', 'shoot', 'bite', 'claw', 'touch'] as const;
export type Strike = (typeof STRIKES)[number];

const KIN_STRIKE: Record<MonsterKin, Strike> = {
  beast: 'bite', goblinoid: 'slash', undead: 'claw', demon: 'claw', dragonkin: 'bite', humanoid: 'pierce',
};

/** Monsters that don't fight the way their kin does. */
const MONSTER_STRIKE: Partial<Record<string, Strike>> = {
  'goblin-archer': 'shoot',
  'goblin-cutpurse': 'pierce',
  'goblin-sapper': 'blunt',
  'goblin-shaman': 'blunt',
  skeleton: 'slash',
  wraith: 'touch',
  banshee: 'touch',
  mummy: 'blunt',
  'bone-knight': 'slash',
  'flame-skull': 'bite',
  'grave-robber': 'blunt',
  'demon-brute': 'blunt',
  'chain-devil': 'slash',
  'horned-tyrant': 'slash',
  kobold: 'pierce',
  doppelganger: 'claw',
  'dawn-warden': 'blunt',
  'dusk-warden': 'slash',
};

export const monsterStrike = (def: Pick<MonsterDef, 'id' | 'kin'>): Strike => MONSTER_STRIKE[def.id] ?? KIN_STRIKE[def.kin];

/** A Hero strikes as its main weapon does: bows shoot; empty hands hit like a club. */
export function weaponStrike(base: Pick<GearBase, 'weapon' | 'hits'> | null | undefined): Strike {
  if (!base) return 'blunt';
  if (base.weapon === 'bow') return 'shoot';
  return base.hits === 'slash' ? 'slash' : base.hits === 'pierce' ? 'pierce' : 'blunt';
}
