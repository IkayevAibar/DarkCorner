import { afterEach, describe, expect, it, vi } from 'vitest';
import { clockNow, followGameClock, formatClock, formatDuration, gameClockMoved, onGameClockMoved, waitFor } from './time';
import { en } from './i18n/en';

/** The English lines, as the screens see them. */
const t = (key: keyof typeof en, vars?: Record<string, string | number>) =>
  en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));

const at = (iso: string) => Date.parse(iso);

afterEach(() => {
  followGameClock(null);
  vi.useRealTimers();
});

describe('the game clock', () => {
  it("is the device's clock online", () => {
    vi.useFakeTimers({ now: at('2026-10-10T12:00:00Z') });
    expect(clockNow()).toBe(at('2026-10-10T12:00:00Z'));
  });

  it("follows the World's clock in the solo build, not the device's", () => {
    vi.useFakeTimers({ now: at('2026-10-10T19:00:00Z') });
    let world = at('2026-10-10T08:00:00Z');
    followGameClock(() => world);
    expect(clockNow()).toBe(at('2026-10-10T08:00:00Z'));
    // A night's sleep moves the World's clock; the device's own clock never does.
    world = at('2026-10-11T08:00:00Z');
    expect(clockNow()).toBe(at('2026-10-11T08:00:00Z'));
  });

  it('tells its listeners when it moves, until they stop listening', () => {
    const heard = vi.fn();
    const stop = onGameClockMoved(heard);
    gameClockMoved();
    stop();
    gameClockMoved();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('waiting for a moment', () => {
  it('online, waits until it has passed, and a beat more', () => {
    vi.useFakeTimers({ now: at('2026-10-10T12:00:00Z') });
    expect(waitFor('2026-10-10T12:00:10Z')).toBe(10_750);
    expect(waitFor('2026-10-10T11:00:00Z')).toBe(750);
  });

  it('solo, looks again at once for a moment past, and never waits for one ahead', () => {
    vi.useFakeTimers({ now: at('2026-10-10T19:00:00Z') });
    followGameClock(() => at('2026-10-10T08:00:00Z'));
    expect(waitFor('2026-10-10T07:59:00Z')).toBe(750);
    // A Camp's four-hour rest: the device's clock is past it, but the game's
    // clock reaches it only when the Hero sleeps.
    expect(waitFor('2026-10-10T12:00:00Z')).toBeNull();
  });
});

describe('time in words', () => {
  const HOUR = 3_600_000;

  it('online, in hours and minutes', () => {
    expect(formatDuration(t, 16 * HOUR)).toBe('16h 0m');
    expect(formatDuration(t, 5 * 60_000)).toBe('5:00');
  });

  it('solo, in nights: the clock moves only from one morning to the next', () => {
    const morning = at('2026-10-12T08:00:00Z');
    followGameClock(() => morning, at('2026-10-10T08:00:00Z'));
    // Midnight, and the next morning, come with the first night; anything later with more.
    expect(formatDuration(t, 16 * HOUR)).toBe('tomorrow');
    expect(formatDuration(t, 24 * HOUR)).toBe('tomorrow');
    expect(formatDuration(t, 25 * HOUR)).toBe('in 2 days');
    expect(formatDuration(t, 6 * 24 * HOUR)).toBe('in 6 days');
    // A moment ahead in nights, and one past by its Day.
    expect(formatClock('en', '2026-10-12T21:00:00Z', t)).toBe('tomorrow');
    expect(formatClock('en', '2026-10-10T08:00:00Z', t)).toBe('Day 1');
    expect(formatClock('en', '2026-10-12T08:00:00Z', t)).toBe('Day 3');
  });
});
