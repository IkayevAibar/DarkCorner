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
 * Run: npm run balance:par -w @dark/engine [-- hp hit damage] (to try other MIGHT values) [paladin,monk] (only those Classes)
 */
import {
  type ClassId, type HeroCombat, MIGHT, THREATS, type ThreatId, createRng, fightOdds, pathsOf, restUses, simulateFight, spawnEncounter, threatOf,
} from '../src/index.js';
import { CLASSES, type Gearing, heroesAt as parHeroes, parLevel } from './par.js';

/** Several gear rolls per Floor, to even out luck. */
const GEAR_SEEDS = process.argv.includes('dragon') ? 8 : 3;
const ROOMS = 50;

const [hpArg, hitArg, damageArg] = process.argv.slice(2).filter((a) => a !== 'dragon' && !/^[a-z,-]+$/.test(a)).map(Number);
/** Only these Classes, when named (comma-separated). */
const only = process.argv.slice(2).find((a) => a !== 'dragon' && /^[a-z,-]+$/.test(a))?.split(',');
const classes = CLASSES.filter((c) => !only || only.includes(c));
if (hpArg !== undefined && !Number.isNaN(hpArg)) Object.assign(MIGHT, { hp: hpArg, hit: hitArg ?? MIGHT.hit, damage: damageArg ?? MIGHT.damage });

const heroesAt = (cls: ClassId, floor: number, level = parLevel(floor), pathIndex = 0, gearing?: Gearing) => parHeroes(cls, floor, level, pathIndex, gearing, GEAR_SEEDS);
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
for (const cls of onlyDragon ? [] : classes) {
  console.log(cls);
  for (let floor = 1; floor <= 10; floor++) {
    const heroes = heroesAt(cls, floor);
    const mini = floor < 10 ? `mini ${boss(heroes, floor, 'miniboss')}` : '';
    console.log(`  F${String(floor).padStart(2)} lv${String(heroes[0]!.level).padStart(2)} hp${String(avg(heroes, (h) => h.maxHp)).padStart(4)} ac${avg(heroes, (h) => h.ac)}  ${rooms(heroes, floor, `par-${cls}`)}  ${mini}`);
  }
}

console.log('\nThe Dragon at full strength, late-Season gear: best of 20 drops per slot from Floors 8-10, Upgraded +6 (each Path)');
for (const cls of classes) {
  for (const pathIndex of [0, 1]) {
    const cells = [15, 17, 19, 20].map((level) => `lv${level} ${boss(heroesAt(cls, 11, level, pathIndex, { draws: 20, upgrade: 6 }), 10, 'boss', 240)}`);
    console.log(`  ${`${cls} ${pathsOf(cls)[pathIndex]!.id}`.padEnd(18)} ${cells.join(' | ')}`);
  }
}
