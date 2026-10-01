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
  BANNER_COLORS, CLASS_DEFS, type ClassId, type FightInput, type FightResult, type MonsterInstance, type PathId, type RaceId, type StanceId, THEMES, createRng,
  type HeroAction, type HeroChoice, type HeroKey, type TurnOptions, duoEncounter, fireBomb, forAlly, heroCombat, playFight, monsterById, monsterStrike, restUses, simulateFight, spawnEncounter, startingHealth, themeOf, weaponStrike,
} from '@dark/engine';

interface Who { name: string; race: RaceId; class: ClassId; portrait: string; banner: string }

interface Scenario {
  hero: Who;
  /** A Duo partner fighting alongside (key 'ally'); the monsters are a Duo's. */
  ally?: { hero: Who; level: number; health: number; potions: number; stance?: StanceId };
  /** Both Heroes played by hand, as in a manual fight: the choice for each turn. */
  policy?: (turn: TurnOptions) => HeroAction;
  level: number;
  floor: number;
  kind: 'fight' | 'miniboss' | 'boss' | 'twin';
  /** Starting health as a share of the maximum. */
  health: number;
  potions: number;
  stance?: StanceId;
  path?: PathId;
  surprise?: FightInput['surprise'];
  bomb?: boolean;
  /** Carried gold, for thieves. */
  gold?: number;
  want: (result: FightResult, monsters: MonsterInstance[]) => boolean;
}

const has = (r: FightResult, test: (e: FightResult['events'][number]) => boolean) => r.events.some(test);

