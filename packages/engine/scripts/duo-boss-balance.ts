/**
 * Mini-bosses for a Duo against Mini-bosses alone, with par Heroes (balance:par: what an
 * active Player has on first reaching a Floor), every Hero played by the AI. Target
 * (docs/design.md → Duos): a pair dies about as often as each of them alone. Nobody runs
 * in a Duo fight, so it wins more often than a Hero alone, which sometimes retreats.
 * Run: npm run balance:duo-boss -w @dark/engine [-- <boss hp> <boss damage>]
 */
import { type ClassId, DUO, type HeroCombat, type MonsterInstance, createRng, duoEncounter, restUses, simulateFight, spawnEncounter } from '../src/index.js';
import { heroesAt, parLevel } from './par.js';

// Try other tuning for the Duo's Mini-boss: its extra health and damage.
const [bossHp, bossDamage] = process.argv.slice(2).map(Number);
if (bossHp) DUO.bossHp = bossHp;
if (bossDamage) DUO.bossDamage = bossDamage;

const FIGHTS = 240;
const PAIRS: [ClassId, ClassId][] = [
  ['fighter', 'wizard'], ['rogue', 'cleric'], ['barbarian', 'ranger'], ['fighter', 'cleric'], ['wizard', 'rogue'],
  ['paladin', 'bard'], ['monk', 'druid'], ['warlock', 'sorcerer'],
];
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
const side = (h: HeroCombat) => ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'steady' as const });

console.log(`Par Heroes, Steady, 3 potions each, on Auto. Duo Mini-boss: health x${DUO.bossHp} more, damage x${DUO.bossDamage}. Per Hero: wins, deaths.`);
const total = { solo: { win: 0, dead: 0, n: 0 }, duo: { win: 0, dead: 0, n: 0 } };
for (const [a, b] of PAIRS) {
  console.log(`${a} + ${b}`);
  for (let floor = 1; floor <= 9; floor++) {
    const pa = heroesAt(a, floor, parLevel(floor), 0, undefined, 3);
    const pb = heroesAt(b, floor, parLevel(floor), 0, undefined, 3);
    const solo = { win: 0, dead: 0 };
    const duo = { win: 0, dead: 0 };
    for (let i = 0; i < FIGHTS; i++) {
      const ha = pa[i % pa.length]!;
      const hb = pb[i % pb.length]!;
      for (const h of [ha, hb]) {
        const monsters: MonsterInstance[] = spawnEncounter(createRng(`smb:${floor}:${i}`), floor, 'miniboss');
        const r = simulateFight(createRng(`solo:${floor}:${i}:${h.class}`), { ...side(h), monsters });
        if (r.outcome === 'victory') solo.win++;
        if (r.outcome === 'dead') solo.dead++;
      }
      const r = simulateFight(createRng(`duo:${floor}:${i}:${a}${b}`), { ...side(ha), monsters: duoEncounter(createRng(`dmb:${floor}:${i}`), floor, 'miniboss'), ally: side(hb) });
      for (const o of [r.outcome, r.ally!.outcome]) {
        if (o === 'victory') duo.win++;
        if (o === 'dead') duo.dead++;
      }
    }
    const n = 2 * FIGHTS;
    for (const [k, v] of [['solo', solo], ['duo', duo]] as const) {
      total[k].win += v.win;
      total[k].dead += v.dead;
      total[k].n += n;
    }
    console.log(`  F${floor}  alone win ${pct(solo.win / n)} dead ${pct(solo.dead / n)}  |  Duo win ${pct(duo.win / n)} dead ${pct(duo.dead / n)}`);
  }
}
console.log(`All: alone win ${pct(total.solo.win / total.solo.n)} dead ${pct(total.solo.dead / total.solo.n)}  |  Duo win ${pct(total.duo.win / total.duo.n)} dead ${pct(total.duo.dead / total.duo.n)}`);
