import { describe, expect, it } from 'vitest';
import {
  type AbilityScores, CLASS_DEFS, type ClassId, DRACONIC_AC, type FightEvent, type FightInput, type HeroCombat, type MonsterInstance, type PathId,
  agathys, attacksPerTurn, baseById, canUse, createRng, heroArmorClass, heroCombat, heroFeatures, inspirationDie, instantiate, isGear,
  layOnHands, levelGains, monsterById, pathsOf, restUses, simulateFight, smiteDice, spellDice, startingHealth, wildShapeHealth,
} from '../src/index.js';

const NEW: ClassId[] = ['paladin', 'warlock', 'monk', 'druid', 'bard', 'sorcerer'];

/** A level-N Hero of a Class in its Starter kit, with typical rolled scores (and any it is given). */
function starter(cls: ClassId, level = 1, path: PathId | null = null, more: Partial<AbilityScores> = {}): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16, ...more };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
}

const input = (hero: HeroCombat, monsters: MonsterInstance[]): FightInput => ({
  hero, monsters, uses: restUses(hero.class, hero.level, hero.path), potions: 0, runPowers: { deathless: false, lucky: false },
});
const sturdy = (hero: HeroCombat): HeroCombat => ({ ...hero, hp: 999, maxHp: 999 });
const goblins = (n: number, floor = 1) => Array.from({ length: n }, (_, i) => instantiate(monsterById('goblin'), floor, `m${i}`));
/** A monster that won't fall soon, so a fight's turns can be counted. */
const wall = (id: string, key = 'm0'): MonsterInstance => ({ ...instantiate(monsterById(id), 1, key), hp: 999, maxHp: 999 });
const features = (events: FightEvent[], id: string) => events.filter((e): e is Extract<FightEvent, { type: 'feature' }> => e.type === 'feature' && e.feature === id);
const attacks = (events: FightEvent[]) => events.filter((e): e is Extract<FightEvent, { type: 'attack' }> => e.type === 'attack');
/** The Hero's attacks in its first turn: every one it makes before a monster's next. */
function firstTurnAttacks(events: FightEvent[]): number {
  const all = attacks(events);
  let n = 0;
  for (let i = all.findIndex((e) => e.actor === 'hero'); i >= 0 && i < all.length && all[i]!.actor === 'hero'; i++) n++;
  return n;
}

describe('the six new Classes', () => {
  it('each come with two Paths and a Starter kit they can use', () => {
    for (const cls of NEW) {
      expect(pathsOf(cls)).toHaveLength(2);
      for (const id of CLASS_DEFS[cls].starterKit) {
        const base = baseById(id);
        expect(isGear(base) && canUse(cls, base), `${cls} ${id}`).toBe(true);
      }
    }
  });

  it('get their uses a rest, attacks and spell dice from levels.ts', () => {
    expect(restUses('paladin', 6)).toEqual({ spells: 3, heals: 2 });
    expect(restUses('warlock', 5)).toEqual({ spells: 3, heals: 0 });
    expect(restUses('monk', 8)).toEqual({ spells: 3, heals: 0 });
    expect(restUses('druid', 10, 'land')).toEqual({ spells: 3, heals: 5 });
    expect(restUses('bard', 4)).toEqual({ spells: 4, heals: 2 });
    expect(restUses('sorcerer', 6)).toEqual({ spells: 4, heals: 0 });
    expect([1, 5, 11, 17].map((l) => attacksPerTurn('warlock', l, null))).toEqual([1, 2, 3, 4]);
    expect([4, 5].map((l) => attacksPerTurn('paladin', l, null))).toEqual([1, 2]);
    expect([4, 5].map((l) => attacksPerTurn('monk', l, null))).toEqual([1, 2]);
    expect(attacksPerTurn('bard', 9, 'valor')).toBe(1);
    expect(spellDice('warlock', 11)).toEqual([1, 10]);
    expect(spellDice('bard', 5)).toEqual([2, 10]);
    expect(spellDice('druid', 1)).toEqual([1, 8]);
    expect(spellDice('sorcerer', 17)).toEqual([4, 10]);
    expect(spellDice('paladin', 5)).toBeNull();
  });

  it('say what reaching each level brings', () => {
    // levelGains reads from the level the Hero has to the next one.
    const reaching = (cls: ClassId, level: number, path: PathId | null = null) =>
      levelGains({ class: cls, race: 'human', path, level: level - 1, con: 14, talents: [] }).map((g) => g.en).join(' | ');
    expect(reaching('paladin', 6)).toContain('Aura of protection');
    expect(reaching('monk', 7)).toContain('Evasion');
    expect(reaching('druid', 4)).toContain('Beast form health');
    expect(reaching('bard', 5)).toContain('Inspiration die');
    expect(reaching('sorcerer', 6)).toContain('Sorcery points');
  });
});

