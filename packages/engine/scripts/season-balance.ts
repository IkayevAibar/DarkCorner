/**
 * Season loot simulation: 10 active Players for a whole Season, using the real
 * drop, Chest and Bad-luck rules and the LOOT rates the API uses. Checks the
 * targets in docs/design.md:
 *   - about one Legendary every 2–3 days for an active Player
 *   - 1–2 Mythics per Player per Season
 * Run: npm run balance:season -w @dark/engine
 *
 * The Player model is rough on purpose (v0): ~50 Moves a day, a third of them
 * back through Rooms already cleared, going one Floor deeper every 3 days, and
 * opening half the Chests found. Every fight is fought (Sneaking past and Retreating
 * would only lower the numbers), and an elite in the group drops one more Item.
 * The weekly Tavern bounty's Silver Chest is opened. Relics come from Vaults and
 * aren't modeled.
 */
import {
  BAD_LUCK_MAX, BAD_LUCK_PER_FIGHT, BAD_LUCK_PER_MINIBOSS, type ChestGrade, ELITE_CHANCE, LOOT, type Rng, type Tier, createRng, dropOdds,
  rollChestGrade, rollChestTier, rollLootTier, themeOf, tierRank,
} from '../src/index.js';

const PLAYERS = 10;
const DAYS = 40;
const MOVES_PER_DAY = 50;
/** Moves that walk back through cleared Rooms (to a Camp, a Waypoint, other stairs). */
const BACKTRACK = 0.33;
const DAYS_PER_FLOOR = 3;
// Room mix per fresh Room, as generated (fight 59%, empty 18%, event 14%, treasure 9%).
const FIGHT = 0.59;
const TREASURE = 0.09;
const EVENT = 0.14;
const RUNS = 20;

interface Tally { legendary: number; mythic: number; items: number; forced: number; chests: number }

const weighted = (rng: Rng, table: [number, number][]) => {
  let r = rng.next() * table.reduce((s, [, w]) => s + w, 0);
  return table.find(([, w]) => (r -= w) < 0)?.[0] ?? table[0]![0];
};

function simulatePlayer(rng: Rng): Tally {
  const tally: Tally = { legendary: 0, mythic: 0, items: 0, forced: 0, chests: 0 };
  let badLuck = 0;
  const count = (tier: Tier, forced = false) => {
    tally.items++;
    if (tier === 'legendary') tally.legendary++;
    if (tier === 'mythic') tally.mythic++;
    if (forced) tally.forced++;
  };
  const drop = (floor: number) => {
    const r = rollLootTier(rng, { odds: dropOdds(floor), magicFind: 5, badLuck });
    if (r.reset) badLuck = 0;
    count(r.tier, r.forced);
  };
  const chest = (floor: number) => {
    if (!rng.chance(0.5)) return; // half the Chests found get a Key
    const grade: ChestGrade = rollChestGrade(rng, floor);
    tally.chests++;
    const tier = rollChestTier(rng, grade);
    if (tierRank(tier) >= tierRank('legendary')) badLuck = 0;
    count(tier);
  };

  for (let day = 0; day < DAYS; day++) {
    const floor = Math.min(10, 1 + Math.floor(day / DAYS_PER_FLOOR));
    const moves = Math.max(10, Math.round(MOVES_PER_DAY + (rng.next() - 0.5) * 20));
    for (let m = 0; m < moves; m++) {
      if (rng.chance(BACKTRACK)) continue;
      const r = rng.next();
      if (r < FIGHT) {
        badLuck = Math.min(BAD_LUCK_MAX, badLuck + BAD_LUCK_PER_FIGHT);
        if (rng.chance(LOOT.fightDrop)) drop(floor);
        if (floor >= 2 && rng.chance(ELITE_CHANCE[themeOf(floor)])) drop(floor);
      } else if (r < FIGHT + TREASURE) {
        const items = weighted(rng, LOOT.treasureItems);
        for (let i = 0; i < items; i++) drop(floor);
        if (rng.chance(LOOT.treasureChest)) chest(floor);
      } else if (r < FIGHT + TREASURE + EVENT) {
        // About one Event in three gives an Item (three chests, caches, lucky bets).
        if (rng.chance(0.35)) drop(Math.min(10, floor + 3));
      }
    }
    // A weekly Tavern bounty pays a Silver Chest (its Key comes with it: opened).
    if (day % 7 === 6) {
      tally.chests++;
      const tier = rollChestTier(rng, 'silver');
      if (tierRank(tier) >= tierRank('legendary')) badLuck = 0;
      count(tier);
    }
    // One Mini-boss a day.
    badLuck = Math.min(BAD_LUCK_MAX, badLuck + BAD_LUCK_PER_MINIBOSS);
    for (let i = 0; i < LOOT.minibossItems; i++) drop(floor);
    if (rng.chance(LOOT.minibossChest)) chest(floor);
  }
  return tally;
}

const all: Tally[] = [];
for (let run = 0; run < RUNS; run++) {
  for (let p = 0; p < PLAYERS; p++) all.push(simulatePlayer(createRng(`season-${run}-${p}`)));
}
const avg = (f: (t: Tally) => number) => all.reduce((s, t) => s + f(t), 0) / all.length;

const legendaryEvery = DAYS / avg((t) => t.legendary);
const mythics = avg((t) => t.mythic);
console.log(`${RUNS} Seasons × ${PLAYERS} Players × ${DAYS} days, ~${MOVES_PER_DAY} Moves a day`);
console.log(`Items per Player per day:      ${(avg((t) => t.items) / DAYS).toFixed(1)}`);
console.log(`Chests opened per Player:      ${avg((t) => t.chests).toFixed(1)}`);
console.log(`Legendary every … days:        ${legendaryEvery.toFixed(2)}   (target 2–3)`);
console.log(`  forced by the meter:         ${((100 * avg((t) => t.forced)) / Math.max(1e-9, avg((t) => t.legendary + t.mythic))).toFixed(0)}%`);
console.log(`Mythics per Player per Season: ${mythics.toFixed(2)}   (target 1–2)`);
const ok = legendaryEvery >= 2 && legendaryEvery <= 3 && mythics >= 1 && mythics <= 2;
console.log(ok ? 'PASS: both targets met' : 'WARN: tune LOOT, DROP_ODDS, CHEST_ODDS or the Bad-luck meter');
process.exitCode = ok ? 0 : 1;
