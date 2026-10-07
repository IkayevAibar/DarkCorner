/**
 * Weapons in hand (docs/design.md → Hands): for each Class, every sensible way to hold
 * its weapons, as par Heroes (scripts/par.ts) on a few Floors, against those Floors'
 * Mini-bosses, and against the Dragon with late-Season gear. A two-handed weapon should
 * stand level with a one-hander and a shield, and a dagger in each hand shouldn't beat both.
 * Run: npm run balance:hands -w @dark/engine
 */
import { type ClassId, type GearBase, type HeroCombat, createRng, restUses, simulateFight, spawnEncounter } from '../src/index.js';
import { type Build, heroesAt } from './par.js';

const SEEDS = 16;
const ROOMS = 60;
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);

const oneHand = (b: GearBase) => b.hands !== 2 && !b.light && b.weapon !== 'bow' && b.weapon !== 'staff';
const BUILDS: Partial<Record<ClassId, Record<string, Build>>> = {
  fighter: {
    'one-hander + shield': { main: oneHand, off: (b) => b.offHand === 'shield' },
    'two-hander': { main: (b) => b.weapon === 'heavy', off: () => false },
    'one-hander + dagger': { main: oneHand, off: (b) => Boolean(b.light) },
    'dagger + dagger': { main: (b) => Boolean(b.light), off: (b) => Boolean(b.light) },
  },
  barbarian: {
    'one-hander + shield': { main: oneHand, off: (b) => b.offHand === 'shield' },
    'two-hander': { main: (b) => b.weapon === 'heavy', off: () => false },
  },
  rogue: {
    'blade alone': { main: (b) => b.weapon === 'blade', off: () => false },
    'blade + dagger': { main: (b) => b.weapon === 'blade', off: (b) => Boolean(b.light) },
    'dagger + dagger': { main: (b) => Boolean(b.light), off: (b) => Boolean(b.light) },
    bow: { main: (b) => b.weapon === 'bow', off: () => false },
  },
  ranger: {
    bow: { main: (b) => b.weapon === 'bow', off: () => false },
    'blade + shield': { main: (b) => b.weapon === 'blade', off: (b) => b.offHand === 'shield' },
    'blade + dagger': { main: (b) => b.weapon === 'blade', off: (b) => Boolean(b.light) },
    'dagger + dagger': { main: (b) => Boolean(b.light), off: (b) => Boolean(b.light) },
  },
};

function rooms(heroes: HeroCombat[], floor: number, label: string) {
  let dead = 0;
  let lost = 0;
  let won = 0;
  const all = ROOMS * heroes.length;
  for (let room = 0; room < all; room++) {
    const hero = heroes[room % heroes.length]!;
    const monsters = spawnEncounter(createRng(`hands-${floor}-${room}`), floor, 'fight');
    const r = simulateFight(createRng(`${label}-${floor}-${room}`), {
      hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'bold',
    });
    if (r.outcome === 'dead') dead++;
    if (r.outcome === 'victory') {
      won++;
      lost += 1 - r.hp / hero.maxHp;
    }
  }
  return `dead ${pct(dead / all)} hp lost ${pct(lost / Math.max(1, won))}`;
}

function boss(heroes: HeroCombat[], floor: number, kind: 'miniboss' | 'boss', label: string, n = 200) {
  let win = 0;
  const monsters = spawnEncounter(createRng(`hands-${kind}-${floor}`), floor, kind);
  for (let i = 0; i < n; i++) {
    const hero = heroes[i % heroes.length]!;
    const r = simulateFight(createRng(`${label}-${kind}-${floor}-${i}`), {
      hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'bold',
    });
    if (r.outcome === 'victory') win++;
  }
  return `${kind === 'boss' ? 'Dragon' : 'mini'} ${pct(win / n)}`;
}

const avg = (heroes: HeroCombat[], f: (h: HeroCombat) => number) => Math.round(heroes.reduce((s, h) => s + f(h), 0) / heroes.length);

console.log('Par Heroes holding their weapons each way: Floor Rooms (dead, health lost), Mini-boss wins, and the Dragon (lv20, late gear, +6)');
for (const [cls, builds] of Object.entries(BUILDS) as [ClassId, Record<string, Build>][]) {
  console.log(cls);
  for (const [name, build] of Object.entries(builds)) {
    const cells = [3, 6, 9].map((floor) => {
      const heroes = heroesAt(cls, floor, undefined, 0, undefined, SEEDS, build);
      return `F${floor} ac${avg(heroes, (h) => h.ac)} ${rooms(heroes, floor, `${cls}-${name}`)} ${boss(heroes, floor, 'miniboss', `${cls}-${name}`)}`;
    });
    const late = [0, 1].map((path) => boss(heroesAt(cls, 11, 20, path, { draws: 20, upgrade: 6 }, SEEDS, build), 10, 'boss', `${cls}-${name}-${path}`, 480));
    console.log(`  ${name.padEnd(20)} ${cells.join(' | ')} | ${late.join(' ')}`);
  }
}