const SCENARIOS: Record<string, Scenario> = {
  'goblins-victory-crit': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 1, floor: 1, kind: 'fight', health: 1, potions: 2,
    want: (r) => r.outcome === 'victory' && r.events.length >= 6 && has(r, (e) => e.type === 'attack' && e.crit),
  },
  'rogue-pack': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 2, floor: 3, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && r.events.filter((e) => e.type === 'defeated').length >= 3,
  },
  'wizard-burst': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 5, floor: 5, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'burst'),
  },
  'cleric-heals': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] },
    level: 7, floor: 7, kind: 'fight', health: 0.6, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'heal' && e.ability === 'cure-wounds') && has(r, (e) => e.type === 'heal' && e.ability === 'potion'),
  },
  'survived-death-saves': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 2, floor: 3, kind: 'fight', health: 0.35, potions: 0,
    want: (r) => r.outcome === 'survived',
  },
  'rise-on-20': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 3, floor: 4, kind: 'fight', health: 0.5, potions: 0,
    want: (r) => has(r, (e) => e.type === 'rise'),
  },
  dead: {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 3, floor: 6, kind: 'fight', health: 0.7, potions: 0,
    want: (r) => r.outcome === 'dead' && r.events.filter((e) => e.type === 'death-save').length >= 2,
  },
  'miniboss-bone-knight': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] },
    level: 6, floor: 5, kind: 'miniboss', health: 1, potions: 2,
    want: (r) => r.outcome === 'victory',
  },
  'dragon': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 16, floor: 10, kind: 'boss', health: 1, potions: 3,
    want: (r) => r.events.length <= 90 && has(r, (e) => e.type === 'power' && e.power === 'breath') && has(r, (e) => e.type === 'power' && e.power === 'frighten'),
  },
  'ambush-after-sneak': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 2, floor: 2, kind: 'fight', health: 1, potions: 1, surprise: 'hero',
    want: (r) => r.outcome === 'victory' && r.events.filter((e) => e.type === 'attack' && e.actor !== 'hero').length >= 2,
  },
  'fire-bomb': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 3, floor: 3, kind: 'fight', health: 1, potions: 1, bomb: true,
    want: (r, m) => r.outcome === 'victory' && m.length >= 2 && r.events.filter((e) => e.type === 'defeated').length >= 1,
  },
  'wary-escape': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 4, floor: 5, kind: 'fight', health: 0.8, potions: 0, stance: 'wary',
    want: (r) => r.outcome === 'escaped' && r.events.filter((e) => e.type === 'escape').length >= 2,
  },
  'cutpurse-runs': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 2, floor: 2, kind: 'fight', health: 1, potions: 1, gold: 60,
    want: (r) => r.goldStolen > 0 && has(r, (e) => e.type === 'fled'),
  },
  'ghoul-paralyzes': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] },
    level: 5, floor: 5, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'held') && has(r, (e) => e.type === 'power' && e.power === 'undying'),
  },
  'hellhound-breath-burn': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 8, floor: 8, kind: 'fight', health: 1, potions: 2,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'power' && e.power === 'breath') && has(r, (e) => e.type === 'tick')
      && has(r, (e) => e.type === 'expire' && e.status === 'burning'),
  },
  'abjurer-ward': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 6, floor: 5, kind: 'fight', health: 1, potions: 1, path: 'abjurer',
    want: (r) => r.outcome === 'victory' && r.events.filter((e) => e.type === 'feature' && e.feature === 'ward').length >= 3,
  },
  'champion-survivor': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 9, floor: 8, kind: 'fight', health: 0.45, potions: 0, path: 'champion',
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'feature' && e.feature === 'survivor'),
  },
  'guardian-indomitable': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 9, floor: 8, kind: 'fight', health: 0.3, potions: 0, path: 'guardian',
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'feature' && e.feature === 'indomitable'),
  },
  'gilded-elite': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 4, floor: 3, kind: 'fight', health: 1, potions: 2,
    want: (r, m) => r.outcome === 'victory' && m.some((x) => x.elite === 'gilded'),
  },
  'sapper-blast': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 2, floor: 2, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'power' && e.power === 'explode'),
  },
  'spider-poison': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] },
    level: 2, floor: 2, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'status' && e.status === 'poisoned') && has(r, (e) => e.type === 'expire' && e.status === 'poisoned'),
  },
  'bat-swarm-bomb': {
    hero: { name: 'Pip', race: 'halfling', class: 'rogue', portrait: '/art/portraits/halfling-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 3, floor: 3, kind: 'fight', health: 1, potions: 1, bomb: true,
    want: (r, m) => r.outcome === 'victory' && m.some((x) => x.id === 'bat-swarm') && m.length >= 2,
  },
  'mummy-fear-fades': {
    hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] },
    level: 5, floor: 5, kind: 'fight', health: 1, potions: 1,
    want: (r, m) => r.outcome === 'victory' && m.some((x) => x.id === 'mummy')
      && has(r, (e) => e.type === 'status' && e.status === 'frightened') && has(r, (e) => e.type === 'expire' && e.status === 'frightened')
      && r.events.findIndex((e) => e.type === 'expire') < r.events.length - 6,
  },
  'shaman-mends': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 2, floor: 2, kind: 'fight', health: 1, potions: 1,
    want: (r, m) => r.outcome === 'victory' && m.some((x) => x.id === 'goblin-shaman') && has(r, (e) => e.type === 'power' && e.power === 'mend'),
  },
  'hag-drains': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 9, floor: 8, kind: 'fight', health: 1, potions: 2,
    want: (r, m) => r.outcome === 'victory' && r.events.length <= 55 && m.some((x) => x.id === 'night-hag') && has(r, (e) => e.type === 'power' && e.power === 'drain'),
  },
  'devil-rages': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    level: 9, floor: 8, kind: 'fight', health: 1, potions: 2,
    want: (r, m) => r.outcome === 'victory' && r.events.length <= 62 && m.some((x) => x.id === 'chain-devil') && has(r, (e) => e.type === 'power' && e.power === 'enrage'),
  },
  'banshee-wail': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    level: 5, floor: 4, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && has(r, (e) => e.type === 'power' && e.power === 'wail'),
  },
  'barbarian-rage': {
    hero: { name: 'Hrolf', race: 'dwarf', class: 'barbarian', portrait: '/art/portraits/dwarf-fighter-1.webp', banner: BANNER_COLORS[7] },
    level: 5, floor: 4, kind: 'fight', health: 1, potions: 1,
    want: (r, m) => r.outcome === 'victory' && m.length >= 3 && r.events.length <= 40 && has(r, (e) => e.type === 'feature' && e.feature === 'rage'),
  },
  'ranger-mark-moves': {
    hero: { name: 'Tamsin', race: 'elf', class: 'ranger', portrait: '/art/portraits/elf-rogue-1.webp', banner: BANNER_COLORS[5] },
    level: 5, floor: 4, kind: 'fight', health: 1, potions: 1,
    want: (r) => r.outcome === 'victory' && r.events.length <= 40 && r.events.filter((e) => e.type === 'feature' && e.feature === 'mark').length >= 2,
  },
  'duo-side-by-side': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    ally: { hero: { name: 'Borin', race: 'dwarf', class: 'cleric', portrait: '/art/portraits/dwarf-cleric-1.webp', banner: BANNER_COLORS[3] }, level: 5, health: 0.7, potions: 1 },
    level: 5, floor: 4, kind: 'fight', health: 0.8, potions: 1,
    want: (r) => r.outcome === 'victory' && r.events.length <= 60
      && has(r, (e) => e.type === 'attack' && e.actor === 'ally' && e.hit) && has(r, (e) => e.type === 'attack' && e.target === 'ally')
      && has(r, (e) => e.type === 'heal' && e.ability === 'cure-wounds' && e.by === 'ally' && e.actor === 'hero'),
  },
  'duo-pulled-up': {
    hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] },
    ally: { hero: { name: 'Hrolf', race: 'dwarf', class: 'barbarian', portrait: '/art/portraits/dwarf-fighter-1.webp', banner: BANNER_COLORS[7] }, level: 4, health: 1, potions: 1 },
    level: 3, floor: 4, kind: 'fight', health: 0.5, potions: 0,
    want: (r) => r.outcome === 'victory' && r.events.length <= 60 && has(r, (e) => e.type === 'down' && !e.actor)
      && has(r, (e) => e.type === 'death-save' && !e.actor) && has(r, (e) => e.type === 'revive' && e.success),
  },
  'duo-teamwork': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    ally: { hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] }, level: 4, health: 1, potions: 1 },
    level: 4, floor: 3, kind: 'fight', health: 1, potions: 1,
    // Played by hand: the Fighter Guards, then Helps; the Wizard opens with a burst, then Dodges once.
    policy: (turn) => turn.hero === 'hero'
      ? { kind: turn.round === 1 && turn.actions.includes('guard') ? 'guard' : turn.round === 2 && turn.actions.includes('help') ? 'help' : 'attack' }
      : { kind: turn.round === 1 && turn.actions.includes('burst') ? 'burst' : turn.round === 2 ? 'dodge' : 'attack' },
    want: (r) => r.outcome === 'victory' && r.events.length <= 60
      && ['guard', 'help', 'dodge'].every((f) => has(r, (e) => e.type === 'feature' && e.feature === f)),
  },
  'duo-twin-wardens': {
    hero: { name: 'Garrick', race: 'human', class: 'fighter', portrait: '/art/portraits/human-fighter-1.webp', banner: BANNER_COLORS[0] },
    ally: { hero: { name: 'Ilyra', race: 'elf', class: 'wizard', portrait: '/art/portraits/elf-wizard-1.webp', banner: BANNER_COLORS[1] }, level: 5, health: 1, potions: 1 },
    level: 5, floor: 2, kind: 'twin', health: 1, potions: 1,
    // A Warden rises at least once before both fall in one round.
    want: (r) => r.outcome === 'victory' && r.ally?.outcome === 'victory' && r.events.length <= 90
      && has(r, (e) => e.type === 'power' && e.power === 'twin'),
  },
  'bearheart-relentless': {
    hero: { name: 'Hrolf', race: 'dwarf', class: 'barbarian', portrait: '/art/portraits/dwarf-fighter-1.webp', banner: BANNER_COLORS[7] },
    level: 9, floor: 6, kind: 'miniboss', health: 0.5, potions: 0, path: 'bearheart',
    want: (r) => r.outcome === 'victory' && r.events.length <= 60 && has(r, (e) => e.type === 'feature' && e.feature === 'relentless'),
  },
};

