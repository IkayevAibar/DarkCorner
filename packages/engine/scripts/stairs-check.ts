/**
 * Can a Hero get from each Floor's landing to its stairs down without going
 * through the Mini-boss, a Vault, the Boss or a special Door? Checks many seeds.
 * Run: npx tsx packages/engine/scripts/stairs-check.ts [seed]
 */
import { type Floor, doorsOf, generateLabyrinth } from '../src/index.js';

const BLOCKING = new Set(['miniboss', 'vault', 'boss']);

/** Rooms reachable from the landing through open Doors, never entering a blocking Room. */
function reachable(floor: Floor): Set<number> {
  const seen = new Set([floor.landing]);
  const queue = [floor.landing];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const { door, to } of doorsOf(floor, cur)) {
      if (seen.has(to) || door.kind !== 'open' || BLOCKING.has(floor.rooms[to]!.type)) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

const seeds = process.argv[2] ? [process.argv[2]] : Array.from({ length: 200 }, (_, i) => `seed-${i}`);
const blocked = new Map<number, number>();
for (const seed of seeds) {
  const lab = generateLabyrinth(seed);
  for (const floor of lab.floors) {
    const stairs = floor.rooms.filter((r) => r.type === 'stairs');
    if (stairs.length === 0) continue;
    const ok = reachable(floor);
    if (!stairs.some((s) => ok.has(s.id))) {
      blocked.set(floor.number, (blocked.get(floor.number) ?? 0) + 1);
      if (seeds.length === 1) {
        const around = stairs.map((s) => doorsOf(floor, s.id).map(({ door, to }) => `${door.kind}->${floor.rooms[to]!.type}`).join(', '));
        console.log(`seed ${seed} Floor ${floor.number}: stairs ${stairs.map((s) => s.id).join(',')} cut off; around them: ${around.join(' | ')}`);
      }
    }
  }
}
console.log(`${seeds.length} seeds: Floors whose stairs can only be reached through a Mini-boss, Vault or special Door:`);
console.log([...blocked.entries()].sort((a, b) => a[0] - b[0]).map(([f, n]) => `F${f} ${n}`).join(', ') || 'none');
