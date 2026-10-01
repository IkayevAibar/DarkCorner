import { abilityModifier } from './abilities.js';
import { type GearBase, baseById, isGear } from './content/bases.js';
import { CLASSES, CLASS_DEFS, type ClassId } from './content/classes.js';
import { RADIANT_BOOST } from './content/loot.js';
import { type StatGear, qualityFactor, statTotal, upgradeSteps } from './items.js';

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

export interface WornGear extends StatGear {
  base: string;
  quality: number | null;
  upgrade: number;
}

type Scaling = Pick<WornGear, 'quality' | 'upgrade' | 'radiant'>;

/** How Quality, Forge Upgrades and Radiant scale a piece's weapon dice or armor. */
export const gearFactor = (gear: Scaling): number =>
  qualityFactor(gear.quality ?? 50) * (1 + UPGRADE_STEP * gear.upgrade) * (gear.radiant ? RADIANT_BOOST : 1);

/** How much of a piece's armor counts once Quality, Upgrades and Radiant are applied. */
function scaledArmor(base: GearBase, gear: Scaling, above: number): number {
  return Math.round((base.ac! - above) * gearFactor(gear));
}

export interface GearFacts {
  slot: GearBase['slot'];
  /** Proficiency group; null when anyone may wear it. */
  group: string | null;
  /** The Classes that may wear it; null means all of them. */
  classes: ClassId[] | null;
  /** Weapon dice before the ability modifier, and the range once scaled. */
  damage: { dice: number; sides: number; min: number; max: number; percent: number; hits: NonNullable<GearBase['hits']> } | null;
  /** Body armor: Armor Class before DEX and the most DEX that counts (null: all). Others: what they add. */
  armor: { ac: number; body: boolean; maxDex: number | null } | null;
  /** Heavy body armor: Sneaking at disadvantage. */
  heavy: boolean;
}

/** What a piece of gear does in a fight, by the numbers the fights use. */
export function gearFacts(base: GearBase, gear: Scaling): GearFacts {
  const factor = gearFactor(gear);
  const classes = CLASSES.filter((c) => canUse(c, base));
  const [dice, sides] = base.damage ?? [0, 0];
  return {
    slot: base.slot,
    group: base.weapon ?? base.offHand ?? base.armor ?? null,
    classes: classes.length === CLASSES.length ? null : classes,
    damage: base.damage
      ? { dice, sides, min: Math.max(1, Math.round(dice * factor)), max: Math.round(dice * sides * factor), percent: Math.round(factor * 100), hits: base.hits ?? 'bludgeon' }
      : null,
    armor: base.ac === undefined ? null
      : base.slot === 'body'
        ? { ac: 10 + scaledArmor(base, gear, 10), body: true, maxDex: base.maxDex === undefined || base.maxDex === Infinity ? null : base.maxDex }
        : { ac: Math.max(1, scaledArmor(base, gear, 0)) + upgradeSteps(gear.upgrade), body: false, maxDex: null },
    heavy: base.slot === 'body' && base.armor === 'heavy',
  };
}

/**
 * Armor Class, SRD-style: body armor's base (or 10 unarmored) plus as much DEX as
 * the armor allows, plus shield and helm, plus "+N armor" Bonus stats.
 * Quality and Upgrades scale only the part of body armor above 10; a helm's or
 * shield's armor gains +1 at each Upgrade milestone instead.
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
    if (base.slot !== 'body' && base.ac !== undefined) ac += Math.max(1, scaledArmor(base, gear, 0)) + upgradeSteps(gear.upgrade);
  }
  return ac + statTotal(worn, 'armor');
}
