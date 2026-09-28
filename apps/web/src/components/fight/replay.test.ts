import { describe, expect, it } from 'vitest';
import { fightReplaySchema, type FightEventView } from '@dark/shared';
import { FIGHTS, EXTRA_FIGHTS, REAL_FIGHTS } from '../../screens/sandbox/fightExamples';
import { advance, dieFor, framesFor, initialFrame } from './replay';

describe('recorded fight playback', () => {
  it('accepts all 23 engine replays and both supplemental examples without mutating them', () => {
    expect(Object.keys(REAL_FIGHTS)).toHaveLength(23);
    for (const replay of Object.values(FIGHTS)) {
      fightReplaySchema.parse(replay);
      const before = JSON.stringify(replay);
      const frames = framesFor(replay);
      expect(frames).toHaveLength(replay.events.length + 1);
      expect(frames[0]!.fighters.hero!.hp).toBe(replay.hero.hp);
      expect(JSON.stringify(replay)).toBe(before);
    }
  });

  it('covers every event variant and every power with a standalone visual', () => {
    const events = Object.values(FIGHTS).flatMap(f => f.events);
    expect(new Set(events.map(e => e.type))).toEqual(new Set([
      'initiative', 'surprise', 'attack', 'blocked', 'burst', 'heal', 'feature', 'power', 'save',
      'status', 'tick', 'held', 'fled', 'defeated', 'down', 'death-save', 'rise', 'reroll', 'escape', 'end',
    ]));
    expect(new Set(events.flatMap(e => e.type === 'power' ? [e.power] : []))).toEqual(new Set([
      'thief', 'mend', 'drain', 'breath', 'undying', 'enrage', 'frighten', 'explode', 'wail',
    ]));
  });

  it('trusts recorded HP even when damage arithmetic disagrees', () => {
    const initial = initialFrame(REAL_FIGHTS['wizard-burst']!);
    const hit = advance(initial, { type: 'attack', actor: 'm0', target: 'hero', natural: 20, total: 25,
      hit: true, crit: true, damage: 999, targetHp: 17, kind: 'weapon' });
    const healed = advance(hit, { type: 'heal', actor: 'hero', ability: 'potion', amount: 999, hp: 21 });
    expect(hit.fighters.hero!.hp).toBe(17);
    expect(healed.fighters.hero!.hp).toBe(21);
    expect(initial.fighters.hero!.hp).toBe(REAL_FIGHTS['wizard-burst']!.hero.hp);
  });

  it('heals mend’s target and drain’s actor without touching the Hero', () => {
    const replay = EXTRA_FIGHTS['visual-elite-powers-fallback']!;
    const frames = framesFor(replay);
    expect(frames[2]!.fighters.m0!.hp).toBe(20);
    expect(frames[2]!.fighters.m1!.hp).toBe(12);
    expect(frames[3]!.fighters.m2!.hp).toBe(16);
    expect(frames[3]!.fighters.hero!.hp).toBe(replay.hero.hp);
    expect(frames[4]!.fighters.m0!.enraged).toBe(true);
  });

  it('retains counters during a reroll and restores a fallen Hero only on rise', () => {
    const frames = framesFor(EXTRA_FIGHTS['visual-lucky-reroll']!);
    expect(frames[1]!.fighters.hero).toMatchObject({ hp: 0, fallen: true });
    expect(frames[3]!.saves).toEqual({ successes: 0, failures: 2 });
    expect(frames[4]!.fighters.hero!.fallen).toBe(true);
    expect(frames[5]!.fighters.hero).toMatchObject({ hp: 1, fallen: false });
    expect(frames[5]!.saves).toBeNull();
    expect(frames.at(-1)!.fighters.hero!.fled).toBe(true);
  });

  it('removes poison and paralysis after their recorded turns, and clears them on down', () => {
    const initial = initialFrame(REAL_FIGHTS['wizard-burst']!);
    const poison = advance(initial, { type: 'status', target: 'hero', status: 'poisoned', turns: 2 });
    const tick = advance(poison, { type: 'tick', target: 'hero', damage: 3, hp: 39, status: 'poisoned' });
    const clear = advance(tick, { type: 'tick', target: 'hero', damage: 3, hp: 36, status: 'poisoned' });
    expect(poison.fighters.hero!.statuses.poisoned).toBe(2);
    expect(tick.fighters.hero!.statuses.poisoned).toBe(1);
    expect(clear.fighters.hero!.statuses.poisoned).toBeUndefined();
    const held = advance(initial, { type: 'status', target: 'hero', status: 'paralyzed', turns: 1 });
    expect(advance(held, { type: 'held', target: 'hero' }).fighters.hero!.statuses).toEqual({});
    expect(advance(poison, { type: 'down' }).fighters.hero!.statuses).toEqual({});
  });

  it('keeps a fleeing thief distinct from a defeated monster', () => {
    const replay = REAL_FIGHTS['cutpurse-runs']!;
    const fled = replay.events.find((e): e is Extract<FightEventView, { type: 'fled' }> => e.type === 'fled')!;
    expect(framesFor(replay).at(-1)!.fighters[fled.key]).toMatchObject({ fled: true, fallen: false });
  });

  it('shows only recorded dice and keeps ordinary attacks off the die overlay', () => {
    for (const event of Object.values(FIGHTS).flatMap(f => f.events)) {
      const die = dieFor(event);
      if (die !== null) expect('natural' in event && event.natural).toBe(die);
      if (event.type === 'attack' && !event.crit && ![1, 20].includes(event.natural)) expect(die).toBeNull();
    }
  });
});
