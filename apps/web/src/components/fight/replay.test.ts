import { describe, expect, it } from 'vitest';
import { fightReplaySchema, type FightEventView } from '@dark/shared';
import { FIGHTS, EXTRA_FIGHTS, REAL_FIGHTS } from '../../screens/sandbox/fightExamples';
import { advance, dieFor, framesFor, initialFrame } from './replay';

describe('recorded fight playback', () => {
  it('accepts all 38 engine replays and supplemental examples without mutating them', () => {
    expect(Object.keys(REAL_FIGHTS)).toHaveLength(38);
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
      'status', 'expire', 'tick', 'held', 'fled', 'defeated', 'down', 'death-save', 'rise', 'reroll', 'escape', 'revive', 'end',
    ]));
    expect(new Set(Object.values(REAL_FIGHTS).flatMap(f => f.events).flatMap(e => e.type === 'power' ? [e.power] : []))).toEqual(new Set([
      'thief', 'mend', 'drain', 'breath', 'undying', 'enrage', 'frighten', 'explode', 'wail', 'twin',
    ]));
  });

  it('stands a Twin Warden back up when its twin raises it', () => {
    const replay = REAL_FIGHTS['duo-twin-wardens']!;
    const frames = framesFor(replay);
    const rise = replay.events.findIndex(e => e.type === 'power' && e.power === 'twin');
    const event = replay.events[rise] as Extract<FightEventView, { type: 'power' }>;
    expect(frames[rise]!.fighters[event.target!]!.fallen).toBe(true);
    expect(frames[rise + 1]!.fighters[event.target!]).toMatchObject({ fallen: false, hp: event.hp });
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
    expect(frames[3]!.fighters.hero!.saves).toEqual({ successes: 0, failures: 2 });
    expect(frames[4]!.fighters.hero!.fallen).toBe(true);
    expect(frames[5]!.fighters.hero).toMatchObject({ hp: 1, fallen: false });
    expect(frames[5]!.fighters.hero!.saves).toBeNull();
    expect(frames.at(-1)!.fighters.hero!.fled).toBe(true);
  });

  it.each(['burning', 'poisoned', 'paralyzed', 'frightened'] as const)('waits for the authoritative %s expiry and clears it on down', status => {
    const initial = initialFrame(REAL_FIGHTS['wizard-burst']!);
    const affected = advance(initial, { type: 'status', target: 'hero', status, turns: 1 });
    const lastTurn = advance(affected, status === 'paralyzed' ? { type: 'held', target: 'hero' }
      : { type: 'tick', target: 'hero', damage: 3, hp: 39, ...(status === 'poisoned' ? { status } : {}) });
    expect(lastTurn.fighters.hero!.statuses[status]).toBe(1);
    const expired = advance(lastTurn, { type: 'expire', target: 'hero', status });
    expect(expired.fighters.hero!.statuses[status]).toBeUndefined();
    expect(expired.fighters.hero!.hp).toBe(lastTurn.fighters.hero!.hp);
    expect(advance(affected, { type: 'down' }).fighters.hero!.statuses).toEqual({});
  });

  it('removes the Mummy’s fear in the middle of its real replay', () => {
    const replay = REAL_FIGHTS['mummy-fear-fades']!;
    const index = replay.events.findIndex(e => e.type === 'expire' && e.status === 'frightened');
    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(replay.events.length - 1);
    const frames = framesFor(replay);
    expect(frames[index]!.fighters.hero!.statuses.frightened).toBeDefined();
    expect(frames[index + 1]!.fighters.hero!.statuses.frightened).toBeUndefined();
    expect(frames[index + 1]!.fighters.hero!.hp).toBe(frames[index]!.fighters.hero!.hp);
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
