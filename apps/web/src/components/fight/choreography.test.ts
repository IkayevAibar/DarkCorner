import { describe, expect, it } from 'vitest';
import { STRIKE_IDS, MONSTER_KINS, type FightEventView } from '@dark/shared';
import { FIGHTS, REAL_FIGHTS, EXTRA_FIGHTS } from '../../screens/sandbox/fightExamples';
import { cueDuration, cueFor, Playhead, sceneTime } from './choreography';

describe('fight choreography', () => {
  it('has real coverage of all strikes and kin, plus a Hero bow example', () => {
    const fighters = Object.values(REAL_FIGHTS).flatMap(f => [f.hero, ...f.monsters]);
    expect(new Set(fighters.map(f => f.strike))).toEqual(new Set(STRIKE_IDS));
    expect(new Set(fighters.flatMap(f => f.kin ? [f.kin] : []))).toEqual(new Set(MONSTER_KINS));
    expect(EXTRA_FIGHTS['visual-hero-bow']!.hero.strike).toBe('shoot');
  });
  it('preserves partial progress through pause, resume and speed changes', () => {
    const head = new Playhead();
    head.setRate(100, 1); expect(head.update(360)).toBe(260);
    head.setRate(360, 0); expect(head.update(9000)).toBe(260);
    head.setRate(9000, 2); expect(head.update(9100)).toBe(460);
    head.setRate(9200, 1); expect(head.update(9300)).toBe(760);
  });
  it('freezes exactly at contact, then slows a crit without changing the total event endpoint', () => {
    const replay = REAL_FIGHTS['goblins-victory-crit']!;
    const attack = replay.events.find(e => e.type === 'attack' && e.crit)!;
    const cue = cueFor(replay, attack, false);
    expect(cue.hold).toBeGreaterThanOrEqual(50); expect(cue.hold).toBeLessThanOrEqual(80);
    expect(sceneTime(cue.contact + 32, cue)).toBe(cue.contact);
    expect(sceneTime(cue.contact + cue.hold + 100, cue)).toBe(cue.contact + 40);
    expect(sceneTime(cueDuration(cue), cue)).toBeCloseTo(cue.length);
  });
  it('keeps every cue finite and removes hit-stop and slow motion for calm playback', () => {
    for (const replay of Object.values(FIGHTS)) for (const event of replay.events) {
      const before = JSON.stringify(replay);
      for (const reduced of [true, false]) {
        const cue = cueFor(replay, event, reduced);
        expect(cueDuration(cue)).toBeGreaterThan(cue.contact);
        expect(sceneTime(cueDuration(cue), cue)).toBeCloseTo(cue.length);
        if (reduced) expect([cue.hold, cue.slow, cue.contact]).toEqual([0, 0, 0]);
      }
      expect(JSON.stringify(replay)).toBe(before);
    }
  });
  it('does not turn a miss into contact weight', () => {
    const replay = REAL_FIGHTS['wizard-burst']!;
    const miss = replay.events.find(e => e.type === 'attack' && !e.hit) as Extract<FightEventView, { type: 'attack' }>;
    expect(miss).toBeDefined();
    expect(cueFor(replay, miss, false).hold).toBe(0);
  });
});
