/**
 * Duos with Starter-kit Heroes: a pair against Duo Rooms beside each of them alone in
 * ordinary Rooms, Floor by Floor, both played by the AI. Target (docs/design.md → Duos):
 * a pair wins and dies about as often as a Hero alone, and each Hero earns a little more XP.
 * Run: npm run balance:duo -w @dark/engine
 */
import {
  CLASS_DEFS, type ClassId, DUO, type HeroCombat, createRng, duoEncounter, heroCombat, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

// Try other tuning: npm run balance:duo -w @dark/engine -- <extra> <hp> <damage>
const [extra, hp, damage] = process.argv.slice(2).map(Number);
if (extra) DUO.extra = extra;
if (hp) DUO.hp = hp;
if (damage) DUO.damage = damage;

/** A level-N Hero of a Class in its Starter kit (as balance:fights): where fights are close. */
function starter(cls: ClassId, level: number): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const h = heroCombat({ name: 'T', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}
const heroesAt = (cls: ClassId, floor: number) => [starter(cls, floor)];

const FIGHTS = 300;
const PAIRS: [ClassId, ClassId][] = [['fighter', 'wizard'], ['rogue', 'cleric'], ['barbarian', 'ranger']];
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
const side = (h: HeroCombat) => ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'steady' as const });

console.log(`Starter kits, level = Floor, Steady, 3 potions each. Solo: each Hero alone in an ordinary Room. Duo: the pair in a Duo Room (extra ${DUO.extra}, health ×${DUO.hp}/${DUO.deepHp}, damage ×${DUO.damage}/${DUO.deepDamage} before/from Floor ${DUO.deepFrom}, XP per Hero at a ${DUO.share} share).`);
for (const [a, b] of PAIRS) {
  console.log(`${a} + ${b}`);
  for (let floor = 1; floor <= 9; floor++) {
    const heroesA = heroesAt(a, floor);
    const heroesB = heroesAt(b, floor);
    let soloWin = 0, soloDead = 0, soloXp = 0, duoWin = 0, duoDead = 0, duoXp = 0;
    for (let i = 0; i < FIGHTS; i++) {
      const ha = heroesA[i % heroesA.length]!;
      const hb = heroesB[i % heroesB.length]!;
      for (const h of [ha, hb]) {
        const r = simulateFight(createRng(`solo:${floor}:${i}:${h.class}`), { ...side(h), monsters: spawnEncounter(createRng(`m:${floor}:${i}:${h.class}`), floor, 'fight') });
        if (r.outcome === 'victory') { soloWin++; soloXp += r.xp; }
        if (r.outcome === 'dead') soloDead++;
      }
      const monsters = duoEncounter(createRng(`dm:${floor}:${i}`), floor, 'fight');
      const r = simulateFight(createRng(`duo:${floor}:${i}`), { ...side(ha), monsters, ally: side(hb) });
      for (const o of [r.outcome, r.ally!.outcome]) {
        if (o === 'victory') { duoWin++; duoXp += r.xp * DUO.share; }
        if (o === 'dead') duoDead++;
      }
    }
    const n = FIGHTS * 2;
    console.log(`  F${floor}  solo win ${pct(soloWin / n)} dead ${pct(soloDead / n)} xp ${Math.round(soloXp / Math.max(1, soloWin))}  |  duo win ${pct(duoWin / n)} dead ${pct(duoDead / n)} xp ${Math.round(duoXp / Math.max(1, duoWin))}`);
  }
}
