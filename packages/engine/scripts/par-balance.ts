/**
 * Par Heroes: what an active Player typically has on first reaching each Floor,
 * measured by the playtest bots (apps/api/scripts/playtest.ts): a level of about
 * 1.5 × the Floor, and in every slot the best of several drops from the Floors
 * above, rolled like real drops, lightly Upgraded. Each Floor's fight Rooms, its
 * Mini-boss and the Dragon are fought in Bold, the Hero's raw power.
 *
 * Targets (docs/design.md → Monsters): on the Floor a par Hero just reached,
 * most Rooms read Easy or Risky with some Trivial and a few Dangerous; its
 * Mini-boss is a real fight; the Dragon is out of reach until late levels.
 * Run: npm run balance:par -w @dark/engine [-- hp hit damage] (to try other MIGHT values)
 */
import {
  CLASS_DEFS, type ClassId, GEAR_BASES, type GearBase, type HeroCombat, MIGHT, type PathId, THREATS, type ThreatId, type WornForCombat, canUse, createRng, dropOdds,
  fightOdds, heroCombat, pathsOf, restUses, rollGear, rollTier, simulateFight, spawnEncounter, startingHealth, threatOf, tierRank,
} from '../src/index.js';

const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric'] as const;
const SLOTS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring', 'ring'] as const;
const GROWTH = [4, 8, 12, 16, 19];
/** Several gear rolls per Floor, to even out luck. */
const GEAR_SEEDS = onlyDragonRun() ? 8 : 3;
function onlyDragonRun() { return process.argv.includes('dragon'); }
const ROOMS = 50;

const [hpArg, hitArg, damageArg] = process.argv.slice(2).filter((a) => a !== 'dragon').map(Number);
if (hpArg !== undefined && !Number.isNaN(hpArg)) Object.assign(MIGHT, { hp: hpArg, hit: hitArg ?? MIGHT.hit, damage: damageArg ?? MIGHT.damage });

/** Level on first reaching a Floor (playtest v0). */
export const parLevel = (floor: number): number => Math.min(20, Math.max(1, Math.round(1.5 * floor - 0.5)));

/** Late in the Season: many more drops to pick from, and gold spent at the Forge. */
interface Gearing { draws: number; upgrade: number }

/** Gear a Player would wear: usable, and for a Fighter a STR weapon rather than a dagger or a bow. */
const suits = (cls: ClassId, b: GearBase) => canUse(cls, b) && !(cls === 'fighter' && (b.weapon === 'dagger' || b.weapon === 'bow'));

