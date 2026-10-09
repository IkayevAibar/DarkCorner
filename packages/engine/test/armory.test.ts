import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type GearBase, type HeroCombat, type MonsterInstance, UNIQUES, baseById, canUse,
  createRng, escapeCheck, gearFacts, heroCombat, instantiate, monsterById, restUses, simulateFight, uniqueById, wearPlan,
} from '../src/index.js';

/** A Hero of a Class and level holding `main` (and `off`), in its Starter kit's armor. */
function hero(cls: ClassId, level: number, main: string | null, uniques: string[] = [], off: string | null = null): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const piece = (base: string, slot: string, uniqueId: string | null = null) => ({ base, slot, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId });
  const unique = (base: string) => uniques.find((u) => uniqueById(u).base === base) ?? null;
  const worn = [
    ...(main ? [piece(main, 'main', unique(main))] : []),
    ...(off ? [piece(off, 'off', unique(off))] : []),
    ...uniques.filter((u) => { const b = uniqueById(u).base; return b !== main && b !== off; })
      .map((u) => piece(uniqueById(u).base, (baseById(uniqueById(u).base) as GearBase).slot === 'ring' ? 'ring1' : (baseById(uniqueById(u).base) as GearBase).slot, u)),
  ];
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: [], scores, maxHp: 99_999, hp: 99_999, worn });
}
const fight = (seed: string, h: HeroCombat, monsters: MonsterInstance[], extra: Partial<FightInput> = {}) =>
  simulateFight(createRng(seed), { hero: h, monsters, uses: restUses(h.class, h.level), potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold', ...extra });
const mon = (id: string, floor: number, key = 'm0') => instantiate(monsterById(id), floor, key);
const tough = (id: string, floor: number, key = 'm0') => ({ ...mon(id, floor, key), hp: 99_999, maxHp: 99_999 });
const of = <T extends FightEvent['type']>(events: FightEvent[], type: T) => events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);
const blows = (events: FightEvent[], actor = 'hero') => of(events, 'attack').filter((e) => e.actor === actor);

describe('the second wave of gear', () => {
  it('holds a hand crossbow in one hand, so a shield fits beside it, and a halberd in both', () => {
    const crossbow = baseById('hand-crossbow') as GearBase;
    expect(gearFacts(crossbow, { quality: 50, upgrade: 0, radiant: false })).toMatchObject({ hands: 1, group: 'bow' });
    expect(wearPlan(baseById('shield') as GearBase, new Map([['main', 'hand-crossbow']]))).toEqual({ slot: 'off', vacate: [] });
    expect(gearFacts(baseById('halberd') as GearBase, { quality: 50, upgrade: 0, radiant: false })).toMatchObject({ hands: 2, group: 'heavy' });
    expect(canUse('ranger', crossbow)).toBe(true);
    expect(canUse('wizard', baseById('tome') as GearBase)).toBe(true);
    expect(canUse('cleric', baseById('tome') as GearBase)).toBe(false);
  });

  it('gives every unique a base that exists, and every new unique a power', () => {
    for (const u of UNIQUES) {
      expect(baseById(u.base).kind, u.id).toBe('gear');
      expect(u.power.en.length).toBeGreaterThan(10);
    }
  });
});

describe('the new uniques', () => {
  it('The Quickdraw: one more attack on the first turn', () => {
    const r = fight('quickdraw', hero('fighter', 1, 'hand-crossbow', ['quickdraw']), [tough('goblin', 2)]);
    expect(blows(r.events).length).toBe(blows(r.events, 'm0').length + 1);
  });

  it('Gravechain: every monster its blows fell heals a tenth of full health', () => {
    const h = { ...hero('fighter', 5, 'flail', ['gravechain']), hp: 1_000 };
    const r = fight('gravechain', h, [mon('goblin', 2, 'm0'), mon('goblin', 2, 'm1')]);
    const heals = of(r.events, 'heal').filter((e) => e.ability === 'life-steal');
    expect(heals).toHaveLength(2);
    expect(heals[0]!.amount).toBe(Math.round(99_999 / 10));
  });

  it('Dawnbringer: half again as much to undead, nothing more to others', () => {
    const plain = blows(fight('dawn', hero('fighter', 5, 'morningstar'), [tough('zombie', 5)]).events).map((e) => e.damage);
    const holy = blows(fight('dawn', hero('fighter', 5, 'morningstar', ['dawnbringer']), [tough('zombie', 5)]).events).map((e) => e.damage);
    expect(holy.reduce((a, b) => a + b, 0)).toBeGreaterThan(plain.reduce((a, b) => a + b, 0) * 1.4);
    const wolf = (u: string[]) => blows(fight('dawn-wolf', hero('fighter', 5, 'morningstar', u), [tough('wolf', 2)]).events).map((e) => e.damage);
    expect(wolf(['dawnbringer'])).toEqual(wolf([]));
  });

  it('The Ember Codex: Bursts of fire half again as hard', () => {
    const burst = (u: string[]) => of(fight('codex', hero('wizard', 5, 'staff', u, 'tome'), [mon('goblin', 3, 'm0'), mon('goblin', 3, 'm1')]).events, 'burst')[0]!;
    const plain = burst([]);
    const codex = burst(['ember-codex']);
    expect(codex.targets[0]!.damage).toBe(Math.max(1, Math.round(plain.targets[0]!.damage * 1.5)));
  });

  it('Circlet of Calm: no fear and no mesmerizing gaze', () => {
    for (const id of ['mummy', 'temptress']) {
      const r = fight(`calm-${id}`, hero('fighter', 8, 'longsword', ['circlet-of-calm']), [tough(id, 7)]);
      expect(of(r.events, 'power').filter((e) => e.target === 'hero' && (e.power === 'frighten' || e.power === 'mesmerize'))).toHaveLength(0);
      expect(of(r.events, 'save')).toHaveLength(0);
    }
  });

  it('Bracers of the Bulwark: the first hit of the fight lands for half', () => {
    const first = (u: string[]) => blows(fight('bracers', hero('fighter', 5, 'longsword', u), [tough('ghoul', 5)]).events, 'm0').find((e) => e.hit)!.damage;
    expect(first(['bulwark-bracers'])).toBe(Math.max(1, Math.floor(first([]) / 2)));
  });

  it('Bastion of the Fallen: 3 more Armor Class below half health', () => {
    const hits = (u: string[]) => {
      const h = { ...hero('fighter', 5, 'longsword', u), hp: 10_000 };
      return blows(fight('bastion', h, [tough('ghoul', 5)]).events, 'm0').filter((e) => e.hit).length;
    };
    expect(hits(['bastion-plate'])).toBeLessThan(hits([]));
  });

  it('Titanfall: a quarter more on Mini-bosses', () => {
    const total = (u: string[]) => blows(fight('titan', hero('fighter', 8, 'halberd', u), [tough('bone-knight', 4)]).events).reduce((s, e) => s + e.damage, 0);
    expect(total(['titanfall'])).toBeGreaterThan(total([]) * 1.15);
  });

  it('Greaves of the Long Road: Escape rolls with advantage and +5', () => {
    const plain = escapeCheck(hero('fighter', 5, 'longsword'), 2);
    const greaves = escapeCheck(hero('fighter', 5, 'longsword', ['long-road-greaves']), 2);
    expect(greaves.modifier).toBe(plain.modifier + 5);
    expect(greaves.edge).toBe('advantage');
  });

  it('Trollheart: a little health back at the start of each turn', () => {
    const h = { ...hero('wizard', 5, 'staff', ['trollheart']), hp: 50_000 };
    const r = fight('troll', h, [tough('goblin', 2)]);
    const back = of(r.events, 'feature').filter((e) => e.feature === 'survivor');
    expect(back.length).toBeGreaterThan(10);
    expect(back[0]!.amount).toBe(Math.round(99_999 * 0.03));
  });

  it('Worldbreaker: each blow cracks armor, so more of them land', () => {
    const hits = (u: string[]) => blows(fight('world', hero('fighter', 5, 'maul', u), [tough('bone-knight', 6)]).events).filter((e) => e.hit).length;
    expect(hits(['worldbreaker'])).toBeGreaterThan(hits([]));
  });

  it('The Unwritten Page: attack spells never miss', () => {
    const spells = blows(fight('page', hero('wizard', 5, 'staff', ['unwritten-page'], 'tome'), [tough('demon-brute', 8)]).events)
      .filter((e) => e.kind === 'spell');
    expect(spells.length).toBeGreaterThan(10);
    expect(spells.every((e) => e.hit)).toBe(true);
  });
});
