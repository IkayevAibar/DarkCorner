import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type GearBase, type HeroCombat, TWO_HANDED_FACTOR, baseById, bonusLines, createRng, effectiveStats, heroCombat, isTwoHanded,
  kitSlots, restUses, simulateFight, slotsFor, spawnEncounter, statTotal, wearPlan,
} from '../src/index.js';

const gear = (id: string) => baseById(id) as GearBase;
const worn = (entries: [string, string][]) => new Map(entries);

describe('hands', () => {
  it('holds a dagger in either hand, and greatswords, greataxes, mauls and bows in both', () => {
    expect(slotsFor(gear('dagger'))).toEqual(['main', 'off']);
    expect(slotsFor(gear('rapier'))).toEqual(['main']);
    for (const id of ['greatsword', 'greataxe', 'maul', 'shortbow', 'longbow', 'crossbow']) expect(isTwoHanded(id)).toBe(true);
    for (const id of ['longsword', 'saber', 'rapier', 'dagger', 'mace', 'warhammer', 'staff', 'wand', 'shield', 'ring']) expect(isTwoHanded(id)).toBe(false);
  });

  it('takes the off-hand item off for a two-handed weapon, and the two-handed weapon off for an off-hand item', () => {
    expect(wearPlan(gear('greatsword'), worn([['main', 'longsword'], ['off', 'shield']]))).toEqual({ slot: 'main', vacate: ['main', 'off'] });
    expect(wearPlan(gear('longbow'), worn([['off', 'shield']]))).toEqual({ slot: 'main', vacate: ['off'] });
    expect(wearPlan(gear('shield'), worn([['main', 'greataxe']]))).toEqual({ slot: 'off', vacate: ['main'] });
    expect(wearPlan(gear('shield'), worn([['main', 'longsword']]))).toEqual({ slot: 'off', vacate: [] });
  });

  it('puts a dagger in the main hand, or in the off-hand when only that is free, or where the Player says', () => {
    expect(wearPlan(gear('dagger'), worn([]))).toEqual({ slot: 'main', vacate: [] });
    expect(wearPlan(gear('dagger'), worn([['main', 'rapier']]))).toEqual({ slot: 'off', vacate: [] });
    expect(wearPlan(gear('dagger'), worn([['main', 'rapier'], ['off', 'dagger']]))).toEqual({ slot: 'main', vacate: ['main'] });
    expect(wearPlan(gear('dagger'), worn([['main', 'rapier'], ['off', 'dagger']]), 'off')).toEqual({ slot: 'off', vacate: ['off'] });
    // Beside a two-handed weapon the off-hand isn't free: the dagger replaces it in the main hand.
    expect(wearPlan(gear('dagger'), worn([['main', 'longbow']]))).toEqual({ slot: 'main', vacate: ['main'] });
    expect(wearPlan(gear('dagger'), worn([['main', 'longbow']]), 'off')).toEqual({ slot: 'off', vacate: ['main'] });
    expect(wearPlan(gear('ring'), worn([['ring1', 'ring']]))).toEqual({ slot: 'ring2', vacate: [] });
  });

  it('wears a kit where it fits and leaves in the Bag what would take something off', () => {
    expect(kitSlots(CLASS_DEFS.rogue.starterKit)).toEqual(['main', 'off', 'body']);
    expect(kitSlots(CLASS_DEFS.ranger.starterKit)).toEqual(['main', 'body']);
    expect(kitSlots(['greataxe', 'shield', 'scale'])).toEqual(['main', null, 'body']);
    expect(kitSlots(['longsword', 'shield'], worn([['main', 'mace']]))).toEqual([null, 'off']);
  });

  it('counts a two-handed weapon\'s Bonus stats twice, on its card too', () => {
    const stats = [{ stat: 'damage', value: 10 }, { stat: 'str', value: 1 }];
    expect(TWO_HANDED_FACTOR).toBe(2);
    expect(effectiveStats({ base: 'greatsword', bonusStats: stats, radiant: false })).toEqual([{ stat: 'damage', value: 20 }, { stat: 'str', value: 2 }]);
    expect(effectiveStats({ base: 'longsword', bonusStats: stats, radiant: false })).toEqual([{ stat: 'damage', value: 10 }, { stat: 'str', value: 1 }]);
    expect(statTotal([{ base: 'longbow', bonusStats: stats, radiant: false }, { base: 'ring', bonusStats: stats, radiant: false }], 'damage')).toBe(30);
    expect(bonusLines({ base: 'maul', bonusStats: [{ stat: 'damage', value: 10 }], radiant: false })[0]!.en).toContain('20');
  });
});