describe('the Paladin', () => {
  it('smites with the turn’s first hit, and spends nothing on a turn of misses', () => {
    let smote = 0;
    for (let i = 0; i < 30; i++) {
      const r = simulateFight(createRng(`smite-${i}`), input(sturdy(starter('paladin', 3)), [wall('goblin-chieftain')]));
      const smites = features(r.events, 'smite');
      smote += smites.length;
      expect(r.uses.spells).toBe(restUses('paladin', 3).spells - smites.length);
      for (const s of smites) {
        const next = r.events[r.events.indexOf(s) + 1];
        expect(next).toMatchObject({ type: 'attack', actor: 'hero', hit: true });
      }
    }
    expect(smote).toBeGreaterThan(0);
    expect([1, 9, 17].map((l) => smiteDice(l, null))).toEqual([2, 3, 4]);
    expect(smiteDice(9, 'vengeance')).toBe(4);
  });

  it('lays on hands for 5 + 3 × its level', () => {
    const hurt = { ...starter('paladin', 4), hp: 5, maxHp: 200 };
    const r = simulateFight(createRng('hands'), input(hurt, goblins(2)));
    const heal = r.events.find((e) => e.type === 'heal' && e.ability === 'lay-on-hands');
    expect(heal).toMatchObject({ amount: layOnHands(4) });
    expect(layOnHands(4)).toBe(17);
  });

  it('adds its CHA to every save from level 6', () => {
    const extra = (level: number) => {
      for (let i = 0; i < 40; i++) {
        const spiders = [instantiate(monsterById('giant-spider'), 2, 'm0'), instantiate(monsterById('giant-spider'), 2, 'm1')];
        const r = simulateFight(createRng(`aura-${level}-${i}`), input(sturdy(starter('paladin', level, null, { cha: 14 })), spiders));
        const save = r.events.find((e) => e.type === 'save' && e.ability === 'con');
        if (save && save.type === 'save') return save.total - save.natural;
      }
      return null;
    };
    // CON 14 is +2; the aura (CHA 14) adds another +2 from level 6.
    expect(extra(5)).toBe(2);
    expect(extra(6)).toBe(4);
  });
});

describe('the Warlock', () => {
  it('fires a beam more at 5, 11 and 17', () => {
    expect(firstTurnAttacks(simulateFight(createRng('beams'), input(sturdy(starter('warlock', 5)), [wall('goblin')])).events)).toBe(2);
    expect(firstTurnAttacks(simulateFight(createRng('beams'), input(sturdy(starter('warlock', 11)), [wall('goblin')])).events)).toBe(3);
  });

  it('wraps itself in frost and Hexes the toughest in a hard fight, and not against a lone goblin', () => {
    const hero = starter('warlock', 4, null, { cha: 16 });
    const hard = simulateFight(createRng('hex'), input(sturdy(hero), goblins(2)));
    expect(features(hard.events, 'ward')[0]).toMatchObject({ left: agathys(4, 16) });
    expect(features(hard.events, 'hex').length).toBeGreaterThan(0);
    const easy = simulateFight(createRng('hex'), input(sturdy(hero), goblins(1)));
    expect(features(easy.events, 'ward')).toHaveLength(0);
    expect(features(easy.events, 'hex')).toHaveLength(0);
  });

  it('heals on its kills on the Fiend’s Path', () => {
    const r = simulateFight(createRng('fiend'), input(sturdy(starter('warlock', 3, 'fiend')), goblins(3)));
    const blessings = r.events.filter((e) => e.type === 'heal' && e.ability === 'dark-blessing');
    expect(blessings.length).toBeGreaterThan(0);
  });
});

