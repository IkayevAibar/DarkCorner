import { useEffect, useRef, useState } from 'react';
import type { I18n } from './i18n';

/**
 * The game's time. Online it is the device's clock, as on the server. The solo
 * build follows the World's clock instead (src/solo.ts), which stands still
 * while the Hero plays and moves on only when the Hero sleeps.
 */
let gameClock: (() => number) | null = null;

/** The solo build: read the time from the World from now on (null goes back to the device's clock). */
export function followGameClock(read: (() => number) | null): void {
  gameClock = read;
}

/** Now, in the game's time. */
export const clockNow = (): number => (gameClock ? gameClock() : Date.now());

const clockListeners = new Set<() => void>();

/** The solo build: the World's clock has moved (the Hero slept), so countdowns redraw. */
export function gameClockMoved(): void {
  for (const listener of clockListeners) listener();
}

/** Calls `listener` each time the solo game's clock moves on; returns the way to stop. */
export function onGameClockMoved(listener: () => void): () => void {
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
  };
}

/**
 * The current time, re-rendering every `intervalMs`: for countdowns. The solo
 * game's clock moves only when the Hero sleeps, so there it redraws then instead.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    const tick = () => setNow(clockNow());
    const stop = onGameClockMoved(tick);
    const id = gameClock ? null : setInterval(tick, intervalMs);
    return () => {
      stop();
      if (id !== null) clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

/**
 * How long to wait, in ms, before looking again for the moment `iso`: until it
 * has passed, and a beat more. Null when waiting can't bring it: the solo game's
 * clock stands still while the Hero plays, so a moment still ahead comes only
 * with a night's sleep, and sleeping reloads the screens anyway.
 */
export function waitFor(iso: string): number | null {
  const left = new Date(iso).getTime() - clockNow();
  if (left > 0 && gameClock) return null;
  // setTimeout overflows past ~24.8 days; nothing here waits that long.
  return Math.min(Math.max(0, left) + 750, 2 ** 31 - 1);
}

/** Calls `callback` once the given moment has passed (for refetching when a timer runs out). */
export function useAt(iso: string | null | undefined, callback: () => void): void {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    const wait = iso ? waitFor(iso) : null;
    if (wait === null) return;
    const id = setTimeout(() => latest.current(), wait);
    return () => clearTimeout(id);
  }, [iso]);
}

/** "12:05" under an hour, "3h 20m" under two days, "6d 23h" above (localized). */
export function formatDuration(t: I18n['t'], ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 48) return t('time.dh', { d: Math.floor(h / 24), h: h % 24 });
  if (h > 0) return t('time.hm', { h, m });
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(locale: string, iso: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
