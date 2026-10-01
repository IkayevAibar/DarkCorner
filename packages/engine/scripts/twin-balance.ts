/**
 * The Twin Wardens against Duos of par Heroes (balance:par: what an active Player has on
 * reaching a Floor), both played by the AI, beside the same pairs against their Floor's
 * Duo Mini-boss and Duo fight Rooms. Target (docs/design.md → Twin doors): the
 * Wardens are a Duo's hardest fight on a Floor, about as deadly as its Mini-boss, and
 * longer, since only both falling in one round ends them.
 * Run: npm run balance:twins -w @dark/engine [-- <hp scale> <damage scale>]
 */
import { type ClassId, type HeroCombat, type MonsterInstance, WARDENS, createRng, duoEncounter, restUses, simulateFight, spawnEncounter } from '../src/index.js';
import { heroesAt, parLevel } from './par.js';

// Try other Warden numbers: scales every theme's health and damage bonus.
const [hpScale, damageScale] = process.argv.slice(2).map(Number);
for (const stats of Object.values(WARDENS)) {
  if (hpScale) stats.hp = Math.round(stats.hp * hpScale);
  if (damageScale) stats.damage = [stats.damage[0], stats.damage[1], Math.round(stats.damage[2] * damageScale)];
}

const FIGHTS = 300;
const PAIRS: [ClassId, ClassId][] = [['fighter', 'wizard'], ['rogue', 'cleric'], ['barbarian', 'ranger'], ['fighter', 'cleric']];
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
const side = (h: HeroCombat) => ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 3, runPowers: { deathless: false, lucky: false }, stance: 'steady' as const });

console.log('Par Heroes, Steady, 3 potions each, both Heroes on Auto. Per Hero: wins and deaths; per Warden fight, how often a Warden rose.');
for (const [a, b] of PAIRS) {
  console.log(`${a} + ${b}`);
  for (let floor = 1; floor <= 9; floor++) {
    const pa = heroesAt(a, floor, parLevel(floor), 0, undefined, 3);
    const pb = heroesAt(b, floor, parLevel(floor), 0, undefined, 3);
    const run = (spawn: (i: number) => MonsterInstance[]) => {
      let win = 0, dead = 0, rises = 0;
      for (let i = 0; i < FIGHTS; i++) {
        const r = simulateFight(createRng(`twin:${floor}:${i}:${a}${b}`), { ...side(pa[i % pa.length]!), monsters: spawn(i), ally: side(pb[i % pb.length]!) });
        for (const o of [r.outcome, r.ally!.outcome]) {
          if (o === 'victory') win++;
          if (o === 'dead') dead++;
        }
        rises += r.events.filter((e) => e.type === 'power' && e.power === 'twin').length;
      }
      return { win: win / (2 * FIGHTS), dead: dead / (2 * FIGHTS), rises: rises / FIGHTS };
    };
    const twins = run(() => spawnEncounter(createRng('wardens'), floor, 'twin'));
    const boss = run((i) => duoEncounter(createRng(`mb:${floor}:${i}`), floor, 'miniboss'));
    // The same Heroes each alone against their Floor's Mini-boss: the hardest fight a Hero meets alone.
    let soloWin = 0, soloDead = 0;
    for (let i = 0; i < FIGHTS; i++) {
      for (const h of [pa[i % pa.length]!, pb[i % pb.length]!]) {
        const r = simulateFight(createRng(`solo:${floor}:${i}:${h.class}`), { ...side(h), monsters: spawnEncounter(createRng(`smb:${floor}:${i}`), floor, 'miniboss') });
        if (r.outcome === 'victory') soloWin++;
        if (r.outcome === 'dead') soloDead++;
      }
    }
    console.log(`  F${floor}  Wardens win ${pct(twins.win)} dead ${pct(twins.dead)} rises ${twins.rises.toFixed(1)}  |  Duo Mini-boss win ${pct(boss.win)} dead ${pct(boss.dead)}  |  alone: Mini-boss win ${pct(soloWin / (2 * FIGHTS))} dead ${pct(soloDead / (2 * FIGHTS))}`);
  }
}
