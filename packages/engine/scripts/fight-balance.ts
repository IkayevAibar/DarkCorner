/**
 * Fight balance table: a fresh Hero of each Class at level = Floor, one fight
 * against that Floor's monsters, many times over. Run: npm run balance:fights -w @dark/engine
 * Tune monsters (content/monsters.ts) until early Floors are forgiving and deep ones bite.
 */
import {
  CLASS_DEFS, type ClassId, createRng, heroCombat, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

function starter(cls: ClassId, level: number) {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const perLevel = Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 1 + 2 + 2;
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * perLevel;
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'T', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
}

const N = 1500;
for (let floor = 1; floor <= 9; floor++) {
  const cells: string[] = [];
  for (const cls of ['fighter', 'rogue', 'wizard', 'cleric'] as const) {
    let wins = 0;
    let dead = 0;
    let hpLeft = 0;
    for (let i = 0; i < N; i++) {
      const hero = starter(cls, floor);
      const r = simulateFight(createRng(`${cls}-${floor}-${i}`), {
        hero,
        monsters: spawnEncounter(createRng(`spawn-${cls}-${floor}-${i}`), floor, 'fight'),
        uses: restUses(cls, floor),
        potions: 1,
        runPowers: { deathless: false, lucky: false },
      });
      if (r.outcome === 'victory') {
        wins++;
        hpLeft += r.hp / hero.maxHp;
      }
      if (r.outcome === 'dead') dead++;
    }
    const pct = (x: number) => `${Math.round((100 * x) / N)}%`.padStart(4);
    cells.push(`${cls.padEnd(7)} win ${pct(wins)} dead ${pct(dead)} hp left ${Math.round((100 * hpLeft) / Math.max(1, wins))}%`);
  }
  console.log(`floor ${floor} (lv ${floor}):  ${cells.join(' | ')}`);
}
