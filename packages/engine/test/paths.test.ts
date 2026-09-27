import { describe, expect, it } from 'vitest';
import {
  CLASSES, CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type HeroCombat, type PathId, PATHS, POTIONS_PER_FIGHT, TALENTS,
  type TalentId, createRng, heroCombat, instantiate, luckOf, maxHealth, monsterById, onPath, pathsOf, pendingGrowth, potionHealing,
  restUses, simulateFight, sneakCheck, startingHealth, talentOffer, validateGrowth,
} from '../src/index.js';

function hero(cls: ClassId, level: number, opts: { path?: PathId | null; talents?: TalentId[]; hp?: number } = {}): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const talents = opts.talents ?? ['alert'];
  const maxHp = startingHealth(cls, 'human', talents, scores.con) + (level - 1) * 8;
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const h = heroCombat({ name: 'T', class: cls, race: 'human', level, talents, path: opts.path ?? null, scores, maxHp, hp: maxHp, worn });
  return opts.hp ? { ...h, hp: opts.hp, maxHp: Math.max(opts.hp, h.maxHp) } : h;
}

const fight = (seed: string, h: HeroCombat, monsters = [instantiate(monsterById('ghoul'), 5, 'm0')], extra: Partial<FightInput> = {}) =>
  simulateFight(createRng(seed), { hero: h, monsters, uses: restUses(h.class, h.level, h.path), potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold', ...extra });

const of = <T extends FightEvent['type']>(events: FightEvent[], type: T) => events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);

describe('Paths', () => {
  it('offers each Class two Paths, with features at 3 and 9', () => {
    for (const cls of CLASSES) {
      const paths = pathsOf(cls);
      expect(paths).toHaveLength(2);
      for (const p of paths) expect(p.features.map((f) => f.level)).toEqual([3, 9]);
    }
    expect(PATHS).toHaveLength(8);
    expect(onPath({ path: 'war', level: 3 }, 'war')).toBe(true);
    expect(onPath({ path: 'war', level: 8 }, 'war', 9)).toBe(false);
    expect(onPath({ path: 'life', level: 20 }, 'war')).toBe(false);
  });

  it('adds rest uses for Evokers and Life Clerics from level 9', () => {
    expect(restUses('wizard', 9, 'evoker').spells).toBe(restUses('wizard', 9).spells + 1);
    expect(restUses('wizard', 8, 'evoker').spells).toBe(restUses('wizard', 8).spells);
    expect(restUses('cleric', 9, 'life').heals).toBe(restUses('cleric', 9).heals + 1);
  });

  it('crits more often as a Champion', () => {
    const rate = (path: PathId | null) => {
      let crits = 0;
      let hits = 0;
      for (let i = 0; i < 300; i++) {
        for (const e of of(fight(`champ-${path}-${i}`, { ...hero('fighter', 5, { path }), hp: 999, maxHp: 999 }).events, 'attack')) {
          if (e.actor !== 'hero' || !e.hit) continue;
          hits++;
          if (e.crit) crits++;
        }
      }
      return crits / hits;
    };
    expect(rate('champion')).toBeGreaterThan(rate(null) + 0.03);
  });

  it('strikes back at a monster that misses a Guardian, once a round', () => {
    let ripostes = 0;
    for (let i = 0; i < 100; i++) {
      const r = fight(`guard-${i}`, { ...hero('fighter', 5, { path: 'guardian' }), hp: 999, maxHp: 999 });
      r.events.forEach((e, n) => {
        const next = r.events[n + 1];
        if (e.type === 'attack' && e.actor === 'm0' && !e.hit && next?.type === 'attack' && next.actor === 'hero') ripostes++;
      });
    }
    expect(ripostes).toBeGreaterThan(20);
  });

  it('lets an Assassin’s Sneak attack hit hard every round', () => {
    const perHit = (path: PathId | null) => {
      let damage = 0;
      let hits = 0;
      for (let i = 0; i < 300; i++) {
        const target = [{ ...instantiate(monsterById('ghoul'), 5, 'm0'), hp: 400, maxHp: 400 }];
        const events = fight(`sneak-${path}-${i}`, { ...hero('rogue', 9, { path }), hp: 999, maxHp: 999 }, target).events;
        const hits_ = of(events, 'attack').filter((e) => e.actor === 'hero' && e.hit && !e.crit).slice(1, 6);
        for (const e of hits_) {
          damage += e.damage;
          hits++;
        }
      }
      return damage / hits;
    };
    expect(perHit('assassin')).toBeGreaterThan(perHit(null) * 1.3);
  });

  it('raises an Abjurer’s ward that soaks blows before health', () => {
    const r = fight('ward', { ...hero('wizard', 5, { path: 'abjurer' }), hp: 999, maxHp: 999 });
    const wards = of(r.events, 'feature').filter((e) => e.feature === 'ward');
    // 3 × level + INT modifier (16 INT: +3).
    expect(wards[0]).toMatchObject({ left: 3 * 5 + 3 });
    const soaks = wards.slice(1);
    expect(soaks.length).toBeGreaterThan(0);
    expect(soaks.reduce((s, e) => s + (e.amount ?? 0), 0)).toBeLessThanOrEqual(18);
  });

  it('gives War Clerics two attacks a turn from level 9', () => {
    const swings = (level: number) => {
      // A zombie: no paralysis to cost the Cleric turns.
      const r = fight(`war-${level}`, { ...hero('cleric', level, { path: 'war' }), hp: 999, maxHp: 999 }, [{ ...instantiate(monsterById('zombie'), 5, 'm0'), hp: 999, maxHp: 999 }]);
      const rounds = of(r.events, 'attack').filter((e) => e.actor === 'm0').length;
      return of(r.events, 'attack').filter((e) => e.actor === 'hero').length / Math.max(1, rounds);
    };
    expect(swings(9)).toBeGreaterThan(1.8);
    expect(swings(8)).toBeLessThan(1.2);
  });

  it('lets a Thief drink the first potion and still attack that turn', () => {
    let both = 0;
    for (let i = 0; i < 100; i++) {
      const h = { ...hero('rogue', 5, { path: 'thief' }), hp: 5 };
      const events = fight(`thief-${i}`, h, [{ ...instantiate(monsterById('zombie'), 5, 'm0'), hp: 200, maxHp: 200 }], { potions: 3 }).events;
      const potion = events.findIndex((e) => e.type === 'heal' && e.ability === 'potion');
      if (potion >= 0 && events[potion + 1]?.type === 'attack' && (events[potion + 1] as { actor: string }).actor === 'hero') both++;
    }
    expect(both).toBeGreaterThan(50);
  });
});

describe('growing', () => {
  it('waits at levels 4, 8, 12, 16 and 19 until each is chosen', () => {
    expect(pendingGrowth(3, [])).toEqual([]);
    expect(pendingGrowth(9, [])).toEqual([4, 8]);
    expect(pendingGrowth(9, [{ level: 4 }])).toEqual([8]);
    expect(pendingGrowth(20, [{ level: 4 }, { level: 8 }, { level: 12 }, { level: 16 }, { level: 19 }])).toEqual([]);
  });

  it('offers the same three Talents the Hero lacks, every time it looks', () => {
    const offer = talentOffer('hero-1', 4, ['alert', 'tough']);
    expect(offer).toHaveLength(3);
    expect(offer).toEqual(talentOffer('hero-1', 4, ['alert', 'tough']));
    expect(offer.some((t) => t === 'alert' || t === 'tough')).toBe(false);
    for (const t of offer) expect(TALENTS).toContain(t);
    expect(talentOffer('hero-1', 8, ['alert', 'tough'])).not.toEqual(offer);
  });

  it('refuses growth past 20 in an ability, twice the same ability, or a Talent not offered', () => {
    const scores = { str: 19, dex: 14, con: 14, int: 10, wis: 12, cha: 10 };
    expect(validateGrowth({ kind: 'ability', ability: 'str' }, scores, [])).toEqual(['ability_cap']);
    expect(validateGrowth({ kind: 'ability', ability: 'dex' }, scores, [])).toEqual([]);
    expect(validateGrowth({ kind: 'abilities', abilities: ['str', 'dex'] }, scores, [])).toEqual([]);
    expect(validateGrowth({ kind: 'abilities', abilities: ['dex', 'dex'] }, scores, [])).toEqual(['same_ability']);
    expect(validateGrowth({ kind: 'talent', talent: 'fireproof' }, scores, ['scavenger'])).toEqual(['not_offered']);
    expect(validateGrowth({ kind: 'talent', talent: 'scavenger' }, scores, ['scavenger'])).toEqual([]);
  });
});

describe('Talents learned by growing', () => {
  it('toughen armor, sharpen blows, and ease Sneaking', () => {
    expect(hero('fighter', 5, { talents: ['battle-hardened'] }).ac).toBe(hero('fighter', 5).ac + 1);
    const plain = sneakCheck(hero('fighter', 5), 3, 1);
    const light = sneakCheck(hero('fighter', 5, { talents: ['light-step'] }), 3, 1);
    expect(plain.edge).toBe('disadvantage');
    expect(light.edge).toBe('normal');
    expect(light.modifier).toBe(plain.modifier + 2);
  });

  it('halves fire for the Fireproof', () => {
    const burned = (talents: TalentId[]) => {
      let total = 0;
      for (let i = 0; i < 100; i++) {
        const r = fight(`fire-${i}`, { ...hero('fighter', 8, { talents }), hp: 999, maxHp: 999 }, [instantiate(monsterById('hellhound'), 8, 'm0')]);
        total += of(r.events, 'power').filter((e) => e.power === 'breath').reduce((s, e) => s + (e.amount ?? 0), 0);
      }
      return total;
    };
    expect(burned(['fireproof'])).toBeLessThan(burned(['alert']) * 0.65);
  });

  it('adds magic find and gold find', () => {
    const luck = luckOf({ worn: [], blessing: null, talents: ['scavenger', 'treasure-hunter'] });
    expect(luck).toMatchObject({ magicFind: 10, goldFind: 20 });
    expect(luckOf({ worn: [], blessing: null, path: 'thief', level: 3 }).goldFind).toBe(20);
    expect(luckOf({ worn: [], blessing: null, path: 'thief', level: 2 }).goldFind).toBe(0);
  });
});

describe('health and potions', () => {
  it('counts "+max health" gear in full health, and clamps health when gear comes off', () => {
    const worn = [{ bonusStats: [{ stat: 'maxHp', value: 20 }], radiant: false }, { bonusStats: [{ stat: 'maxHp', value: 10 }], radiant: true }];
    expect(maxHealth(50, worn)).toBe(50 + 20 + 11);
    const h = heroCombat({
      name: 'T', class: 'fighter', race: 'human', level: 1, talents: [], scores: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      maxHp: 20, hp: 45, worn: [],
    });
    expect(h.hp).toBe(20);
  });

  it('heals more deep down, and no more than three potions a fight', () => {
    const rng = createRng('potion');
    const small = potionHealing(rng, 20, false);
    const big = potionHealing(createRng('potion'), 300, false);
    expect(big - small).toBe(Math.round(300 * 0.1) - Math.round(20 * 0.1));
    let most = 0;
    for (let i = 0; i < 100; i++) {
      const r = fight(`drink-${i}`, { ...hero('wizard', 5), hp: 3 }, [{ ...instantiate(monsterById('zombie'), 5, 'm0'), hp: 300, maxHp: 300 }], { potions: 10 });
      most = Math.max(most, r.potionsUsed);
    }
    expect(most).toBe(POTIONS_PER_FIGHT);
  });
});
