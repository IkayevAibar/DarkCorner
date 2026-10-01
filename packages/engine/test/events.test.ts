import { describe, expect, it } from 'vitest';
import {
  ALTAR_SUCCESS, CUPS, LOCK, LOCKPICK_DC, cupsEnd, cupsMaxBet, cupsWin, shellGame, SHRINE_DC, type Lock, cacheContents, createRng, goblinDice, lockJammed, lockOpen, makeLock, merchantWares, nextTier,
  offerAtAltar, tapLock,
  pickLock, prayAtShrine, springTrap, threeChests, tierRank, trapDc, drinkFountain, freePrisoner, readTome, searchBones, RIDDLES, statueRiddle,
  cookpotDc, cutWeb, tasteStew, webDc, BARGAIN_GOLD_PRICE, BARGAIN_ITEM_PRICE, banishDc, banishDevil, bloodPrice, devilOffers,
  pryLid, sarcophagusDc, CHAMPION_ODDS, HOARD_WAKE, grabHoard, listenToSkulls, skullsDc, takeChampionGear,
} from '../src/index.js';
import { type LockPin, lockPinAt, lockPinSets } from '@dark/shared';

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
      const r = offerAtAltar(rng, { base: 'ring', tier: 'uncommon', itemLevel: 3, bonusStats: [{ stat: 'str', value: 2 }] });
      if (!r.success) continue;
      ups++;
      expect(r.tier).toBe('rare');
      expect(r.stat!.stat).not.toBe('str');
    }
    expect(Math.abs(ups / n - ALTAR_SUCCESS)).toBeLessThan(0.015);
  });

  it('refuses Epic and above', () => {
    expect(() => offerAtAltar(createRng('x'), { base: 'ring', tier: 'epic', itemLevel: 1, bonusStats: [] })).toThrow();
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

  it('picked by hand: three pins, each set by stopping its marker in the sweet spot', () => {
    const lock = makeLock(createRng('hand'), 1, { rogue: false, dex: 0 });
    expect(lock.pins).toHaveLength(LOCK.pins);
    expect(lock.picks).toBe(LOCK.picks);
    expect(makeLock(createRng('hand'), 1, { rogue: false, dex: 0 })).toEqual(lock);
    // A marker sweeps 0 → 1 → 0 once a period.
    const pin = { period: 1000, phase: 0, center: 0.5, width: 0.1 };
    expect(lockPinAt(pin, 0)).toBe(0);
    expect(lockPinAt(pin, 250)).toBeCloseTo(0.5);
    expect(lockPinAt(pin, 500)).toBeCloseTo(1);
    expect(lockPinAt(pin, 1000)).toBeCloseTo(0);
    expect(lockPinSets(pin, 250)).toBe(true);
    expect(lockPinSets(pin, 400)).toBe(false);
    // Just past the spot still counts: the screen and the finger lag a little.
    expect(lockPinSets(pin, 290)).toBe(true);

    // Taps one at a time, until it opens or jams.
    const play = (l: Lock, taps: number[]) => {
      let at = { set: 0, broken: 0 };
      for (const ms of taps) if (!lockOpen(l, at) && !lockJammed(l, at)) at = tapLock(l, at, ms);
      return { ...at, open: lockOpen(l, at), jammed: lockJammed(l, at) };
    };

    const hit = (p: LockPin) => Math.round(((((p.center / 2 - p.phase) % 1) + 1) % 1) * p.period);
    const perfect = lock.pins.map(hit);
    expect(play(lock, perfect)).toEqual({ set: 3, broken: 0, open: true, jammed: false });
    // A miss breaks a pick and the pin sweeps again; out of picks, it jams.
    // Far from its spot: the end of the sweep away from it.
    const far = (p: LockPin) => Math.round(((((1 - p.phase) % 1) + 1) % 1) * p.period) + (p.center > 0.5 ? 0 : p.period / 2);
    expect(play(lock, [perfect[0]!, far(lock.pins[1]!), perfect[1]!, perfect[2]!])).toEqual({ set: 3, broken: 1, open: true, jammed: false });
    expect(play(lock, [far(lock.pins[0]!), far(lock.pins[0]!), perfect[0]!])).toEqual({ set: 0, broken: 2, open: false, jammed: true });
    expect(play(lock, [perfect[0]!])).toEqual({ set: 1, broken: 0, open: false, jammed: false });
  });

  it('sweeps quicker deeper down, and opens wider for Rogues and deft hands', () => {
    const shallow = makeLock(createRng('depth'), 1, { rogue: false, dex: 0 });
    const deep = makeLock(createRng('depth'), 10, { rogue: false, dex: 0 });
    expect(deep.pins[0]!.period).toBeLessThan(shallow.pins[0]!.period);
    const rogue = makeLock(createRng('depth'), 1, { rogue: true, dex: 3 });
    expect(rogue.picks).toBe(LOCK.roguePicks);
    expect(rogue.pins[0]!.width).toBeGreaterThan(shallow.pins[0]!.width * LOCK.rogueWidth);
    for (const p of [...shallow.pins, ...deep.pins]) {
      expect(p.center - p.width / 2).toBeGreaterThan(0);
      expect(p.center + p.width / 2).toBeLessThan(1);
    }
  });
});

