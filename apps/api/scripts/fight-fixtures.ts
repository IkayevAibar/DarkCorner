/**
 * Writes real fight replays for the web sandbox, where the fight scene is built
 * against them (docs/tasks/codex-03-fight-scene.md). Each scenario searches seeds
 * until the engine produces the moment it wants to show.
 *
 * Run: npm run fixtures:fights -w @dark/api
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Combatant, type FightReplay, fightReplaySchema } from '@dark/shared';
import {
  BANNER_COLORS, CLASS_DEFS, type ClassId, type FightResult, type MonsterInstance, type RaceId, THEMES, createRng,
  heroCombat, monsterById, restUses, simulateFight, spawnEncounter, startingHealth, themeOf,
} from '@dark/engine';

interface Scenario {
  hero: { name: string; race: RaceId; class: ClassId; portrait: string; banner: string };
  level: number;
  floor: number;
  kind: 'fight' | 'miniboss' | 'boss';
  /** Starting health as a share of the maximum. */
  health: number;
  potions: number;
  want: (result: FightResult) => boolean;
}

const has = (r: FightResult, test: (e: FightResult['events'][number]) => boolean) => r.events.some(test);

const SCENARIOS: Record<string, Scenario> = {
  'goblins-victory-crit': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.png', banner: BANNER_COLORS[0] },
    level: 1, floor: 1, kind: 'fight', health: 1, potions: 2,
    want: (r) => r.outcome === 'victory' && r.events.length >= 6 && has(r, (e) => e.type === 'attack' && e.crit),
  },
  'rogue-pack': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.png', banner: BANNER_COLORS[5] },
    level: 2, floor: 3, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && r.events.filter((e) => e.type === 'defeated').length >= 3,
  },
  'wizard-burst': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.png', banner: BANNER_COLORS[1] },
    level: 5, floor: 5, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'burst'),
  },
  'cleric-heals': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.png', banner: BANNER_COLORS[3] },
    level: 7, floor: 7, kind: 'fight', health: 0.6, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'heal' && e.ability === 'cure-wounds') && has(r, (e) => e.type === 'heal' && e.ability === 'potion'),
  },
  'survived-death-saves': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.png', banner: BANNER_COLORS[0] },
    level: 2, floor: 3, kind: 'fight', health: 0.35, potions: 0,
    want: (r) => r.outcome === 'survived',
  },
  'rise-on-20': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.png', banner: BANNER_COLORS[5] },
    level: 3, floor: 4, kind: 'fight', health: 0.5, potions: 0,
    want: (r) => has(r, (e) => e.type === 'rise'),
  },
  dead: {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.png', banner: BANNER_COLORS[1] },
    level: 3, floor: 6, kind: 'fight', health: 0.7, potions: 0,
    want: (r) => r.outcome === 'dead' && r.events.filter((e) => e.type === 'death-save').length >= 2,
  },
  'miniboss-bone-knight': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.png', banner: BANNER_COLORS[3] },
    level: 6, floor: 5, kind: 'miniboss', health: 1, potions: 2,
    want: (r) => r.outcome === 'victory',
  },
  'dragon': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.png', banner: BANNER_COLORS[0] },
    level: 16, floor: 10, kind: 'boss', health: 1, potions: 3,
    want: (r) => r.events.length <= 90,
  },
};

function combatant(m: MonsterInstance): Combatant {
  const def = monsterById(m.id);
  return { key: m.key, name: def.name, art: def.art, hp: m.hp, maxHp: m.maxHp, ac: m.ac, boss: def.role === 'boss' || def.role === 'miniboss', banner: null };
}

function run(name: string, s: Scenario): FightReplay {
  const primary = CLASS_DEFS[s.hero.class].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const perLevel = Math.ceil(CLASS_DEFS[s.hero.class].hitDie / 2) + 1 + 2 + 2;
  const maxHp = startingHealth(s.hero.class, s.hero.race, ['alert', 'tough'], scores.con) + (s.level - 1) * perLevel;
  const worn = CLASS_DEFS[s.hero.class].starterKit.map((base) => ({ base, quality: 60, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));

  for (let i = 0; i < 20_000; i++) {
    const hp = Math.max(1, Math.round(maxHp * s.health));
    const hero = heroCombat({ name: s.hero.name, class: s.hero.class, race: s.hero.race, level: s.level, talents: ['alert', 'tough'], scores, maxHp, hp, worn });
    const monsters = spawnEncounter(createRng(`${name}:spawn:${i}`), s.floor, s.kind);
    const result = simulateFight(createRng(`${name}:fight:${i}`), {
      hero, monsters, uses: restUses(s.hero.class, s.level), potions: s.potions, runPowers: { deathless: false },
    });
    if (!s.want(result)) continue;
    return fightReplaySchema.parse({
      map: THEMES[themeOf(s.floor)].maps[0],
      hero: { key: 'hero', name: { en: s.hero.name, ru: s.hero.name }, art: s.hero.portrait, hp, maxHp, ac: hero.ac, boss: false, banner: s.hero.banner },
      monsters: monsters.map(combatant),
      events: result.events,
      outcome: result.outcome,
    });
  }
  throw new Error(`no seed found for ${name}`);
}

const fixtures = Object.fromEntries(Object.entries(SCENARIOS).map(([name, s]) => [name, run(name, s)]));
const out = fileURLToPath(new URL('../../web/src/screens/sandbox/fightFixtures.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(fixtures, null, 1)}\n`);
for (const [name, f] of Object.entries(fixtures)) console.log(`${name.padEnd(22)} ${f.outcome.padEnd(8)} ${f.events.length} events, ${f.monsters.length} monster(s)`);
console.log(`wrote ${out}`);
