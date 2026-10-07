/**
 * Par Heroes: what an active Player typically has on first reaching each Floor,
 * measured by the playtest bots (apps/api/scripts/playtest.ts): a level of about
 * 1.5 × the Floor, and in every slot the best of several drops from the Floors
 * above, rolled like real drops, lightly Upgraded. Shared by the balance scripts.
 */
import {
  CLASS_DEFS, type ClassId, GEAR_BASES, type GearBase, type HeroCombat, type PathId, type WornForCombat, canUse, createRng, dropOdds,
  heroCombat, pathsOf, rollGear, rollTier, startingHealth, tierRank,
} from '../src/index.js';

export const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'ranger'] as const;
const SLOTS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring', 'ring'] as const;
const GROWTH = [4, 8, 12, 16, 19];

/** Level on first reaching a Floor (playtest v0). */
export const parLevel = (floor: number): number => Math.min(20, Math.max(1, Math.round(1.5 * floor - 0.5)));

/** Late in the Season: many more drops to pick from, and gold spent at the Forge. */
export interface Gearing { draws: number; upgrade: number }

/** Gear a Player would wear: usable, for a Fighter a STR weapon rather than a dagger or a bow, and for a Ranger a bow. */
const suits = (cls: ClassId, b: GearBase) => canUse(cls, b)
  && !(cls === 'fighter' && (b.weapon === 'dagger' || b.weapon === 'bow'))
  && !(cls === 'ranger' && b.slot === 'main' && b.weapon !== 'bow');

/** What a par Hero holds, to compare one way of fighting with another: weapons for each hand (an empty off-hand: none fits). */
export interface Build { main?: (b: GearBase) => boolean; off?: (b: GearBase) => boolean }

/** The bases a par Hero picks from for a slot: its Class's usual gear, or a Build's; a Rogue's off-hand holds a dagger. */
function choices(cls: ClassId, slot: (typeof SLOTS)[number], build?: Build): GearBase[] {
  const usable = GEAR_BASES.filter((b) => canUse(cls, b));
  if (slot === 'main' && build?.main) return usable.filter((b) => b.slot === 'main' && build.main!(b));
  if (slot === 'off' && build?.off) return usable.filter((b) => (b.slot === 'off' || b.light) && build.off!(b));
  if (slot === 'off') return usable.filter((b) => (b.slot === 'off' || (b.light && cls === 'rogue')) && suits(cls, b));
  return usable.filter((b) => b.slot === slot && suits(cls, b));
}

export function parHero(cls: ClassId, floor: number, level: number, pathIndex: number, seed: number, gearing?: Gearing, build?: Build): HeroCombat {
  const def = CLASS_DEFS[cls];
  const primary = def.primary;
  const grown = GROWTH.filter((l) => l <= level).length;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: Math.min(20, 16 + 2 * grown) };
  const perLevel = Math.ceil(def.hitDie / 2) + 1 + 2 + 2;
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * perLevel;
  // Drops so far come from the Floors above; the best usable one per slot is worn.
  const from = [Math.max(1, floor - 2), Math.max(1, floor - 1)] as const;
  const draws = gearing?.draws ?? 1 + floor;
  const worn: WornForCombat[] = [];
  let twoHanded = false;
  let ring = 0;
  for (const slot of SLOTS) {
    const bases = choices(cls, slot, build);
    if (bases.length === 0 || (slot === 'off' && twoHanded)) continue;
    const into = slot === 'ring' ? (ring++ === 0 ? 'ring1' : 'ring2') : slot;
    // Each slot rolls on its own, so holding other weapons leaves the rest of the gear as it was.
    const rng = createRng(`par-${cls}-${floor}-${level}-${pathIndex}-${seed}-${into}`);
    let best: (WornForCombat & { rank: number }) | null = null;
    for (let d = 0; d < draws; d++) {
      const itemLevel = rng.int(from[0], from[1]);
      const tier = rollTier(rng, dropOdds(itemLevel));
      const unique = tier === 'legendary' || tier === 'mythic';
      const roll = rollGear(rng, { tier, itemLevel, baseId: unique ? undefined : rng.pick(bases).id });
      if (!bases.some((b) => b.id === roll.base)) continue;
      const rank = tierRank(roll.tier) * 100 + roll.itemLevel;
      if (best === null || rank > best.rank) {
        best = { base: roll.base, slot: into, quality: roll.quality, upgrade: gearing?.upgrade ?? Math.floor(floor / 3), radiant: roll.radiant, bonusStats: roll.bonusStats, uniqueId: roll.uniqueId, rank };
      }
    }
    if (best) {
      worn.push(best);
      if (slot === 'main' && GEAR_BASES.find((b) => b.id === best!.base)?.hands === 2) twoHanded = true;
    }
  }
  const path: PathId | null = level >= 3 ? pathsOf(cls)[pathIndex]!.id : null;
  const h = heroCombat({ name: 'Par', class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}

/** A few par Heroes with different gear rolls, to even out luck. */
export const heroesAt = (cls: ClassId, floor: number, level = parLevel(floor), pathIndex = 0, gearing?: Gearing, seeds = 3, build?: Build): HeroCombat[] =>
  Array.from({ length: seeds }, (_, seed) => parHero(cls, floor, level, pathIndex, seed, gearing, build));
