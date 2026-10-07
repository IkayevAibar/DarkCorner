/**
 * How honest is the Threat label? For a spread of Heroes and Rooms, compares the
 * Threat a Player would be shown with the real death rate over many fights.
 * Run: npx tsx packages/engine/scripts/threat-check.ts
 */
import {
  CLASSES, CLASS_DEFS, type ClassId, THREATS, type ThreatId, createRng, fightOdds, heroCombat, restUses, simulateFight, spawnEncounter, startingHealth,
  kitSlots, threatOf,
} from '../src/index.js';

const REAL = 2000;
const shown = new Map<ThreatId, { fights: number; deaths: number; downs: number }>(THREATS.map((t) => [t, { fights: 0, deaths: 0, downs: 0 }]));

for (const cls of CLASSES as readonly ClassId[]) {
  for (let floor = 1; floor <= 6; floor++) {
    for (const level of [floor, floor + 2, floor + 4]) {
      for (let room = 0; room < 12; room++) {
        const primary = CLASS_DEFS[cls].primary;
        const scores = { str: 13, dex: 13, con: 13, int: 10, wis: 12, cha: 10, [primary]: 16 };
        const maxHp = startingHealth(cls, 'human', ['alert'], scores.con) + (level - 1) * (CLASS_DEFS[cls].hitDie / 2 + 1);
        const kit = CLASS_DEFS[cls].starterKit;
        const slots = kitSlots(kit);
        const worn = kit.flatMap((base, i) => (slots[i] ? [{ base, slot: slots[i], quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }] : []));
        const hero = heroCombat({ name: 'T', class: cls, race: 'human', level, talents: ['alert'], path: null, scores, maxHp, hp: maxHp, worn });
        const monsters = spawnEncounter(createRng(`${cls}-${floor}-${level}-${room}`), floor, 'fight');
        const input = { hero, monsters, uses: restUses(cls, level), potions: 1, runPowers: { deathless: false, lucky: false }, stance: 'bold' as const };
        const threat = threatOf(fightOdds(`${cls}-${floor}-${level}-${room}:threat`, input));
        const tally = shown.get(threat)!;
        for (let i = 0; i < REAL; i++) {
          const r = simulateFight(createRng(`${cls}-${floor}-${level}-${room}:real:${i}`), input);
          tally.fights++;
          if (r.outcome === 'dead') tally.deaths++;
          if (r.events.some((e) => e.type === 'down')) tally.downs++;
        }
      }
    }
  }
}

console.log('Threat shown → what really happened');
for (const [threat, t] of shown) {
  if (t.fights === 0) continue;
  console.log(`${threat.padEnd(10)} rooms ${String(t.fights / REAL).padStart(4)}  death ${(100 * t.deaths / t.fights).toFixed(2).padStart(6)}%  down ${(100 * t.downs / t.fights).toFixed(2).padStart(6)}%`);
}
