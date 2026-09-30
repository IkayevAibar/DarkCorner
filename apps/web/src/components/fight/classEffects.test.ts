import { describe as suite, expect, it, vi } from 'vitest';
import { REAL_FIGHTS } from '../../screens/sandbox/fightExamples';
import { advance, framesFor, initialFrame } from './replay';
import { cueFor } from './choreography';
import { describe, displayNames } from './presentation';
import { en } from '../../i18n/en';
import { ru } from '../../i18n/ru';

vi.mock('../../sound', () => ({ play: vi.fn(), buzz: vi.fn() }));

suite('recorded Class effects', () => {
  it('keeps Rage until the recorded end, with unchanged damage and HP', () => {
    const replay = REAL_FIGHTS['barbarian-rage']!, before = JSON.stringify(replay), frames = framesFor(replay);
    const onset = replay.events.findIndex(e => e.type === 'feature' && e.feature === 'rage');
    expect(onset).toBeGreaterThanOrEqual(0);
    expect(frames[onset]!.raging).toBe(false);
    for (let i = onset; i < replay.events.length; i++) {
      const event = replay.events[i]!, frame = frames[i + 1]!;
      expect(frame.raging).toBe(event.type !== 'end');
      if (event.type === 'attack') expect(frame.fighters[event.target]!.hp).toBe(event.targetHp);
    }
    expect(JSON.stringify(replay)).toBe(before);
    expect(initialFrame(replay).raging).toBe(false);
    const enraged = advance(initialFrame(replay), { type: 'power', power: 'enrage', actor: replay.monsters[0]!.key });
    expect(enraged.raging).toBe(false);
  });
  it('retains the old quarry after its death until the explicit mark event moves it', () => {
    const replay = REAL_FIGHTS['ranger-mark-moves']!, frames = framesFor(replay);
    const marks = replay.events.flatMap((e, i) => e.type === 'feature' && e.feature === 'mark' ? [{ event: e, i }] : []);
    expect(marks.length).toBeGreaterThanOrEqual(2);
    for (const { event, i } of marks) {
      expect(frames[i + 1]!.marked).toBe(event.target);
      for (const reduced of [false, true]) expect(cueFor(replay, event, reduced).targets).toEqual([event.target]);
    }
    const moved = marks[1]!, previous = marks[0]!;
    expect(frames[moved.i]!.marked).toBe(previous.event.target);
    expect(frames[moved.i]!.fighters[previous.event.target!]!.fallen).toBe(true);
    expect(frames.at(-1)!.marked).toBeNull();
    expect(initialFrame(replay).marked).toBeNull();
  });
  it('plays all three Relentless refusals at recorded 1 HP without down or death-save state', () => {
    const replay = REAL_FIGHTS['bearheart-relentless']!, frames = framesFor(replay);
    const refusals = replay.events.flatMap((e, i) => e.type === 'feature' && e.feature === 'relentless' ? [i] : []);
    expect(refusals).toHaveLength(3);
    for (const i of refusals) {
      expect(replay.events[i - 1]).toMatchObject({ type: 'save', ability: 'con', success: true });
      expect(frames[i + 1]!.fighters.hero).toMatchObject({ hp: 1, fallen: false });
      expect(frames[i + 1]!.raging).toBe(true);
      expect(frames[i + 1]!.saves).toBeNull();
      expect(cueFor(replay, replay.events[i]!, false).contact).toBeGreaterThan(0);
      expect(cueFor(replay, replay.events[i]!, true).contact).toBe(0);
    }
  });
  it('gives both shared Fight logs localized Class lines with named mark targets', () => {
    for (const locale of ['en', 'ru'] as const) for (const id of ['barbarian-rage', 'ranger-mark-moves', 'bearheart-relentless']) {
      const replay = REAL_FIGHTS[id]!, dictionary = locale === 'en' ? en : ru;
      const names = displayNames(replay, value => value[locale]);
      for (const event of replay.events.filter(e => e.type === 'feature')) {
        const line = describe((key, vars) => dictionary[key].replace(/\{(\w+)\}/g, (_, key: string) => String(vars?.[key] ?? `{${key}}`)), event, names);
        expect(line).toBeTruthy(); expect(line).not.toMatch(/[{}]/);
        expect(line).toContain(names.hero);
        if (event.type === 'feature' && event.feature === 'mark') expect(line).toContain(names[event.target!]);
      }
    }
  });
});