function parHero(cls: ClassId, floor: number, level: number, pathIndex: number, seed: number, gearing?: Gearing): HeroCombat {
  const rng = createRng(`par-${cls}-${floor}-${level}-${pathIndex}-${seed}`);
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
  for (const slot of SLOTS) {
    const bases = GEAR_BASES.filter((b) => b.slot === slot && suits(cls, b));
    if (bases.length === 0 || (slot === 'off' && twoHanded)) continue;
    let best: (WornForCombat & { rank: number }) | null = null;
    for (let d = 0; d < draws; d++) {
      const itemLevel = rng.int(from[0], from[1]);
      const tier = rollTier(rng, dropOdds(itemLevel));
      const unique = tier === 'legendary' || tier === 'mythic';
      const roll = rollGear(rng, { tier, itemLevel, baseId: unique ? undefined : rng.pick(bases).id });
      const base = GEAR_BASES.find((b) => b.id === roll.base)!;
      if (base.slot !== slot || !suits(cls, base)) continue;
      const rank = tierRank(roll.tier) * 100 + roll.itemLevel;
      if (best === null || rank > best.rank) {
        best = { base: roll.base, quality: roll.quality, upgrade: gearing?.upgrade ?? Math.floor(floor / 3), radiant: roll.radiant, bonusStats: roll.bonusStats, uniqueId: roll.uniqueId, rank };
      }
    }
    if (best) {
      worn.push(best);
      if (slot === 'main' && GEAR_BASES.find((b) => b.id === best!.base)?.weapon === 'heavy') twoHanded = true;
    }
  }
  const path: PathId | null = level >= 3 ? pathsOf(cls)[pathIndex]!.id : null;
  const h = heroCombat({ name: 'Par', class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}

const heroesAt = (cls: ClassId, floor: number, level = parLevel(floor), pathIndex = 0, gearing?: Gearing) =>
  Array.from({ length: GEAR_SEEDS }, (_, seed) => parHero(cls, floor, level, pathIndex, seed, gearing));
const onlyDragon = process.argv.includes('dragon');
const avg = (heroes: HeroCombat[], f: (h: HeroCombat) => number) => Math.round(heroes.reduce((s, h) => s + f(h), 0) / heroes.length);
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);

function rooms(heroes: HeroCombat[], floor: number, label: string) {
  const threats = Object.fromEntries(THREATS.map((t) => [t, 0])) as Record<ThreatId, number>;
  let dead = 0;
  let lost = 0;
  let won = 0;
  const all = ROOMS * heroes.length;
  for (let room = 0; room < all; room++) {
    const hero = heroes[room % heroes.length]!;
    const monsters = spawnEncounter(createRng(`${label}-${floor}-${room}`), floor, 'fight');
    const input = { hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'bold' as const };
    threats[threatOf(fightOdds(`${label}-${floor}-${room}:threat`, input))]++;
    const r = simulateFight(createRng(`${label}-${floor}-${room}:real`), input);
    if (r.outcome === 'dead') dead++;
    if (r.outcome === 'victory') {
      won++;
      lost += 1 - r.hp / hero.maxHp;
    }
  }
  const spread = THREATS.map((t) => `${t.slice(0, 4)} ${pct(threats[t] / all)}`).join(' ');
  return `${spread} | dead ${pct(dead / all)} | hp lost ${pct(lost / Math.max(1, won))}`;
}

function boss(heroes: HeroCombat[], floor: number, kind: 'miniboss' | 'boss', n = 200) {
  let win = 0;
  let dead = 0;
  const monsters = spawnEncounter(createRng(`par-${kind}-${floor}`), floor, kind);
  for (let i = 0; i < n; i++) {
    const hero = heroes[i % heroes.length]!;
    const r = simulateFight(createRng(`par-${kind}-${floor}-${hero.class}-${i}`), {
      hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'bold',
    });
    if (r.outcome === 'victory') win++;
    if (r.outcome === 'dead') dead++;
  }
  return `win ${pct(win / n)} dead ${pct(dead / n)}`;
}

console.log(`Par Heroes (level about 1.5 x Floor, best of the drops so far), Bold, 3 potions; MIGHT ${JSON.stringify(MIGHT)}`);
for (const cls of onlyDragon ? [] : CLASSES) {
  console.log(cls);
  for (let floor = 1; floor <= 10; floor++) {
    const heroes = heroesAt(cls, floor);
    const mini = floor < 10 ? `mini ${boss(heroes, floor, 'miniboss')}` : '';
    console.log(`  F${String(floor).padStart(2)} lv${String(heroes[0]!.level).padStart(2)} hp${String(avg(heroes, (h) => h.maxHp)).padStart(4)} ac${avg(heroes, (h) => h.ac)}  ${rooms(heroes, floor, `par-${cls}`)}  ${mini}`);
  }
}

console.log('\nThe Dragon at full strength, late-Season gear: best of 20 drops per slot from Floors 8-10, Upgraded +6 (each Path)');
for (const cls of CLASSES) {
  for (const pathIndex of [0, 1]) {
    const cells = [15, 17, 19, 20].map((level) => `lv${level} ${boss(heroesAt(cls, 11, level, pathIndex, { draws: 20, upgrade: 6 }), 10, 'boss', 240)}`);
    console.log(`  ${`${cls} ${pathsOf(cls)[pathIndex]!.id}`.padEnd(18)} ${cells.join(' | ')}`);
  }
}
