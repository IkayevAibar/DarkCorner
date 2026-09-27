import { describe, expect, it } from 'vitest';
import {
  ALTAR_SUCCESS, LOCKPICK_DC, SHRINE_DC, cacheContents, createRng, goblinDice, merchantWares, nextTier, offerAtAltar,
  pickLock, prayAtShrine, springTrap, threeChests, tierRank, trapDc, drinkFountain, freePrisoner, readTome, searchBones,
} from '../src/index.js';

const plain = { modifier: 0, advantage: false, rerollOnes: false };

describe('Three chests', () => {
  it('always holds one gold chest, and sometimes a mimic', () => {
    const rng = createRng('three');
    let mimics = 0;
    for (let i = 0; i < 2000; i++) {
      const chests = threeChests(rng, 4);
      expect(chests).toHaveLength(3);
      expect(chests.filter((c) => c.kind === 'gold')).toHaveLength(1);
      if (chests.some((c) => c.kind === 'mimic')) mimics++;
    }
    expect(mimics / 2000).toBeGreaterThan(0.25);
    expect(mimics / 2000).toBeLessThan(0.35);
  });
});

describe('the Shrine', () => {
  it('blesses on a success and curses on a bad failure, unless sensed', () => {
    const rng = createRng('shrine');
    for (let i = 0; i < 3000; i++) {
      const r = prayAtShrine(rng, { ...plain, sensesCurses: false });
      if (r.check.success) expect(r).toMatchObject({ outcome: 'blessing' });
      else if (r.check.fumble || r.check.total <= SHRINE_DC - 5) expect(r.outcome).toBe('curse');
      else expect(r.outcome).toBe('nothing');
      if (r.outcome === 'blessing') expect(r.blessing).not.toBeNull();
      const w = prayAtShrine(rng, { ...plain, sensesCurses: true });
      expect(w.outcome).not.toBe('curse');
    }
  });

  it('is kinder with advantage (Clerics)', () => {
    const rng = createRng('cleric');
    let plainWins = 0;
    let advWins = 0;
    for (let i = 0; i < 20_000; i++) {
      if (prayAtShrine(rng, { ...plain, sensesCurses: false }).outcome === 'blessing') plainWins++;
      if (prayAtShrine(rng, { ...plain, advantage: true, sensesCurses: false }).outcome === 'blessing') advWins++;
    }
    expect(advWins).toBeGreaterThan(plainWins * 1.3);
  });
});

describe('the Goblin gambler', () => {
  it('wins ties for the house', () => {
    const rng = createRng('gamble');
    let wins = 0;
    for (let i = 0; i < 50_000; i++) {
      const r = goblinDice(rng, false);
      expect(r.win).toBe(r.hero > r.goblin);
      if (r.win) wins++;
    }
    expect(wins / 50_000).toBeGreaterThan(0.45);
    expect(wins / 50_000).toBeLessThan(0.5);
  });

  it('bets up one Tier, but not past Mythic', () => {
    expect(nextTier('epic')).toBe('legendary');
    expect(nextTier('mythic')).toBeNull();
    expect(nextTier('relic')).toBeNull();
  });
});

describe('the Wandering merchant', () => {
  it('sells three identified Rare-or-better wares', () => {
    const wares = merchantWares(createRng('merchant'), { floor: 6, classId: 'rogue' });
    expect(wares).toHaveLength(3);
    for (const w of wares) {
      expect(tierRank(w.tier)).toBeGreaterThanOrEqual(tierRank('rare'));
      expect(w.identified).toBe(true);
    }
  });
});

describe('the Trapped corridor', () => {
  it('hurts only on a failed Check, and Rogues disarm it', () => {
    const rng = createRng('trap');
    expect(springTrap(rng, { ...plain, floor: 5, disarms: true })).toEqual({ check: null, damage: 0 });
    for (let i = 0; i < 1000; i++) {
      const r = springTrap(rng, { ...plain, floor: 5, disarms: false });
      expect(r.check!.dc).toBe(trapDc(5));
      if (r.check!.success) expect(r.damage).toBe(0);
      else expect(r.damage).toBeGreaterThanOrEqual(2 + 5);
    }
  });
});

describe('the Cursed altar', () => {
  it('raises the Tier and adds a new Bonus stat 40% of the time', () => {
    const rng = createRng('altar');
    let ups = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const r = offerAtAltar(rng, { tier: 'uncommon', itemLevel: 3, bonusStats: [{ stat: 'str', value: 2 }] });
      if (!r.success) continue;
      ups++;
      expect(r.tier).toBe('rare');
      expect(r.stat!.stat).not.toBe('str');
    }
    expect(Math.abs(ups / n - ALTAR_SUCCESS)).toBeLessThan(0.015);
  });

  it('refuses Epic and above', () => {
    expect(() => offerAtAltar(createRng('x'), { tier: 'epic', itemLevel: 1, bonusStats: [] })).toThrow();
  });
});

describe('the Locked cache and Lockpicking', () => {
  it('holds two Items and gold', () => {
    const c = cacheContents(createRng('cache'), 2, 0);
    expect(c.tiers).toHaveLength(2);
    expect(c.gold).toBeGreaterThan(0);
  });

  it('gives a Chest only when the lock opens', () => {
    const rng = createRng('lock');
    for (let i = 0; i < 1000; i++) {
      const r = pickLock(rng, { ...plain, floor: 3 });
      expect(r.check.dc).toBe(LOCKPICK_DC);
      expect(r.chest !== null).toBe(r.check.success);
    }
  });
});

describe('the newer Event rooms', () => {
  it('the Fountain: foul on 1–4, clean to 12, glowing to 19, a spirit on 20', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const { check, outcome } = drinkFountain(createRng(`f-${i}`), { rerollOnes: false });
      const n = check.roll.natural;
      expect(outcome).toBe(n <= 4 ? 'foul' : n <= 12 ? 'clean' : n <= 19 ? 'glowing' : 'spirit');
      seen.add(outcome);
    }
    expect(seen.size).toBe(4);
  });

  it('the Prisoner is a doppelganger about one time in five', () => {
    let traps = 0;
    for (let i = 0; i < 2000; i++) {
      const r = freePrisoner(createRng(`p-${i}`), 5);
      if (r.trap) traps++;
      else {
        expect(r.tier).not.toBeNull();
        expect(r.gold).toBeGreaterThan(0);
      }
    }
    expect(traps / 2000).toBeGreaterThan(0.16);
    expect(traps / 2000).toBeLessThan(0.24);
  });

  it('the Library teaches 60 XP per Floor number on a success', () => {
    for (let i = 0; i < 200; i++) {
      const r = readTome(createRng(`l-${i}`), { modifier: 3, advantage: false, rerollOnes: false, floor: 4 });
      expect(r.xp).toBe(r.check.success ? 240 : 0);
      if (r.curse) expect(r.check.success).toBe(false);
    }
  });

  it('the Bone pile rises about a third of the time', () => {
    let risen = 0;
    for (let i = 0; i < 2000; i++) if (searchBones(createRng(`b-${i}`), 3).rise) risen++;
    expect(risen / 2000).toBeGreaterThan(0.3);
    expect(risen / 2000).toBeLessThan(0.4);
  });
});