function combatant(m: MonsterInstance): Combatant {
  const def = monsterById(m.id);
  return {
    key: m.key, name: def.name, art: def.art, hp: m.hp, maxHp: m.maxHp, ac: m.ac, boss: def.role === 'boss' || def.role === 'miniboss' || def.role === 'warden', banner: null,
    elite: m.elite, powers: m.powers.map((p) => p.id), strike: monsterStrike(def), kin: def.kin, class: null,
  };
}

/** A Starter-kit Hero of a level, at a share of its health. */
function makeHero(who: Who, level: number, health: number, path: PathId | null = null) {
  const primary = CLASS_DEFS[who.class].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const perLevel = Math.ceil(CLASS_DEFS[who.class].hitDie / 2) + 1 + 2 + 2;
  const maxHp = startingHealth(who.class, who.race, ['alert', 'tough'], scores.con) + (level - 1) * perLevel;
  const worn = CLASS_DEFS[who.class].starterKit.map((base) => ({ base, quality: 60, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const hp = Math.max(1, Math.round(maxHp * health));
  return heroCombat({ name: who.name, class: who.class, race: who.race, level, talents: ['alert', 'tough'], path, scores, maxHp, hp, worn });
}

const drawn = (key: 'hero' | 'ally', who: Who, h: ReturnType<typeof makeHero>): Combatant => ({
  key, name: { en: who.name, ru: who.name }, art: who.portrait, hp: h.hp, maxHp: h.maxHp, ac: h.ac, boss: false, banner: who.banner, elite: null,
  powers: [], strike: weaponStrike(h.weapon?.base), kin: null, class: who.class,
});

/** A fight played by hand to its end, the way the server does it: each pause asks `policy`. */
function byHand(seed: string, input: FightInput, policy: (turn: TurnOptions) => HeroAction): FightResult {
  const manual: HeroKey[] = input.ally ? ['hero', 'ally'] : ['hero'];
  const choices: HeroChoice[] = [];
  for (;;) {
    const r = playFight(createRng(seed), input, { manual, choices });
    if (!('paused' in r)) return r;
    choices.push({ hero: r.turn.hero, action: policy(r.turn) });
  }
}

/** A Duo fight as the partner's Player sees it: the same fight, the two Heroes trading places. */
const partnerSides: Record<string, FightReplay> = {};

function run(name: string, s: Scenario): FightReplay {
  const hero = makeHero(s.hero, s.level, s.health, s.path ?? null);
  const ally = s.ally ? makeHero(s.ally.hero, s.ally.level, s.ally.health) : null;
  for (let i = 0; i < 60_000; i++) {
    const spawn = createRng(`${name}:spawn:${i}`);
    const monsters = s.kind === 'twin' || !ally || s.kind === 'boss' ? spawnEncounter(spawn, s.floor, s.kind) : duoEncounter(spawn, s.floor, s.kind);
    const input: FightInput = {
      hero: { ...hero }, monsters, uses: restUses(s.hero.class, s.level, s.path ?? null), potions: s.potions, runPowers: { deathless: false, lucky: false },
      stance: s.stance ?? 'bold', surprise: s.surprise ?? null, bomb: s.bomb ? fireBomb(s.floor) : null, gold: s.gold ?? 0,
      ally: ally && s.ally ? {
        hero: { ...ally }, uses: restUses(s.ally.hero.class, s.ally.level, null), potions: s.ally.potions, runPowers: { deathless: false, lucky: false },
        stance: s.ally.stance ?? 'bold',
      } : null,
    };
    const result = s.policy ? byHand(`${name}:fight:${i}`, input, s.policy) : simulateFight(createRng(`${name}:fight:${i}`), input);
    if (!s.want(result, monsters)) continue;
    const map = THEMES[themeOf(s.floor)].maps[0];
    if (ally && s.ally && result.ally) {
      partnerSides[`${name}-partner`] = fightReplaySchema.parse({
        map, hero: drawn('hero', s.ally.hero, ally), ally: drawn('ally', s.hero, hero), monsters: monsters.map(combatant),
        events: forAlly(result.events, result.ally.outcome), outcome: result.ally.outcome,
      });
    }
    return fightReplaySchema.parse({
      map,
      hero: drawn('hero', s.hero, hero),
      ally: ally && s.ally ? drawn('ally', s.ally.hero, ally) : null,
      monsters: monsters.map(combatant),
      events: result.events,
      outcome: result.outcome,
    });
  }
  throw new Error(`no seed found for ${name}`);
}

// A Duo fight is followed by its partner's side.
const fixtures = Object.fromEntries(Object.entries(SCENARIOS).flatMap(([name, s]) => {
  const replay = run(name, s);
  const partner = partnerSides[`${name}-partner`];
  return partner ? [[name, replay], [`${name}-partner`, partner]] : [[name, replay]];
}));
const out = fileURLToPath(new URL('../../web/src/screens/sandbox/fightFixtures.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(fixtures, null, 1)}\n`);
for (const [name, f] of Object.entries(fixtures)) console.log(`${name.padEnd(22)} ${f.outcome.padEnd(8)} ${f.events.length} events, ${f.monsters.length} monster(s)`);
console.log(`wrote ${out}`);
