import { abilityModifier } from './abilities.js';
import { type GearBase, baseById, isGear } from './content/bases.js';
import { CLASS_DEFS, type ClassId } from './content/classes.js';
import { RADIANT_BOOST } from './content/loot.js';
import { qualityFactor } from './items.js';

/** Whether a Class has the Proficiency for a piece of gear (docs/design.md → Proficiencies). */
export function canUse(cls: ClassId, base: GearBase): boolean {
  const def = CLASS_DEFS[cls];
  if (base.weapon) return def.weapons.includes(base.weapon);
  if (base.offHand) return def.offHands.includes(base.offHand);
  if (base.armor) return def.armor.includes(base.armor);
  return true;
}

/** Each Forge Upgrade level adds 4% to base damage or armor (v0). */
export const UPGRADE_STEP = 0.04;

export interface WornGear {
  base: string;
  quality: number | null;
  upgrade: number;
  radiant: boolean;
  bonusStats: { stat: string; value: number }[];
}

/** How much of a piece's armor counts once Quality, Upgrades and Radiant are applied. */
function scaledArmor(base: GearBase, gear: WornGear, above: number): number {
  const factor = qualityFactor(gear.quality ?? 50) * (1 + UPGRADE_STEP * gear.upgrade) * (gear.radiant ? RADIANT_BOOST : 1);
  return Math.round((base.ac! - above) * factor);
}

/**
 * Armor Class, SRD-style: body armor's base (or 10 unarmored) plus as much DEX as
 * the armor allows, plus shield and helm, plus "+N armor" Bonus stats.
 * Quality and Upgrades scale only the part of body armor above 10.
 */
export function armorClass(dexScore: number, worn: WornGear[]): number {
  const dex = abilityModifier(dexScore);
  let ac = 10 + dex;
  for (const gear of worn) {
    const base = baseById(gear.base);
    if (!isGear(base)) continue;
    if (base.slot === 'body' && base.ac !== undefined) {
      ac = 10 + scaledArmor(base, gear, 10) + Math.min(dex, base.maxDex ?? Infinity);
    }
  }
  for (const gear of worn) {
    const base = baseById(gear.base);
    if (!isGear(base)) continue;
    if (base.slot !== 'body' && base.ac !== undefined) ac += Math.max(1, scaledArmor(base, gear, 0));
    for (const bonus of gear.bonusStats) {
      if (bonus.stat === 'armor') ac += gear.radiant ? Math.round(bonus.value * RADIANT_BOOST) : bonus.value;
    }
  }
  return ac;
}
