import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type HeroCombat, MIGHT, MONSTERS, type MonsterInstance, SUNDER_MAX, createRng, fireBomb, floorMight,
  heroCombat, instantiate, monsterById, monsterStrike, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

/** A Hero of a Class and level in its Starter kit. */
function hero(cls: ClassId, level = 5): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * 10;
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
}
/** One that can't fall: every power gets the whole fight to show itself. */
const sturdy = (h: HeroCombat): HeroCombat => ({ ...h, hp: 99_999, maxHp: 99_999 });

const fight = (seed: string, h: HeroCombat, monsters: MonsterInstance[], extra: Partial<FightInput> = {}) =>
  simulateFight(createRng(seed), { hero: h, monsters, uses: restUses(h.class, h.level), potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold', ...extra });
const mon = (id: string, floor: number, key = 'm0') => instantiate(monsterById(id), floor, key);
/** A monster that takes a long time to fall, keeping its powers. */
const tough = (id: string, floor: number, key = 'm0') => {
  const m = mon(id, floor, key);
  return { ...m, hp: 99_999, maxHp: 99_999 };
};
const of = <T extends FightEvent['type']>(events: FightEvent[], type: T) => events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);
const powers = (events: FightEvent[], power: string) => of(events, 'power').filter((e) => e.power === power);

describe('the bestiary', () => {
  it('gives each Floor of a theme its own Mini-boss, with its escort', () => {
    const bosses = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((floor) => spawnEncounter(createRng(`boss-${floor}`), floor, 'miniboss').map((m) => m.id));
    expect(bosses.map((group) => group[0])).toEqual([
      'goblin-chieftain', 'broodmother', 'bugbear', 'bone-knight', 'necromancer', 'vampire-lord', 'hierophant', 'horned-tyrant', 'pit-fiend',
    ]);
    expect(bosses[2]).toEqual(['bugbear', 'hobgoblin']);
    expect(bosses[5]).toEqual(['vampire-lord', 'bat-swarm']);
  });

  it('describes every monster and knows how each one strikes', () => {
    for (const def of MONSTERS) {
      expect(def.about.en.length, def.id).toBeGreaterThan(20);
      expect(def.about.ru.length, def.id).toBeGreaterThan(20);
      expect(monsterStrike(def)).toBeTruthy();
      for (const id of def.escort ?? []) expect(monsterById(id).theme).toBeTruthy();
    }
    // Floor 10 has more than kobolds and drakes now.
    expect(MONSTERS.filter((d) => d.theme === 'lair' && d.weight > 0).length).toBeGreaterThanOrEqual(7);
  });
});

describe('the new monster powers', () => {
  it('pounces: one more attack in the first round only', () => {
    // A Hero and a worg that both outlast the fight: one attack each round, and one more at the start.
    const r = fight('pounce', sturdy(hero('fighter', 1)), [tough('worg', 1)]);
    expect(powers(r.events, 'pounce')).toHaveLength(1);
    const bites = of(r.events, 'attack').filter((e) => e.actor === 'm0').length;
    const rounds = of(r.events, 'attack').filter((e) => e.actor === 'hero').length;
    expect(bites).toBe(rounds + 1);
  });

  it('protects the others: the AI goes for the bodyguard first, and blows past it come at a disadvantage', () => {
    const r = fight('protect', sturdy(hero('fighter', 3)), [mon('goblin', 2, 'm0'), mon('hobgoblin', 2, 'm1')]);
    const first = of(r.events, 'attack').find((e) => e.actor === 'hero')!;
    expect(first.target).toBe('m1');
  });

  it('lets steel pass half through the incorporeal, and spells hit it fully', () => {
    const ghost = { ...tough('ghost', 4), powers: monsterById('ghost').powers!.filter((p) => p.id === 'incorporeal') };
    const plain = { ...ghost, powers: [] };
    const blows = (target: MonsterInstance) => of(fight('ghost', sturdy(hero('fighter', 5)), [target]).events, 'attack')
      .filter((e) => e.actor === 'hero' && e.hit).map((e) => e.damage);
    const halved = blows(ghost);
    const full = blows(plain);
    expect(halved.length).toBeGreaterThan(10);
    halved.forEach((d, i) => expect(d).toBeLessThanOrEqual(Math.max(1, Math.round(full[i]! / 2)) + 1));
    // A Wizard's spells pay it no mind.
    const spells = (target: MonsterInstance) => of(fight('ghost-spell', sturdy(hero('wizard', 5)), [target]).events, 'attack')
      .filter((e) => e.actor === 'hero' && e.hit).map((e) => e.damage);
    expect(spells(ghost)).toEqual(spells(plain));
  });

  it('takes a hard shell’s cut off every weapon and spell hit, never below 1', () => {
    const shell = { ...tough('shell-beetle', 1), powers: [{ id: 'hide' as const, cut: 1000 }] };
    for (const cls of ['fighter', 'wizard'] as const) {
      const hits = of(fight(`shell-${cls}`, sturdy(hero(cls, 5)), [shell]).events, 'attack').filter((e) => e.actor === 'hero' && e.hit);
      expect(hits.length).toBeGreaterThan(5);
      expect(hits.every((e) => e.damage === 1)).toBe(true);
    }
  });

  it('regenerates each turn, unless fire touched it since', () => {
    const spawn = () => ({ ...mon('vampire-spawn', 4), hp: 1_000, maxHp: 2_000 });
    const r = fight('regen', sturdy(hero('fighter', 3)), [spawn()]);
    const regrown = powers(r.events, 'regenerate');
    expect(regrown.length).toBeGreaterThan(10);
    expect(regrown[0]!.amount).toBe(Math.round(2_000 * 0.12));
    // It heals as its first turn starts; a Fire bomb at the start keeps that first turn from healing.
    const firstOf = (events: FightEvent[]) => ({
      regrows: events.findIndex((e) => e.type === 'power' && e.power === 'regenerate'),
      acts: events.findIndex((e) => e.type === 'attack' && e.actor === 'm0'),
    });
    const calm = firstOf(r.events);
    expect(calm.regrows).toBeLessThan(calm.acts);
    const bombed = firstOf(fight('regen', sturdy(hero('fighter', 3)), [spawn()], { bomb: fireBomb(4) }).events);
    expect(bombed.regrows).toBeGreaterThan(bombed.acts);
  });

  it('sunders armor a point a hit, three points at most', () => {
    const h = sturdy(hero('fighter', 10));
    const r = fight('sunder', h, [tough('scale-sworn', 10)]);
    const cracks = powers(r.events, 'sunder');
    expect(cracks.map((e) => e.amount)).toEqual([1, 2, 3].slice(0, SUNDER_MAX));
  });

  it('pricks whoever strikes it with a weapon, and spares a spell', () => {
    const fiend = () => tough('ember-fiend', 7);
    const steel = fight('thorns', sturdy(hero('fighter', 10)), [fiend()]);
    const hits = of(steel.events, 'attack').filter((e) => e.actor === 'hero' && e.hit).length;
    const pricks = powers(steel.events, 'thorns');
    expect(pricks.length).toBe(hits);
    expect(pricks.every((e) => e.target === 'hero' && (e.amount ?? 0) >= 1)).toBe(true);
    expect(powers(fight('thorns-spell', sturdy(hero('wizard', 10)), [fiend()]).events, 'thorns')).toHaveLength(0);
  });

  it('mesmerizes: a failed WIS save costs the Hero its first turn', () => {
    let held = 0;
    for (let i = 0; i < 40; i++) {
      const r = fight(`gaze-${i}`, sturdy(hero('fighter', 5)), [tough('temptress', 7)]);
      expect(powers(r.events, 'mesmerize')).toHaveLength(1);
      const save = of(r.events, 'save')[0]!;
      expect(save.ability).toBe('wis');
      if (!save.success) {
        held++;
        expect(of(r.events, 'held')[0]?.target).toBe('hero');
      }
    }
    expect(held).toBeGreaterThan(0);
  });
});

describe('harder alone', () => {
  it('steps up from Floor 3 for a Hero alone, and leaves Floors 1–2 and a Duo as they were', () => {
    expect(floorMight(1)).toEqual(floorMight(1, false));
    expect(floorMight(2)).toEqual(floorMight(2, false));
    for (const floor of [3, 6, 9]) {
      const alone = floorMight(floor);
      const pair = floorMight(floor, false);
      expect(alone.hp).toBeCloseTo(pair.hp + MIGHT.stepHp);
      expect(alone.hit).toBeGreaterThan(pair.hit);
      expect(alone.damage).toBeGreaterThan(pair.damage);
    }
    // The Boss is its own measure either way.
    expect(spawnEncounter(createRng('dragon'), 10, 'boss')[0]!.maxHp).toBe(monsterById('ancient-dragon').hp);
  });
});
