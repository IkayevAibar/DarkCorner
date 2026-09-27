import { useEffect, useRef, useState } from 'react';
import type { I18n } from './i18n';

/** The current time, re-rendering every `intervalMs`: for countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Calls `callback` once the given moment has passed (for refetching when a timer runs out). */
export function useAt(iso: string | null | undefined, callback: () => void): void {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    if (!iso) return;
    const wait = Math.max(0, new Date(iso).getTime() - Date.now()) + 750;
    // setTimeout overflows past ~24.8 days; nothing here waits that long.
    const id = setTimeout(() => latest.current(), Math.min(wait, 2 ** 31 - 1));
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