describe('a dagger in the off-hand', () => {
  const kit = (bases: [string, string][]) => bases.map(([base, slot]) => ({ base, slot, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const rogue = (pieces: [string, string][], level = 8): HeroCombat => {
    const scores = { str: 10, dex: 18, con: 14, int: 10, wis: 12, cha: 10 };
    const h = heroCombat({ name: 'R', class: 'rogue', race: 'human', level, talents: [], scores, maxHp: 80, hp: 80, worn: kit(pieces) });
    return { ...h, hp: h.maxHp };
  };

  it('holds the main weapon in the main hand and the dagger beside it; alone, the dagger fights as the main weapon', () => {
    const both = rogue([['rapier', 'main'], ['dagger', 'off'], ['leather', 'body']]);
    expect(both.weapon?.base.id).toBe('rapier');
    expect(both.offHand?.base.id).toBe('dagger');
    const alone = rogue([['dagger', 'off']]);
    expect(alone.weapon?.base.id).toBe('dagger');
    expect(alone.offHand).toBeNull();
    // Without worn slots (older callers), the first weapon is the main one and nothing is in the off-hand.
    const legacy = heroCombat({ name: 'R', class: 'rogue', race: 'human', level: 1, talents: [], scores: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 }, maxHp: 10, hp: 10,
      worn: [{ base: 'rapier', quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }, { base: 'dagger', quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }] });
    expect(legacy.weapon?.base.id).toBe('rapier');
    expect(legacy.offHand ?? null).toBeNull();
  });

  it('strikes once more each turn: a dagger\'s dice, without the ability modifier or a Sneak attack', () => {
    const hero = rogue([['rapier', 'main'], ['dagger', 'off'], ['leather', 'body']]);
    let off = 0;
    let main = 0;
    for (let i = 0; i < 60; i++) {
      const r = simulateFight(createRng(`off-hand-${i}`), {
        hero, monsters: spawnEncounter(createRng(`off-hand-spawn-${i}`), 3, 'fight'), uses: restUses('rogue', 8), potions: 2,
        runPowers: { deathless: false, lucky: false },
      });
      for (const e of r.events) {
        if (e.type !== 'attack' || e.actor !== 'hero') continue;
        if (e.hand === 'off') {
          off++;
          // 1d4 (2d4 on a crit), nothing added: a Sneak attack or DEX would push it past 8.
          if (e.hit) expect(e.damage).toBeLessThanOrEqual(8);
        } else main++;
      }
    }
    expect(off).toBeGreaterThan(20);
    expect(main).toBeGreaterThan(off);
  });

  it('adds nothing to a caster, whose attacks are spells', () => {
    const scores = { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 };
    const wizard = heroCombat({ name: 'W', class: 'wizard', race: 'human', level: 5, talents: [], scores, maxHp: 40, hp: 40, worn: kit([['dagger', 'main'], ['dagger', 'off']]) });
    const r = simulateFight(createRng('wizard-daggers'), {
      hero: wizard, monsters: spawnEncounter(createRng('wizard-daggers-spawn'), 2, 'fight'), uses: restUses('wizard', 5), potions: 2,
      runPowers: { deathless: false, lucky: false },
    });
    expect(r.events.some((e) => e.type === 'attack' && e.hand === 'off')).toBe(false);
  });
});
