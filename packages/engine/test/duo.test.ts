import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, DUO, type FightEvent, type FightInput, type HeroCombat, createRng, duoEncounter, forAlly, heroCombat, partnerRaises, restUses,
  simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

function starter(cls: ClassId, level: number): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const h = heroCombat({ name: cls, class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}
const side = (h: HeroCombat, stance: 'bold' | 'steady' | 'wary' = 'steady') =>
  ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 2, runPowers: { deathless: false, lucky: false }, stance });
const duoFight = (a: HeroCombat, b: HeroCombat, floor: number, seed: string, stance: 'bold' | 'steady' | 'wary' = 'steady'): FightInput =>
  ({ ...side(a, stance), monsters: duoEncounter(createRng(`${seed}:m`), floor, 'fight'), ally: side(b, stance) });

describe('Duo fights', () => {
  it('put both Heroes in the initiative, the blows and the monsters’ sights', () => {
    let allyBlows = 0;
    let allyHit = 0;
    for (let i = 0; i < 40; i++) {
      const r = simulateFight(createRng(`duo-${i}`), duoFight(starter('fighter', 4), starter('rogue', 4), 3, `duo-${i}`));
      const init = r.events.find((e) => e.type === 'initiative') as Extract<FightEvent, { type: 'initiative' }>;
      expect(init.order).toContain('hero');
      expect(init.order).toContain('ally');
      allyBlows += r.events.filter((e) => e.type === 'attack' && e.actor === 'ally').length;
      allyHit += r.events.filter((e) => e.type === 'attack' && e.target === 'ally').length;
      expect(r.ally).not.toBeNull();
      expect(r.events.at(-1)).toEqual({ type: 'end', outcome: r.outcome });
    }
    expect(allyBlows).toBeGreaterThan(0);
    expect(allyHit).toBeGreaterThan(0);
  });

  it('keep a Duo together: Wary Heroes never run alone', () => {
    for (let i = 0; i < 60; i++) {
      const r = simulateFight(createRng(`wary-${i}`), duoFight(starter('wizard', 3), starter('wizard', 3), 4, `wary-${i}`, 'wary'));
      expect(r.events.some((e) => e.type === 'escape')).toBe(false);
      expect(r.outcome).not.toBe('escaped');
    }
  });

  it('let a Hero whose partner follows it (a solo Companion) break away, and take the partner along', () => {
    let escaped = 0;
    for (let i = 0; i < 60; i++) {
      const input = duoFight(starter('wizard', 3), starter('wizard', 3), 4, `wary-${i}`, 'wary');
      const r = simulateFight(createRng(`wary-${i}`), { ...input, ally: { ...input.ally!, follows: true } });
      const rolls = r.events.filter((e): e is Extract<FightEvent, { type: 'escape' }> => e.type === 'escape');
      // Only the Hero rolls to run; its partner gets out on that same roll, never on its own.
      expect(rolls.filter((e) => !e.actor).length).toBeGreaterThanOrEqual(rolls.filter((e) => e.actor === 'ally').length);
      if (r.ally!.outcome === 'escaped') expect(r.outcome).toBe('escaped');
      if (r.outcome === 'escaped') {
        escaped++;
        expect(r.ally!.outcome === 'escaped' || r.ally!.outcome === 'dead').toBe(true);
        if (r.ally!.outcome === 'escaped') expect(r.ally!.hp).toBeGreaterThan(0);
      }
    }
    expect(escaped).toBeGreaterThan(0);
  });

  it('let a Cleric mend its partner', () => {
    let mended = 0;
    for (let i = 0; i < 200 && mended === 0; i++) {
      const r = simulateFight(createRng(`mend-${i}`), duoFight(starter('cleric', 6), starter('wizard', 6), 5, `mend-${i}`));
      mended += r.events.filter((e) => e.type === 'heal' && e.ability === 'cure-wounds' && e.by === 'hero' && e.actor === 'ally').length;
    }
    expect(mended).toBeGreaterThan(0);
  });

  it('meet more monsters than a Hero alone would', () => {
    for (let i = 0; i < 30; i++) {
      // The same Room at a Duo's numbers (without the solo step), plus part of a second group.
      const solo = spawnEncounter(createRng(`size-${i}`), 4, 'fight', 0, null, false);
      const duo = duoEncounter(createRng(`size-${i}`), 4, 'fight');
      expect(duo.length).toBeGreaterThan(solo.length);
      expect(new Set(duo.map((m) => m.key)).size).toBe(duo.length);
    }
    const boss = duoEncounter(createRng('boss'), 3, 'miniboss');
    const alone = spawnEncounter(createRng('boss'), 3, 'miniboss', 0, null, false);
    // The Mini-boss itself is hardier and hits harder than the monsters at its side.
    expect(boss[0]!.maxHp).toBeGreaterThan(alone[0]!.maxHp * DUO.hp);
    expect(boss[0]!.damageFactor).toBeGreaterThan(alone[0]!.damageFactor * DUO.damage);
  });

  it('count each time a Hero stands its fallen partner back up', () => {
    const events: FightEvent[] = [
      { type: 'down', actor: 'ally' },
      { type: 'revive', actor: 'hero', target: 'ally', natural: 4, total: 6, dc: 10, success: false, hp: 0 },
      { type: 'revive', actor: 'hero', target: 'ally', natural: 15, total: 17, dc: 10, success: true, hp: 5 },
      { type: 'down' },
      { type: 'heal', actor: 'hero', ability: 'cure-wounds', amount: 6, hp: 6, by: 'ally' },
      { type: 'down', actor: 'ally' },
      { type: 'rise', actor: 'ally', hp: 1 },
      { type: 'heal', actor: 'ally', ability: 'potion', amount: 7, hp: 8 },
    ];
    expect(partnerRaises(events, 'hero')).toBe(1);
    expect(partnerRaises(events, 'ally')).toBe(1);
    // A partner healed while standing isn't raised.
    expect(partnerRaises([{ type: 'heal', actor: 'hero', ability: 'cure-wounds', amount: 6, hp: 9, by: 'ally' }], 'ally')).toBe(0);
  });

  it('shows the partner the same fight with the Heroes trading places', () => {
    for (let i = 0; i < 20; i++) {
      const r = simulateFight(createRng(`view-${i}`), duoFight(starter('barbarian', 5), starter('ranger', 5), 4, `view-${i}`));
      const theirs = forAlly(r.events, r.ally!.outcome);
      expect(theirs.at(-1)).toEqual({ type: 'end', outcome: r.ally!.outcome });
      expect(theirs.filter((e) => e.type === 'attack' && e.actor === 'hero').length)
        .toBe(r.events.filter((e) => e.type === 'attack' && e.actor === 'ally').length);
      // Back again is the fight as it was.
      expect(forAlly(theirs, r.outcome)).toEqual(r.events);
    }
  });
});
