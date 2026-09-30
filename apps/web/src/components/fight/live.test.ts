import { describe, expect, it } from 'vitest';
import { REAL_FIGHTS } from '../../screens/sandbox/fightExamples';
import { advance, framesFor, initialFrame } from './replay';
import { cueFor } from './choreography';
import { appendTimeline, boardKey, endedBoard, startTimeline } from './live';

const ids = ['duo-side-by-side', 'duo-pulled-up', 'duo-teamwork'];
describe('arriving fight events', () => {
  it('retains accepted events during duplicate/stale polls and appends final blows once', () => {
    const replay = REAL_FIGHTS['duo-pulled-up']!, board = endedBoard(replay);
    const first = startTimeline({ ...board, events: replay.events.slice(0, 4), outcome: null });
    expect(appendTimeline(first, structuredClone(first.events))).toBe(first);
    expect(appendTimeline(first, replay.events.slice(0, 2))).toBe(first);
    const second = appendTimeline(first, structuredClone(replay.events.slice(0, 12)));
    expect(second.events[0]).toBe(first.events[0]);
    expect(second.frames[4]).toBe(first.frames[4]);
    expect(second.frames).toEqual(framesFor({ ...replay, events: replay.events.slice(0, 12) }));
    const final = appendTimeline(second, replay.events);
    expect(final.frames).toEqual(framesFor(replay));
    expect(appendTimeline(final, structuredClone(replay.events))).toBe(final);
    expect(boardKey({ ...board, events: first.events, outcome: null })).toBe(boardKey(board));
  });
  it.each(ids.flatMap(id => [id, `${id}-partner`]))('follows every recorded actor and target in %s', id => {
    const replay = REAL_FIGHTS[id]!, frames = framesFor(replay);
    for (let i = 0; i < replay.events.length; i++) {
      const event = replay.events[i]!, frame = frames[i + 1]!, actor = 'actor' in event ? event.actor ?? 'hero' : 'hero';
      if (event.type === 'attack') expect(frame.fighters[event.target]!.hp).toBe(event.targetHp);
      if (event.type === 'heal') expect(frame.fighters[event.actor]!.hp).toBe(event.hp);
      if (event.type === 'down') expect(frame.fighters[actor]).toMatchObject({ fallen: true, hp: 0 });
      if (event.type === 'death-save') expect(frame.fighters[actor]!.saves).toEqual({ successes: event.successes, failures: event.failures });
      if (event.type === 'rise') expect(frame.fighters[actor]).toMatchObject({ fallen: false, hp: event.hp });
      if (event.type === 'revive' && event.success) expect(frame.fighters[event.target]).toMatchObject({ hp: event.hp, fallen: false, saves: null });
      for (const reduced of [false, true]) {
        const cue = cueFor(replay, event, reduced);
        if (['down', 'death-save', 'rise', 'reroll', 'save', 'feature', 'escape', 'revive'].includes(event.type)) expect(cue.actor).toBe(actor);
        if (event.type === 'revive' || event.type === 'feature' && ['help', 'guard', 'mark'].includes(event.feature)) expect(cue.targets).toEqual([event.target]);
        if (event.type === 'heal') expect(cue).toMatchObject({ actor: event.by ?? event.actor, targets: [event.actor] });
      }
    }
  });
  it('resolves optional actors symmetrically, including a partner pulling up or Guarding the Hero', () => {
    const replay = REAL_FIGHTS['duo-pulled-up']!;
    for (const key of ['hero', 'ally'] as const) {
      const other = key === 'hero' ? 'ally' : 'hero';
      let frame = advance(initialFrame(replay), { type: 'down', actor: other });
      const event = { type: 'revive' as const, actor: key, target: other, natural: 15, total: 15, dc: 10, success: true, hp: 6 };
      frame = advance(frame, event);
      expect(frame.fighters[other]).toMatchObject({ hp: 6, fallen: false, saves: null });
      expect(cueFor(replay, event, false)).toMatchObject({ actor: key, targets: [other] });
      expect(cueFor(replay, { type: 'feature', feature: 'guard', actor: key, target: other }, false)).toMatchObject({ actor: key, targets: [other] });
    }
  });
  it('keeps each Hero’s saves and features independent, and raises only the recorded partner', () => {
    const replay = REAL_FIGHTS['duo-pulled-up']!;
    let frame = initialFrame(replay);
    frame = advance(frame, { type: 'feature', feature: 'rage' });
    frame = advance(frame, { type: 'feature', actor: 'ally', feature: 'ward', left: 7 });
    frame = advance(frame, { type: 'feature', actor: 'ally', feature: 'mark', target: 'm0' });
    frame = advance(frame, { type: 'down', actor: 'ally' });
    expect(frame.fighters.hero).toMatchObject({ raging: true, ward: 0, marked: null, saves: null, fallen: false });
    expect(frame.fighters.ally).toMatchObject({ raging: false, ward: 7, marked: 'm0', fallen: true, hp: 0, saves: { successes: 0, failures: 0 } });
    const failed = advance(frame, { type: 'revive', target: 'ally', natural: 2, total: 2, dc: 10, success: false, hp: 0 });
    expect(failed.fighters.ally).toEqual(frame.fighters.ally);
    const raised = advance(frame, { type: 'revive', target: 'ally', natural: 15, total: 15, dc: 10, success: true, hp: 1 });
    expect(raised.fighters.ally).toMatchObject({ fallen: false, hp: 1, saves: null });
    const cured = advance(frame, { type: 'heal', actor: 'ally', by: 'hero', ability: 'cure-wounds', amount: 8, hp: 8 });
    expect(cured.fighters.ally).toMatchObject({ fallen: false, hp: 8, saves: null });
    expect(cured.fighters.hero).toEqual(frame.fighters.hero);
  });
});
