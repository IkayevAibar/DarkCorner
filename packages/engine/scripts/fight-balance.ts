/**
 * Fight balance tables, many fights each, in one Stance (Steady unless named):
 * - a fresh Hero of each Class at level = Floor in its Starter kit, against that Floor's fight Rooms;
 * - Mini-bosses with their escorts, against a Hero a level up in decent gear;
 * - the Dragon at full strength and weakened, against level 18–20 Heroes in endgame gear.
 * Run: npm run balance:fights -w @dark/engine [-- bold|steady|wary]
 * Tune monsters (content/monsters.ts) until early Floors are forgiving and deep ones bite.
 */
import {
  CLASS_DEFS, type ClassId, type HeroCombat, type MonsterInstance, type PathId, STANCES, type StanceId, createRng, heroCombat, pathsOf, restUses,
  simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

const stance = (process.argv[2] ?? 'steady') as StanceId;
if (!STANCES.includes(stance)) throw new Error(`unknown Stance "${stance}": use ${STANCES.join(', ')}`);
const CLASSES = ['fighter', 'rogue', 'wizard', 'cleric'] as const;

type Gear = 'starter' | 'decent' | 'endgame';

/** A Hero of a Class and level: its Starter kit, or the same bases better rolled, upgraded and with Bonus stats. */
function hero(cls: ClassId, level: number, gear: Gear = 'starter', path: PathId | null = null): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: gear === 'endgame' ? 20 : 16 };
  const perLevel = Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 1 + 2 + 2;
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * perLevel;
  const rolled = {
    starter: { quality: 50, upgrade: 0, bonusStats: [] },
    decent: { quality: 70, upgrade: 3, bonusStats: [{ stat: 'damage', value: 12 }, { stat: 'spellPower', value: 12 }, { stat: 'maxHp', value: 20 }, { stat: 'armor', value: 1 }, { stat: 'crit', value: 3 }] },
    endgame: { quality: 90, upgrade: 7, bonusStats: [{ stat: 'damage', value: 40 }, { stat: 'spellPower', value: 40 }, { stat: 'maxHp', value: 90 }, { stat: 'armor', value: 4 }, { stat: 'crit', value: 10 }, { stat: 'con', value: 4 }] },
  }[gear];
  const worn = CLASS_DEFS[cls].starterKit.map((base, i) => ({
    base, quality: rolled.quality, upgrade: rolled.upgrade, radiant: false, bonusStats: i === 0 ? rolled.bonusStats : [], uniqueId: null,
  }));
  const h = heroCombat({ name: 'T', class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}

const pct = (x: number, n: number) => `${Math.round((100 * x) / n)}%`.padStart(4);

/** Runs `n` fights and prints one cell per Class. */
function row(label: string, n: number, make: (cls: ClassId, i: number) => { hero: HeroCombat; monsters: MonsterInstance[]; potions: number }, classes: readonly ClassId[] = CLASSES) {
  const cells: string[] = [];
  for (const cls of classes) {
    let wins = 0;
    let dead = 0;
    let away = 0;
    let hpLeft = 0;
    for (let i = 0; i < n; i++) {
      const { hero: h, monsters, potions } = make(cls, i);
      const r = simulateFight(createRng(`${label}-${cls}-${i}`), {
        hero: h, monsters, uses: restUses(cls, h.level, h.path), potions, runPowers: { deathless: false, lucky: false }, stance,
      });
      if (r.outcome === 'victory') {
        wins++;
        hpLeft += r.hp / h.maxHp;
      }
      if (r.outcome === 'dead') dead++;
      if (r.outcome === 'escaped') away++;
    }
    cells.push(`${cls.padEnd(7)} win ${pct(wins, n)} ran ${pct(away, n)} dead ${pct(dead, n)} hp ${Math.round((100 * hpLeft) / Math.max(1, wins))}%`);
  }
  console.log(`${label.padEnd(22)} ${cells.join(' | ')}`);
}

console.log(`Stance: ${stance}\n\nFight Rooms, level = Floor, Starter kit, 1 potion`);
for (let floor = 1; floor <= 9; floor++) {
  row(`floor ${floor} (lv ${floor})`, 1500, (cls, i) => ({
    hero: hero(cls, floor),
    monsters: spawnEncounter(createRng(`spawn-${cls}-${floor}-${i}`), floor, 'fight'),
    potions: 1,
  }));
}

console.log('\nMini-bosses and escorts, a level up, decent gear, 3 potions');
for (const floor of [2, 3, 5, 6, 8, 9]) {
  row(`miniboss F${floor} (lv ${floor + 1})`, 600, (cls) => ({
    hero: hero(cls, floor + 1, 'decent'),
    monsters: spawnEncounter(createRng('miniboss'), floor, 'miniboss'),
    potions: 3,
  }));
}

console.log('\nThe Dragon, endgame gear, 5 potions');
for (const [level, weakening] of [[18, 0], [20, 0], [20, 0.2], [20, 0.4]] as const) {
  row(`dragon lv ${level} −${Math.round(weakening * 100)}%`, 400, (cls) => ({
    hero: hero(cls, level, 'endgame'),
    monsters: spawnEncounter(createRng('boss'), 10, 'boss', weakening),
    potions: 5,
  }));
}

console.log('\nPaths: the Floor 8 Mini-boss at level 9 in decent gear, and the full-strength Dragon at levels 16 and 20 in endgame gear');
for (const cls of CLASSES) {
  for (const path of [null, ...pathsOf(cls).map((p) => p.id)]) {
    const label = `${cls} ${path ?? '(no Path)'}`;
    row(`${label} F8`, 400, () => ({ hero: hero(cls, 9, 'decent', path), monsters: spawnEncounter(createRng('miniboss'), 8, 'miniboss'), potions: 3 }), [cls]);
    row(`${label} dragon lv16`, 300, () => ({ hero: hero(cls, 16, 'endgame', path), monsters: spawnEncounter(createRng('boss'), 10, 'boss'), potions: 5 }), [cls]);
    row(`${label} dragon lv20`, 300, () => ({ hero: hero(cls, 20, 'endgame', path), monsters: spawnEncounter(createRng('boss'), 10, 'boss'), potions: 5 }), [cls]);
  }
}