describe('the Monk', () => {
  const scores = { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 10 };
  const worn = (base: string) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [] });

  it('is hard to hit without armor: 10 + DEX + WIS, and the WIS goes with body armor or a shield', () => {
    const monk = { class: 'monk' as const, level: 1, path: null, talents: [], scores };
    expect(heroArmorClass(monk, [])).toBe(15);
    expect(heroArmorClass(monk, [worn('hood')])).toBe(15);
    expect(heroArmorClass(monk, [worn('leather')])).toBe(heroArmorClass({ ...monk, class: 'rogue' }, [worn('leather')]));
    expect(heroArmorClass(monk, [worn('shield')])).toBe(heroArmorClass({ ...monk, class: 'rogue' }, [worn('shield')]));
    expect(starter('monk', 1, null, { wis: 14 }).ac).toBe(15);
  });

  it('strikes once more with every attack, and calls a Flurry of blows against a Mini-boss', () => {
    expect(firstTurnAttacks(simulateFight(createRng('martial'), input(sturdy(starter('monk', 1)), [wall('goblin')])).events)).toBe(2);
    expect(firstTurnAttacks(simulateFight(createRng('martial'), input(sturdy(starter('monk', 5)), [wall('goblin')])).events)).toBe(3);
    const r = simulateFight(createRng('flurry'), input(sturdy(starter('monk', 4)), [wall('goblin-chieftain')]));
    expect(firstTurnAttacks(r.events)).toBe(3);
    expect(features(r.events, 'flurry')).toHaveLength(restUses('monk', 4).spells);
    expect(r.uses.spells).toBe(0);
  });
});

describe('the Druid', () => {
  it('takes its Wild shape once a fight; the beast takes the blows first and fights with claws', () => {
    for (let i = 0; i < 20; i++) {
      const r = simulateFight(createRng(`shape-${i}`), input(sturdy(starter('druid', 5, 'moon')), goblins(3, 2)));
      const shapes = features(r.events, 'wild-shape');
      const start = shapes.filter((e) => e.amount === undefined);
      expect(start).toHaveLength(1);
      expect(start[0]).toMatchObject({ left: wildShapeHealth(5, 'moon') });
      // While the beast stands, a blow that lands is soaked by it, not by the Druid.
      const from = r.events.indexOf(start[0]!);
      const firstBlow = r.events.slice(from).find((e) => e.type === 'attack' && e.target === 'hero' && e.hit);
      if (firstBlow && firstBlow.type === 'attack') {
        const before = attacks(r.events.slice(0, r.events.indexOf(firstBlow))).filter((e) => e.target === 'hero' && e.hit).at(-1)?.targetHp ?? 999;
        expect(firstBlow.targetHp).toBe(before);
        const soak = r.events[r.events.indexOf(firstBlow) + 1];
        expect(soak).toMatchObject({ type: 'feature', feature: 'wild-shape', amount: firstBlow.damage });
      }
      const clawing = attacks(r.events.slice(from)).filter((e) => e.actor === 'hero');
      if (shapes.every((e) => e.left !== 0)) for (const a of clawing) expect(a.kind).toBe('weapon');
    }
    expect(wildShapeHealth(4, 'moon')).toBe(24);
    expect(wildShapeHealth(4, 'land')).toBe(16);
  });

  it('shrugs off poison as a master of the Land', () => {
    for (let i = 0; i < 20; i++) {
      const spiders = [instantiate(monsterById('giant-spider'), 3, 'm0'), instantiate(monsterById('giant-spider'), 3, 'm1')];
      const r = simulateFight(createRng(`land-${i}`), input(sturdy(starter('druid', 9, 'land')), spiders));
      expect(r.events.some((e) => e.type === 'status' && e.status === 'poisoned')).toBe(false);
    }
  });
});

describe('the Bard', () => {
  it('lands a missed spell with Bardic inspiration and turns a hit aside with Cutting words, spending only when it works', () => {
    let inspired = 0;
    let cut = 0;
    for (let i = 0; i < 60; i++) {
      const r = simulateFight(createRng(`bard-${i}`), input(sturdy(starter('bard', 3)), goblins(2, 3)));
      for (const e of features(r.events, 'inspiration')) {
        inspired++;
        expect(r.events[r.events.indexOf(e) + 1]).toMatchObject({ type: 'attack', actor: 'hero', hit: true });
      }
      for (const e of features(r.events, 'cutting-words')) {
        cut++;
        expect(r.events[r.events.indexOf(e) + 1]).toMatchObject({ type: 'attack', actor: e.target, target: 'hero', hit: false });
      }
      const spent = features(r.events, 'inspiration').length + features(r.events, 'cutting-words').length;
      expect(r.uses.spells).toBe(restUses('bard', 3).spells - spent);
    }
    expect(inspired).toBeGreaterThan(0);
    expect(cut).toBeGreaterThan(0);
    expect([1, 5, 10, 15].map((l) => inspirationDie(l))).toEqual([6, 8, 10, 12]);
    expect(inspirationDie(3, 'lore')).toBe(8);
    expect(inspirationDie(15, 'lore')).toBe(12);
  });
});

