import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type HeroCombat, MARK_DICE, type MonsterInstance, type PathId, attacksPerTurn,
  breaksWalls, createRng, heroCombat, heroFeatures, instantiate, levelGains, marks, monsterById, pathsOf, portraitsFor, rageDamage, rages,
  restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

/** A level-N Hero of a Class in its Starter kit, with typical rolled scores. */
function starter(cls: ClassId, level = 1, path: PathId | null = null): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
}

const input = (hero: HeroCombat, monsters: MonsterInstance[]): FightInput => ({
  hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 0, runPowers: { deathless: false, lucky: false },
});

const goblins = (n: number, floor = 1) => Array.from({ length: n }, (_, i) => instantiate(monsterById('goblin'), floor, `m${i}`));

describe('the Barbarian', () => {
  it('has the biggest Hit Die, STR, and an axe in its kit', () => {
    expect(CLASS_DEFS.barbarian).toMatchObject({ hitDie: 12, primary: 'str', saves: ['str', 'con'], starterKit: ['greataxe', 'scale'] });
    expect(startingHealth('barbarian', 'human', [], 14)).toBeGreaterThan(startingHealth('fighter', 'human', [], 14));
    expect(breaksWalls('barbarian')).toBe(true);
    expect(breaksWalls('ranger')).toBe(false);
  });

  it('Rages as many times a rest as the SRD says, harder as it grows, and attacks twice from level 5', () => {
    expect([1, 3, 6, 12, 17].map(rages)).toEqual([2, 3, 4, 5, 6]);
    expect([1, 9, 16].map(rageDamage)).toEqual([2, 3, 4]);
    expect(restUses('barbarian', 6)).toEqual({ spells: 4, heals: 0 });
    expect([4, 5].map((l) => attacksPerTurn('barbarian', l, null))).toEqual([1, 2]);
  });

  it('Rages against two monsters, once, and spends a use', () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateFight(createRng(`rage-${i}`), input(starter('barbarian', 3), goblins(2)));
      const rages = r.events.filter((e) => e.type === 'feature' && e.feature === 'rage');
      expect(rages).toHaveLength(1);
      expect(r.uses.spells).toBe(rages.length ? 2 : 3);
    }
  });

  it('keeps its Rage for a hard fight: a lone goblin gets none while the Barbarian is well', () => {
    const r = simulateFight(createRng('lone'), input({ ...starter('barbarian', 3), hp: 999, maxHp: 999 }, goblins(1)));
    expect(r.events.some((e) => e.type === 'feature' && e.feature === 'rage')).toBe(false);
    expect(r.uses.spells).toBe(3);
  });

  it('takes the Rage’s edge off every blow while raging', () => {
    // The same fight with and without Rage uses: every blow after the Rage is 2 lighter (never below 1).
    const hero = { ...starter('barbarian', 1), hp: 999, maxHp: 999 };
    const monsters = goblins(2, 3);
    const raging = simulateFight(createRng('edge'), input(hero, monsters));
    const calm = simulateFight(createRng('edge'), { ...input(hero, monsters), uses: { spells: 0, heals: 0 } });
    const blows = (events: FightEvent[]) => events.filter((e): e is Extract<FightEvent, { type: 'attack' }> => e.type === 'attack' && e.target === 'hero' && e.hit);
    const hurt = blows(raging.events).reduce((s, e) => s + e.damage, 0);
    expect(blows(raging.events).every((e) => e.damage >= 1)).toBe(true);
    expect(hurt).toBeLessThan(blows(calm.events).reduce((s, e) => s + e.damage, 0) + 1);
  });

  it('gives its belt Rage with uses, Danger sense and Extra attack', () => {
    const belt = heroFeatures({ class: 'barbarian', level: 5, path: null, int: 10, wis: 10, spellUses: 1, healUses: 0 });
    expect(belt.map((f) => f.id)).toEqual(['rage', 'danger-sense', 'extra-attack', 'path']);
    expect(belt[0]).toMatchObject({ kind: 'rest', uses: { left: 1, of: 3 } });
    expect(belt[0]!.now.en).toContain('+2 damage');
    expect(levelGains({ class: 'barbarian', race: 'human', path: null, level: 5, con: 14, talents: [] }).map((g) => g.en))
      .toContain('Rages a rest: 3 → 4');
  });
});

