/**
 * Fight balance table: a fresh Hero of each Class at level = Floor, one fight
 * against that Floor's monsters, many times over, in one Stance (Steady unless
 * named). Run: npm run balance:fights -w @dark/engine [-- bold|steady|wary]
 * Tune monsters (content/monsters.ts) until early Floors are forgiving and deep ones bite.
 */
import {
  CLASS_DEFS, type ClassId, STANCES, type StanceId, createRng, heroCombat, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

const stance = (process.argv[2] ?? 'steady') as StanceId;
if (!STANCES.includes(stance)) throw new Error(`unknown Stance "${stance}": use ${STANCES.join(', ')}`);

function starter(cls: ClassId, level: number) {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const perLevel = Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 1 + 2 + 2;
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * perLevel;
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'T', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
}

const N = 1500;
console.log(`Stance: ${stance}`);
for (let floor = 1; floor <= 9; floor++) {
  const cells: string[] = [];
  for (const cls of ['fighter', 'rogue', 'wizard', 'cleric'] as const) {
    let wins = 0;
    let dead = 0;
    let away = 0;
    let hpLeft = 0;
    for (let i = 0; i < N; i++) {
      const hero = starter(cls, floor);
      const r = simulateFight(createRng(`${cls}-${floor}-${i}`), {
        hero,
        monsters: spawnEncounter(createRng(`spawn-${cls}-${floor}-${i}`), floor, 'fight'),
        uses: restUses(cls, floor),
        potions: 1,
        runPowers: { deathless: false, lucky: false },
        stance,
      });
      if (r.outcome === 'victory') {
        wins++;
        hpLeft += r.hp / hero.maxHp;
      }
      if (r.outcome === 'dead') dead++;
      if (r.outcome === 'escaped') away++;
    }
    const pct = (x: number) => `${Math.round((100 * x) / N)}%`.padStart(4);
    cells.push(`${cls.padEnd(7)} win ${pct(wins)} ran ${pct(away)} dead ${pct(dead)} hp ${Math.round((100 * hpLeft) / Math.max(1, wins))}%`);
  }
  console.log(`floor ${floor} (lv ${floor}):  ${cells.join(' | ')}`);
}
