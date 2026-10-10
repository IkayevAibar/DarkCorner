import { afterEach, describe, expect, it, vi } from 'vitest';
import { clockNow, followGameClock, gameClockMoved, onGameClockMoved, waitFor } from './time';

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
