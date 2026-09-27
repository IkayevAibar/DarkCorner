import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightInput, type HeroCombat, type StanceId, XP_FOR_LEVEL, abilityModifier, createRng, fightOdds,
  fireBomb, heroCombat, levelForXp, monsterById, instantiate, proficiencyBonus, restUses, simulateFight, sneakCheck, sneakDc,
  spawnEncounter, startingHealth, threatOf,
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
      const r = simulateFight(createRng(`saves-${i}`), { hero, monsters: brute, uses: { spells: 0, heals: 0 }, potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold' });
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

  it('never kills a Hero in a fight the Player was shown as Trivial: it is left for dead with 1 health', () => {
    let down = 0;
    for (let i = 0; i < 1_000; i++) {
      const hero = { ...starter('wizard'), hp: 1 };
      const brute = [instantiate(monsterById('wolf'), 3, 'm0')];
      const r = simulateFight(createRng(`spared-${i}`), {
        hero, monsters: brute, uses: { spells: 0, heals: 0 }, potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold', spare: true,
      });
      expect(r.outcome).not.toBe('dead');
      if (r.events.some((e) => e.type === 'down')) {
        down++;
        expect(r.outcome).toBe('survived');
        expect(r.hp).toBe(1);
        expect(r.events.some((e) => e.type === 'death-save')).toBe(false);
      }
    }
    expect(down).toBeGreaterThan(300);
  });

  it('rerolls one failed death save per Run with a Lucky charm, and saves more Heroes', () => {
    const run = (talents: HeroCombat['talents'], lucky: boolean) => {
      let dead = 0;
      let rerolls = 0;
      for (let i = 0; i < 3_000; i++) {
        const hero = { ...starter('wizard'), talents, hp: 1 };
        const brute = [instantiate(monsterById('wolf'), 3, 'm0')];
        const r = simulateFight(createRng(`lucky-${i}`), { hero, monsters: brute, uses: { spells: 0, heals: 0 }, potions: 0, runPowers: { deathless: false, lucky }, stance: 'bold' });
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

describe('Stance, ambushes, bombs and Escape rolls', () => {
  const pair = (floor = 3) => [instantiate(monsterById('wolf'), floor, 'm0'), instantiate(monsterById('goblin'), floor, 'm1')];
  const input = (hero: HeroCombat, extra: Partial<FightInput> = {}): FightInput => ({
    hero, monsters: pair(), uses: restUses(hero.class, hero.level), potions: 0, runPowers: { deathless: false, lucky: false }, ...extra,
  });

  it('lets a Bold Hero hit more and be hit more, and a Wary one be hit less', () => {
    const rates = (stance: StanceId) => {
      let heroHits = 0;
      let heroSwings = 0;
      let monsterHits = 0;
      let monsterSwings = 0;
      for (let i = 0; i < 400; i++) {
        const hero = { ...starter('fighter', 3), hp: 999, maxHp: 999 };
        for (const e of simulateFight(createRng(`stance-${stance}-${i}`), input(hero, { stance })).events) {
          if (e.type !== 'attack') continue;
          if (e.actor === 'hero') {
            heroSwings++;
            if (e.hit) heroHits++;
          } else {
            monsterSwings++;
            if (e.hit) monsterHits++;
          }
        }
      }
      return { hero: heroHits / heroSwings, monsters: monsterHits / monsterSwings };
    };
    const bold = rates('bold');
    const steady = rates('steady');
    const wary = rates('wary');
    expect(bold.hero).toBeGreaterThan(steady.hero + 0.08);
    expect(bold.monsters).toBeGreaterThan(steady.monsters + 0.08);
    expect(wary.monsters).toBeLessThan(steady.monsters - 0.05);
    expect(wary.hero).toBeLessThan(steady.hero);
  });

  it('keeps whoever was surprised still for the first round', () => {
    for (let i = 0; i < 60; i++) {
      const ambushed = simulateFight(createRng(`ambush-${i}`), input(starter('fighter', 3), { surprise: 'hero' }));
      expect(ambushed.events[1]).toEqual({ type: 'surprise', side: 'hero' });
      const first = ambushed.events.find((e) => e.type === 'attack');
      expect(first?.type === 'attack' && first.actor).not.toBe('hero');

      const caught = simulateFight(createRng(`caught-${i}`), input(starter('fighter', 3), { surprise: 'monsters' }));
      const opener = caught.events.find((e) => e.type === 'attack');
      expect(opener?.type === 'attack' && opener.actor).toBe('hero');
    }
  });

  it('opens with a Fire bomb that every monster takes alike', () => {
    const bomb = fireBomb(3);
    for (let i = 0; i < 30; i++) {
      const r = simulateFight(createRng(`bomb-${i}`), input(starter('wizard', 3), { bomb }));
      const burst = r.events[1]!;
      expect(burst.type).toBe('burst');
      if (burst.type !== 'burst') continue;
      expect(burst.source).toBe('bomb');
      expect(burst.targets).toHaveLength(2);
      const damage = burst.targets[0]!.damage;
      expect(burst.targets.every((x) => x.damage === damage)).toBe(true);
      expect(damage).toBeGreaterThanOrEqual(2 + bomb.bonus);
      expect(damage).toBeLessThanOrEqual(12 + bomb.bonus);
    }
    // A bomb that kills everything wins before anyone swings.
    const rats = [instantiate(monsterById('giant-rat'), 1, 'm0')];
    const r = simulateFight(createRng('overkill'), { ...input(starter('wizard', 1)), monsters: rats, bomb: { dice: 1, sides: 6, bonus: 50 } });
    expect(r.outcome).toBe('victory');
    expect(r.events.some((e) => e.type === 'attack')).toBe(false);
  });

  it('makes Escape rolls by Stance when badly hurt, and never when Bold', () => {
    let tries = 0;
    let escapes = 0;
    for (let i = 0; i < 300; i++) {
      const hero = { ...starter('rogue', 3), hp: 4 };
      const bold = simulateFight(createRng(`run-${i}`), input(hero, { stance: 'bold' }));
      expect(bold.events.some((e) => e.type === 'escape')).toBe(false);
      const wary = simulateFight(createRng(`run-${i}`), input(hero, { stance: 'wary' }));
      tries += wary.events.filter((e) => e.type === 'escape').length;
      if (wary.outcome === 'escaped') {
        escapes++;
        expect(wary.hp).toBeGreaterThan(0);
        expect(wary.events.at(-1)).toEqual({ type: 'end', outcome: 'escaped' });
      }
    }
    expect(tries).toBeGreaterThan(100);
    expect(escapes).toBeGreaterThan(50);
  });
});

describe('before the fight', () => {
  it('sets the Sneak Check: harder deeper and in numbers, heavy armor hinders, Rogues shine', () => {
    expect(sneakDc(1, 1)).toBe(10);
    expect(sneakDc(9, 3)).toBe(18);
    const fighter = starter('fighter', 3);
    expect(fighter.heavyArmor).toBe(true);
    expect(sneakCheck(fighter, 3, 2).edge).toBe('disadvantage');
    const rogue = starter('rogue', 5);
    const check = sneakCheck(rogue, 3, 2);
    expect(check).toMatchObject({ edge: 'advantage', dc: sneakDc(3, 2) });
    expect(check.modifier).toBe(abilityModifier(rogue.scores.dex) + proficiencyBonus(5));
    expect(sneakCheck({ ...rogue, escape: 10 }, 3, 2).modifier).toBe(check.modifier + 2);
  });

  it('rates Threat from how the fight tends to go', () => {
    expect(threatOf({ win: 1, death: 0 })).toBe('trivial');
    expect(threatOf({ win: 0.95, death: 0 })).toBe('easy');
    expect(threatOf({ win: 0.9, death: 0.06 })).toBe('risky');
    expect(threatOf({ win: 0.6, death: 0.2 })).toBe('dangerous');
    expect(threatOf({ win: 0.3, death: 0.5 })).toBe('deadly');
  });

  it('plays a fight over the same way for the same seed, from Trivial rats to a Deadly Dragon', () => {
    const dragon: FightInput = {
      hero: starter('fighter', 1), monsters: [instantiate(monsterById('ancient-dragon'), 10, 'm0')],
      uses: restUses('fighter', 1), potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold',
    };
    expect(fightOdds('same', dragon)).toEqual(fightOdds('same', dragon));
    expect(threatOf(fightOdds('dragon', dragon))).toBe('deadly');
    const rat: FightInput = { ...dragon, hero: starter('fighter', 5), monsters: [instantiate(monsterById('giant-rat'), 1, 'm0')], stance: 'steady' };
    expect(threatOf(fightOdds('rat', rat))).toBe('trivial');
  });
});
