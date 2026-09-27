/** Typical Bonus stat totals on a full set of par gear, by Floor. Run: npx tsx packages/engine/scripts/stat-check.ts */
import { BONUS_STATS, createRng, dropOdds, rollGear, rollTier } from '../src/index.js';

for (const floor of [3, 6, 9]) {
  const totals = new Map<string, number>();
  const RUNS = 200;
  for (let run = 0; run < RUNS; run++) {
    const rng = createRng(`stat-${floor}-${run}`);
    for (let slot = 0; slot < 9; slot++) {
      let best: ReturnType<typeof rollGear> | null = null;
      for (let d = 0; d < 1 + floor; d++) {
        const il = rng.int(Math.max(1, floor - 2), Math.max(1, floor - 1));
        const roll = rollGear(rng, { tier: rollTier(rng, dropOdds(il)), itemLevel: il });
        if (!best || roll.bonusStats.length > best.bonusStats.length) best = roll;
      }
      for (const b of best!.bonusStats) totals.set(b.stat, (totals.get(b.stat) ?? 0) + b.value);
    }
  }
  console.log(`F${floor}: ` + BONUS_STATS.map((d) => `${d.id} ${((totals.get(d.id) ?? 0) / RUNS).toFixed(1)}`).join(', '));
}
