/**
 * What the Heroes left in the test database by a playtest can beat: every Floor's
 * fight Rooms, its Mini-boss, and the Dragon, with their real gear, many fights each.
 * Run after `npm run playtest -w @dark/api`: npm run power-check -w @dark/api
 */
import { type ClassId, type FightOutcome, type PathId, type ThreatId, createRng, fightOdds, restUses, simulateFight, spawnEncounter, threatOf } from '@dark/engine';
import { TEST_DATABASE_URL } from '../test/test-db.js';

process.env.DATABASE_URL = TEST_DATABASE_URL;
const { prisma } = await import('../src/db.js');
const { combatOf, fightInput } = await import('../src/services/fights.js');

const ROOMS = 150;
const heroes = await prisma.hero.findMany({ where: { retiredAt: null }, include: { items: true }, orderBy: { name: 'asc' } });
const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);

for (const hero of heroes) {
  // At full health with three potions and every rest use, as after a trip to the City.
  const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
  const full = { ...hero, hp: 99_999, spellUses: uses.spells, healUses: uses.heals };
  const combat = combatOf(full as typeof hero);
  const worn = hero.items.filter((i) => i.place === 'WORN').map((i) => `${i.tier[0]!.toUpperCase()}${i.upgrade ? `+${i.upgrade}` : ''}`);
  console.log(`\n${hero.name} (${hero.class}, ${hero.path ?? 'no Path'}) level ${hero.level}, full health ${combat.maxHp}, AC ${combat.ac}, worn ${worn.join(' ')}`);
  for (let floor = 1; floor <= 10; floor++) {
    const threats: Record<ThreatId, number> = { trivial: 0, easy: 0, risky: 0, dangerous: 0, deadly: 0 };
    let dead = 0;
    for (let room = 0; room < ROOMS; room++) {
      const monsters = spawnEncounter(createRng(`power-${floor}-${room}`), floor, 'fight');
      const input = { ...fightInput(full as typeof hero, combat, monsters, { stance: 'bold' }), potions: 3 };
      threats[threatOf(fightOdds(`power-${floor}-${room}:threat`, input))]++;
      if (simulateFight(createRng(`power-${floor}-${room}:real`), input).outcome === 'dead') dead++;
    }
    const boss = (kind: 'miniboss' | 'boss') => {
      const tally: Record<FightOutcome, number> = { victory: 0, survived: 0, escaped: 0, dead: 0 };
      const monsters = spawnEncounter(createRng(`power-${kind}-${floor}`), floor, kind);
      for (let i = 0; i < 200; i++) {
        const input = { ...fightInput(full as typeof hero, combat, monsters, { stance: 'bold' }), potions: 3 };
        tally[simulateFight(createRng(`power-${kind}-${floor}-${i}`), input).outcome]++;
      }
      return `win ${pct(tally.victory / 200)} dead ${pct(tally.dead / 200)}`;
    };
    const rooms = (Object.entries(threats) as [ThreatId, number][]).map(([k, v]) => `${k} ${pct(v / ROOMS)}`).join(' ');
    console.log(`  F${String(floor).padStart(2)} rooms: ${rooms} | dead ${pct(dead / ROOMS)} | ${floor === 10 ? `Dragon ${boss('boss')}` : `Mini-boss ${boss('miniboss')}`}`);
  }
}
await prisma.$disconnect();