describe('the goblin’s cups', () => {
  it('shuffle more and quicker deeper down, and the gem moves with its cup', () => {
    const shallow = shellGame(createRng('cups'), 1);
    const deep = shellGame(createRng('cups'), 10);
    expect(shallow.swaps).toHaveLength(CUPS.swaps + 1);
    expect(deep.swaps).toHaveLength(CUPS.swaps + 5);
    expect(deep.swapMs).toBeLessThan(shallow.swapMs);
    for (const [a, b] of deep.swaps) expect(a).not.toBe(b);
    expect(cupsEnd(0, [[0, 1], [1, 2]])).toBe(2);
    expect(cupsEnd(0, [[1, 2]])).toBe(0);
  });

  it('pay for the gem’s cup, or for a cheat called when he palmed it', () => {
    let palmed = 0;
    for (let i = 0; i < 400; i++) {
      const game = shellGame(createRng(`cups-${i}`), 5);
      const gem = cupsEnd(game.start, game.swaps);
      if (game.palmed) palmed++;
      expect(cupsWin(game, gem)).toBe(!game.palmed);
      expect(cupsWin(game, 'cheat')).toBe(game.palmed);
      expect(cupsWin(game, (gem + 1) % 3)).toBe(false);
    }
    expect(palmed / 400).toBeGreaterThan(0.15);
    expect(palmed / 400).toBeLessThan(0.35);
    expect(cupsMaxBet(4)).toBe(CUPS.stake * 5);
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

  it('the Goblin cookpot fills on a CON Check against 10 + half the Floor', () => {
    expect([1, 2, 3].map(cookpotDc)).toEqual([11, 11, 12]);
    for (let i = 0; i < 200; i++) {
      const r = tasteStew(createRng(`s-${i}`), { ...plain, modifier: 2, floor: 2 });
      expect(r.good).toBe(r.check.success);
      expect(r.check.dc).toBe(11);
    }
  });

  it('the Webbed body pays its purse either way, on a DEX Check against 11 + half the Floor', () => {
    expect([1, 2, 3].map(webDc)).toEqual([12, 12, 13]);
    for (let i = 0; i < 200; i++) {
      const r = cutWeb(createRng(`w-${i}`), { ...plain, floor: 2 });
      expect(r.gold).toBeGreaterThanOrEqual(30);
      expect(r.gold).toBeLessThanOrEqual(90);
      expect(r.check.dc).toBe(12);
    }
  });

  it('the Sarcophagus holds its grave goods either way, on a STR Check against 11 + half the Floor', () => {
    expect([4, 5, 6].map(sarcophagusDc)).toEqual([13, 14, 14]);
    for (let i = 0; i < 200; i++) {
      const r = pryLid(createRng(`lid-${i}`), { ...plain, floor: 5 });
      expect(r.gold).toBeGreaterThanOrEqual(120);
      expect(r.gold).toBeLessThanOrEqual(300);
      expect(r.check.dc).toBe(14);
    }
  });
});

describe('the Dragon’s lair', () => {
  it('the Whispering skulls are a WIS Check against 16 on Floor 10 that teaches 500 XP', () => {
    expect(skullsDc(10)).toBe(16);
    for (let i = 0; i < 200; i++) {
      const r = listenToSkulls(createRng(`skulls-${i}`), { ...plain, modifier: 3, floor: 10 });
      expect(r.check.dc).toBe(16);
      expect(r.xp).toBe(r.check.success ? 500 : 0);
    }
  });

  it('the Spilled hoard pays more per handful, and gets noticed more often the more is taken', () => {
    for (const handfuls of [1, 2, 3] as const) {
      let noticed = 0;
      for (let i = 0; i < 2000; i++) {
        const r = grabHoard(createRng(`hoard-${handfuls}-${i}`), 10, handfuls);
        expect(r.gold).toBeGreaterThanOrEqual(330 * handfuls);
        expect(r.gold).toBeLessThanOrEqual(660 * handfuls);
        if (r.noticed) noticed++;
      }
      expect(Math.abs(noticed / 2000 - HOARD_WAKE[handfuls])).toBeLessThan(0.04);
    }
  });

  it('the Fallen champion’s gear is Epic or better, and its shade rises about half the time', () => {
    let shades = 0;
    for (let i = 0; i < 2000; i++) {
      const r = takeChampionGear(createRng(`champion-${i}`));
      expect(tierRank(r.tier)).toBeGreaterThanOrEqual(tierRank('epic'));
      expect(CHAMPION_ODDS.some(([tier]) => tier === r.tier)).toBe(true);
      if (r.shade) shades++;
    }
    expect(shades / 2000).toBeGreaterThan(0.45);
    expect(shades / 2000).toBeLessThan(0.55);
  });
});

describe('the Devil’s bargain', () => {
  it('offers gold for a fifth of full health, or an Item of Rare or better that costs more the better it is', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const o = devilOffers(createRng(`deal-${i}`), 8);
      expect(o.gold).toBeGreaterThanOrEqual(270);
      expect(o.gold).toBeLessThanOrEqual(540);
      expect(o.goldPrice).toBe(BARGAIN_GOLD_PRICE);
      expect(o.itemPrice).toBe(BARGAIN_ITEM_PRICE[o.tier]);
      expect(o.itemPrice).toBeGreaterThan(o.goldPrice);
      seen.add(o.tier);
    }
    expect([...seen].sort()).toEqual(['epic', 'legendary', 'mythic', 'rare']);
    expect(devilOffers(createRng('deal-1'), 8)).toEqual(devilOffers(createRng('deal-1'), 8));
    const prices = (['rare', 'epic', 'legendary', 'mythic'] as const).map((tier) => BARGAIN_ITEM_PRICE[tier]!);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('prices in whole health, never below 1', () => {
    expect(bloodPrice(100, 0.2)).toBe(20);
    expect(bloodPrice(3, 0.2)).toBe(1);
  });

  it('banishing is a WIS Check against 12 + half the Floor that teaches XP', () => {
    expect([7, 8, 9].map(banishDc)).toEqual([16, 16, 17]);
    for (let i = 0; i < 200; i++) {
      const r = banishDevil(createRng(`banish-${i}`), { ...plain, modifier: 5, floor: 8 });
      expect(r.xp).toBe(r.check.success ? 480 : 0);
    }
  });
});

describe('the Riddling statue', () => {
  it('asks one riddle with three different answers, its own among them, the same for the same seed', () => {
    for (let i = 0; i < 200; i++) {
      const r = statueRiddle(createRng(`riddle-${i}`));
      expect(new Set(r.answers).size).toBe(3);
      expect(r.answers[r.right]).toBe(r.riddle);
      expect(statueRiddle(createRng(`riddle-${i}`))).toEqual(r);
    }
    expect(RIDDLES.length).toBeGreaterThanOrEqual(10);
    for (const riddle of RIDDLES) for (const t of [riddle.question, riddle.answer]) expect(t.en && t.ru).toBeTruthy();
  });
});
