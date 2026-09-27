import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightInput, type HeroCombat, XP_FOR_LEVEL, createRng, heroCombat, levelForXp,
  monsterById, instantiate, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

/** A fresh level-N Hero of a Class in its Starter kit, with typical rolled scores. */
function starter(cls: ClassId, level = 1, extraHp = 0): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 1 + 2 + 2) + extraHp;
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
}

const fightInput = (hero: HeroCombat, floor: number, seed: string): FightInput => ({
  hero,
  monsters: spawnEncounter(createRng(`${seed}:spawn`), floor, 'fight'),
  uses: restUses(hero.class, hero.level),
  potions: 2,
  runPowers: { deathless: false, lucky: false },
});

describe('levels', () => {
  it('reads levels off the XP table', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(XP_FOR_LEVEL[20]!)).toBe(20);
    expect(levelForXp(10 ** 9)).toBe(20);
  });
});

describe('simulateFight', () => {
  it('replays exactly from the same seed', () => {
    const input = fightInput(starter('fighter'), 2, 'same');
    expect(simulateFight(createRng('same'), input)).toEqual(simulateFight(createRng('same'), input));
  });

  it('always ends, and the last event says how', () => {
    for (let i = 0; i < 300; i++) {
      const result = simulateFight(createRng(`end-${i}`), fightInput(starter('rogue'), 1 + (i % 3), `end-${i}`));
      expect(result.events.at(-1)).toEqual({ type: 'end', outcome: result.outcome });
      if (result.outcome === 'victory') expect(result.hp).toBeGreaterThan(0);
      if (result.outcome === 'dead') expect(result.hp).toBe(0);
    }
  });

  it('lets every level-1 Class win on Floor 1 almost always', () => {
    for (const cls of ['fighter', 'rogue', 'wizard', 'cleric'] as const) {
      let wins = 0;
      const n = 2_000;
      for (let i = 0; i < n; i++) {
        if (simulateFight(createRng(`${cls}-${i}`), fightInput(starter(cls), 1, `${cls}-${i}`)).outcome === 'victory') wins++;
      }
      expect(wins / n, `${cls} win rate on Floor 1`).toBeGreaterThan(0.85);
    }
  });

  it('makes the Dragon too much for a low-level Hero', () => {
    let wins = 0;
    for (let i = 0; i < 200; i++) {
      const hero = starter('fighter', 5);
      const dragon = [instantiate(monsterById('ancient-dragon'), 10, 'm0')];
      const r = simulateFight(createRng(`dragon-${i}`), { hero, monsters: dragon, uses: restUses('fighter', 5), potions: 5, runPowers: { deathless: false, lucky: false } });
      if (r.outcome === 'victory') wins++;
    }
    expect(wins).toBe(0);
  });

  it('kills about 4 in 10 Heroes who go down, as death saves should', () => {
    let down = 0;
    let dead = 0;
    for (let i = 0; i < 3_000; i++) {
      const hero = { ...starter('wizard'), hp: 1 };
      const brute = [instantiate(monsterById('wolf'), 3, 'm0')];
      const r = simulateFight(createRng(`saves-${i}`), { hero, monsters: brute, uses: { spells: 0, heals: 0 }, potions: 0, runPowers: { deathless: false, lucky: false } });
      const saves = r.events.filter((e) => e.type === 'down').length;
      if (saves > 0) {
        down++;
        if (r.outcome === 'dead') dead++;
      }
    }
    // Several downs per fight are possible after a natural 20, so the share of
    // deaths per fight sits a little above the single-save 40%.
    expect(dead / down).toBeGreaterThan(0.33);
    expect(dead / down).toBeLessThan(0.7);
  });

  it('rerolls one failed death save per Run with a Lucky charm, and saves more Heroes', () => {
    const run = (talents: HeroCombat['talents'], lucky: boolean) => {
      let dead = 0;
      let rerolls = 0;
      for (let i = 0; i < 3_000; i++) {
        const hero = { ...starter('wizard'), talents, hp: 1 };
        const brute = [instantiate(monsterById('wolf'), 3, 'm0')];
        const r = simulateFight(createRng(`lucky-${i}`), { hero, monsters: brute, uses: { spells: 0, heals: 0 }, potions: 0, runPowers: { deathless: false, lucky } });
        const used = r.events.filter((e) => e.type === 'reroll');
        expect(used.length).toBeLessThanOrEqual(1);
        if (used.length > 0) expect(r.runPowers.lucky).toBe(false);
        rerolls += used.length;
        if (r.outcome === 'dead') dead++;
      }
      return { dead, rerolls };
    };
    const plain = run(['alert', 'tough'], true);
    const charmed = run(['lucky-charm', 'tough'], true);
    const spent = run(['lucky-charm', 'tough'], false);
    expect(plain.rerolls).toBe(0);
    expect(spent.rerolls).toBe(0);
    expect(charmed.rerolls).toBeGreaterThan(0);
    expect(charmed.dead).toBeLessThan(plain.dead);
  });

  it('awards XP only for monsters defeated', () => {
    const r = simulateFight(createRng('xp'), fightInput(starter('fighter'), 1, 'xp'));
    if (r.outcome === 'victory') expect(r.xp).toBeGreaterThan(0);
    expect(r.defeated.length).toBe(r.events.filter((e) => e.type === 'defeated').length);
  });
});