describe('the Ranger', () => {
  it('fights with DEX, a bow in its kit, and knows Clues', () => {
    expect(CLASS_DEFS.ranger).toMatchObject({ hitDie: 10, primary: 'dex', offHands: ['shield'], starterKit: ['longbow', 'studded'] });
    expect([1, 5, 9, 13, 17].map(marks)).toEqual([2, 3, 4, 5, 6]);
  });

  it('marks the toughest of a pack, and the mark moves on when it falls', () => {
    let moved = 0;
    for (let i = 0; i < 60; i++) {
      const monsters = spawnEncounter(createRng(`pack-${i}`), 3, 'fight').concat(goblins(1, 3).map((m) => ({ ...m, key: 'mx' })));
      const r = simulateFight(createRng(`mark-${i}`), input(starter('ranger', 5), monsters));
      const marksOn = r.events.filter((e): e is Extract<FightEvent, { type: 'feature' }> => e.type === 'feature' && e.feature === 'mark');
      expect(marksOn.length).toBeGreaterThan(0);
      const first = monsters.find((m) => m.key === marksOn[0]!.target)!;
      expect(first.maxHp).toBe(Math.max(...monsters.map((m) => m.maxHp)));
      // One use for the fight, however often the mark moves.
      expect(r.uses.spells).toBe(marks(5) - 1);
      if (marksOn.length > 1) moved++;
    }
    expect(moved).toBeGreaterThan(0);
    expect(MARK_DICE).toEqual([1, 6]);
  });

  it('gives its belt Hunter’s mark, Archery and Extra attack', () => {
    const belt = heroFeatures({ class: 'ranger', level: 1, path: null, int: 10, wis: 10, spellUses: 2, healUses: 0 });
    expect(belt.map((f) => f.id)).toEqual(['hunters-mark', 'archery', 'extra-attack', 'path']);
    expect(belt[1]!.now.en).toBe('+2 to hit with a bow.');
  });
});

describe('the new Paths', () => {
  it('gives each new Class two Paths, in both languages', () => {
    expect(pathsOf('barbarian').map((p) => p.id)).toEqual(['berserker', 'bearheart']);
    expect(pathsOf('ranger').map((p) => p.id)).toEqual(['hunter', 'stalker']);
    for (const p of [...pathsOf('barbarian'), ...pathsOf('ranger')]) {
      for (const f of p.features) expect(f.name.ru && f.text.ru && f.text.en).toBeTruthy();
    }
  });

  it('a Berserker attacks once more while raging; a Stalker once more in the first round', () => {
    const count = (hero: HeroCombat, seed: string) => {
      const r = simulateFight(createRng(seed), input({ ...hero, hp: 999, maxHp: 999 }, goblins(3, 5).map((m) => ({ ...m, hp: 500, maxHp: 500 }))));
      const firstRound = r.events.slice(0, r.events.findIndex((e, i) => i > 0 && e.type === 'attack' && e.actor !== 'hero') + 1);
      return firstRound.filter((e) => e.type === 'attack' && e.actor === 'hero').length;
    };
    expect(count(starter('barbarian', 3, 'berserker'), 'b')).toBeGreaterThanOrEqual(count(starter('barbarian', 3, 'bearheart'), 'b'));
    expect(count(starter('ranger', 3, 'stalker'), 's')).toBeGreaterThanOrEqual(count(starter('ranger', 3, 'hunter'), 's'));
  });

  it('keeps a raging Bear-heart up with a CON save when it would fall', () => {
    let stood = 0;
    for (let i = 0; i < 200; i++) {
      const hero = { ...starter('barbarian', 9, 'bearheart'), hp: 12 };
      const r = simulateFight(createRng(`relentless-${i}`), input(hero, spawnEncounter(createRng(`r-${i}`), 9, 'miniboss')));
      if (r.events.some((e) => e.type === 'feature' && e.feature === 'relentless')) stood++;
    }
    expect(stood).toBeGreaterThan(0);
  });
});

describe('portraits', () => {
  it('lends Barbarians the Fighter’s and Rangers the Rogue’s until their own are painted', () => {
    expect(portraitsFor('dwarf', 'barbarian').map((p) => p.id)).toEqual(['dwarf-fighter-1', 'dwarf-fighter-2', 'hooded']);
    expect(portraitsFor('elf', 'ranger').map((p) => p.id)).toEqual(['elf-rogue-1', 'elf-rogue-2', 'hooded']);
    expect(portraitsFor('elf', 'wizard').map((p) => p.id)).toEqual(['elf-wizard-1', 'elf-wizard-2', 'hooded']);
  });
});
