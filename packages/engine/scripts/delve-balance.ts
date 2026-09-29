/**
 * The Daily Delve with par Heroes (scripts/par.ts): how many Rooms they win when they
 * always go on, and the score of a careful Player who stops before a Deadly Room (or
 * a Dangerous one when hurt). Boons: Mend when below half health, else the first
 * lasting one on offer. Target (docs/design.md → The Daily Delve): a par Hero wins
 * about half the Rooms going all in, rarely clears all six, and the careful Player's
 * score is close to the bold one's, so stopping is a real choice.
 * Run: npm run balance:delve -w @dark/engine
 */
import {
  type BoonId, DELVE_POTIONS, DELVE_ROOMS, type DelveEnd, type HeroCombat, createRng, delveEncounter, delveFloor, delveOffer, delveScore,
  fightOdds, restUses, simulateFight, takeBoon, threatOf, withBoons,
} from '../src/index.js';
import { CLASSES, heroesAt } from './par.js';

const DAYS = 40;
const LASTING: BoonId[] = ['ward', 'whetstone', 'keen', 'leech'];

function delve(hero: HeroCombat, bestFloor: number, day: number, careful: boolean) {
  const seed = `balance:delve:${day}`;
  const floor = delveFloor(bestFloor, hero.level);
  const full = { maxHp: hero.maxHp, uses: restUses(hero.class, hero.level, hero.path) };
  let state = { hp: hero.maxHp, potions: DELVE_POTIONS, uses: full.uses };
  let runPowers = { deathless: true, lucky: true };
  const boons: BoonId[] = [];
  let rooms = 0;
  let end: DelveEnd | null = null;
  for (let room = 0; room < DELVE_ROOMS && end === null; room++) {
    if (room > 0) {
      const offer = delveOffer(seed, room);
      const pick = state.hp < hero.maxHp / 2 && offer.includes('mend') ? 'mend' : (offer.find((b) => LASTING.includes(b)) ?? offer[0]);
      state = takeBoon(state, pick, full);
      boons.push(pick);
    }
    const input = {
      hero: withBoons({ ...hero, hp: state.hp }, boons), monsters: delveEncounter(seed, floor, room, null),
      uses: state.uses, potions: state.potions, runPowers, stance: 'steady' as const,
    };
    if (careful && room > 0) {
      const threat = threatOf(fightOdds(`${seed}:threat:${room}`, input));
      if (threat === 'deadly' || (threat === 'dangerous' && state.hp < hero.maxHp * 0.6)) {
        end = 'stopped';
        break;
      }
    }
    const r = simulateFight(createRng(`${seed}:${hero.class}:${room}`), input);
    state = { hp: r.hp, potions: state.potions - r.potionsUsed, uses: r.uses };
    runPowers = r.runPowers;
    if (r.outcome === 'victory') rooms++;
    else end = r.outcome === 'escaped' ? 'fled' : 'fell';
  }
  end ??= rooms === DELVE_ROOMS ? 'cleared' : 'stopped';
  return { rooms, end, score: delveScore(rooms, state.hp, hero.maxHp, end) };
}

const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
console.log(`Par Heroes in the Daily Delve, ${DAYS} days each, Steady. Bold = always goes on; careful = stops before Deadly (or Dangerous when hurt).`);
for (const cls of CLASSES) {
  console.log(cls);
  for (let floor = 1; floor <= 10; floor++) {
    const heroes = heroesAt(cls, floor);
    const bold = heroes.flatMap((h) => Array.from({ length: DAYS }, (_, day) => delve(h, floor, day, false)));
    const careful = heroes.flatMap((h) => Array.from({ length: DAYS }, (_, day) => delve(h, floor, day, true)));
    const avg = (list: { rooms: number; score: number }[], f: (x: { rooms: number; score: number }) => number) => list.reduce((s, x) => s + f(x), 0) / list.length;
    const share = (end: DelveEnd) => bold.filter((d) => d.end === end).length / bold.length;
    console.log(`  F${String(floor).padStart(2)} lv${String(heroes[0]!.level).padStart(2)}  bold: rooms ${avg(bold, (d) => d.rooms).toFixed(1)} cleared ${pct(share('cleared'))} fell ${pct(share('fell'))} score ${Math.round(avg(bold, (d) => d.score))}  | careful: rooms ${avg(careful, (d) => d.rooms).toFixed(1)} score ${Math.round(avg(careful, (d) => d.score))}`);
  }
}