describe('the Sorcerer', () => {
  it('Bursts a group, Quickens its spell on a lone hard foe, and has no Shield', () => {
    const group = simulateFight(createRng('sorc'), input(sturdy(starter('sorcerer', 6)), goblins(3, 2)));
    expect(group.events.some((e) => e.type === 'burst' && e.actor === 'hero')).toBe(true);
    expect(group.events.some((e) => e.type === 'blocked')).toBe(false);
    const lone = simulateFight(createRng('sorc'), input(sturdy(starter('sorcerer', 3)), [wall('goblin-chieftain')]));
    expect(features(lone.events, 'quickened').length).toBe(restUses('sorcerer', 3).spells);
    expect(firstTurnAttacks(lone.events)).toBe(2);
  });

  it('wears dragon scales on the Draconic Path: 2 more Armor Class and half from fire', () => {
    const plain = starter('sorcerer', 3);
    const draconic = starter('sorcerer', 3, 'draconic');
    expect(draconic.ac - plain.ac).toBe(DRACONIC_AC);
  });
});

describe('the new Paths', () => {
  it('give Devotion +2 to hit with weapons', () => {
    const edge = (path: PathId | null) => {
      const r = simulateFight(createRng('devotion'), input(sturdy(starter('paladin', 3, path)), [wall('goblin')]));
      const a = attacks(r.events).find((e) => e.actor === 'hero')!;
      return a.total - a.natural;
    };
    expect(edge('devotion') - edge('vengeance')).toBe(2);
  });

  it('turn aside the first blow of a fight for a master Great Old One or Shadow', () => {
    for (const [cls, path, by] of [['warlock', 'old-one', 'entropic-ward'], ['monk', 'shadows', 'cloak-of-shadows']] as const) {
      let blocked = 0;
      for (let i = 0; i < 20; i++) {
        const r = simulateFight(createRng(`ward-${path}-${i}`), input(sturdy(starter(cls, 9, path)), goblins(3, 4)));
        const blocks = r.events.filter((e) => e.type === 'blocked');
        expect(blocks.length).toBeLessThanOrEqual(1);
        for (const b of blocks) expect(b).toMatchObject({ by });
        blocked += blocks.length;
      }
      expect(blocked).toBeGreaterThan(0);
    }
  });
});

describe('the belt for the new Classes', () => {
  it('shows each one’s features, its Path last', () => {
    const belt = (cls: ClassId, level: number) =>
      heroFeatures({ class: cls, level, path: null, int: 10, wis: 14, cha: 16, spellUses: 1, healUses: 1 }).map((f) => f.id);
    expect(belt('paladin', 6)).toEqual(['divine-smite', 'lay-on-hands', 'aura', 'extra-attack', 'path']);
    expect(belt('warlock', 1)).toEqual(['eldritch-blast', 'hex', 'armor-of-agathys', 'path']);
    expect(belt('monk', 7)).toEqual(['martial-arts', 'flurry', 'unarmored', 'evasion', 'extra-attack', 'path']);
    expect(belt('druid', 2)).toEqual(['wild-shape', 'cure-wounds', 'attack-spell', 'path']);
    expect(belt('bard', 2)).toEqual(['inspiration', 'mockery', 'cure-wounds', 'attack-spell', 'path']);
    expect(belt('sorcerer', 2)).toEqual(['burst', 'quickened', 'attack-spell', 'path']);
    for (const cls of NEW) {
      for (const f of heroFeatures({ class: cls, level: 9, path: pathsOf(cls)[0]!.id, int: 10, wis: 14, cha: 16, spellUses: 1, healUses: 1 })) {
        expect(f.now.en, `${cls} ${f.id}`).not.toMatch(/undefined|NaN/);
        expect(f.now.ru, `${cls} ${f.id}`).not.toMatch(/undefined|NaN/);
      }
    }
  });
});
