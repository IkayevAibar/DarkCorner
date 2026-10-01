import { useEffect, useRef, useState } from 'react';
import { type EventView, LOCK_TAP_MAX, lockPinAt, lockPinSets } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';

export type LockView = NonNullable<Extract<EventView, { kind: 'lockpicking' }>['lock']>;

/**
 * The Lockpicking minigame (docs/design.md → Event rooms), a plain stand-in for Codex's
 * lock scene with the same props. Each pin's marker sweeps along a bar; a tap stops it,
 * and inside the lit spot the pin sets. Every tap goes to the server (`onTap`, in ms from
 * the start of that sweep), which judges it the same way (lockPinSets) and keeps how far
 * the lock got; the next sweep starts once it has answered.
 */
export function LockPick({ lock, busy, onTap }: { lock: LockView; busy: boolean; onTap: (ms: number) => void }) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<{ at: number; hit: boolean } | null>(null);
  const start = useRef(0);
  const marker = useRef<HTMLSpanElement>(null);
  const pin = lock.pins[lock.set];
  const step = `${lock.set}:${lock.broken}`;
  // A fresh view of the same lock (a Duo looks every few seconds) keeps the sweep going.
  const pinKey = pin ? `${lock.set}:${pin.period}:${pin.phase}:${pin.center}:${pin.width}` : '';

  // The server has answered the last tap: the next attempt gets a fresh sweep.
  useEffect(() => setStopped(null), [step]);

  useEffect(() => {
    if (!running || !pin || stopped || busy) return;
    start.current = performance.now();
    let frame = 0;
    const draw = () => {
      if (marker.current) marker.current.style.left = `${lockPinAt(pin, performance.now() - start.current) * 100}%`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [running, pinKey, stopped, busy]);

  // Space or Enter taps too, for a keyboard.
  const tapRef = useRef(() => {});
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      e.preventDefault();
      tapRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);

  if (!pin) return null;
  const tap = () => {
    if (!running || stopped || busy) return;
    const ms = Math.round(performance.now() - start.current);
    // A sweep left running past what the server takes starts over.
    if (ms > LOCK_TAP_MAX) {
      start.current = performance.now();
      return;
    }
    const hit = lockPinSets(pin, ms);
    setStopped({ at: lockPinAt(pin, ms), hit });
    play(hit ? 'latch' : 'miss');
    onTap(ms);
  };
  tapRef.current = tap;
  const picks = lock.picks - lock.broken;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5" aria-label={t('event.lockpicking.pins', { n: lock.set, m: lock.pins.length })}>
          {lock.pins.map((_, i) => (
            <span key={i} className={`inline-block h-3 w-3 rotate-45 border ${i < lock.set ? 'border-gold bg-gold' : 'border-brass-dim'}`} />
          ))}
        </span>
        <span className={picks === 1 ? 'text-gold' : 'text-muted'}>{t('event.lockpicking.picks', { n: picks })}</span>
      </div>
      <button
        type="button"
        aria-label={t('event.lockpicking.set')}
        className={`relative h-14 w-full touch-manipulation overflow-hidden rounded-md border bg-panel-2 ${
          stopped ? (stopped.hit ? 'border-gold' : 'border-blood') : 'border-line'}`}
        disabled={!running || busy || stopped !== null}
        onPointerDown={tap}
      >
        <span
          className="absolute inset-y-0 bg-gold/25 border-x border-gold/60"
          style={{ left: `${(pin.center - pin.width / 2) * 100}%`, width: `${pin.width * 100}%` }}
        />
        <span
          ref={marker}
          className={`absolute inset-y-1 w-1 -translate-x-1/2 rounded-full ${stopped && !stopped.hit ? 'bg-blood' : 'bg-bone'}`}
          style={stopped ? { left: `${stopped.at * 100}%` } : { left: `${lockPinAt(pin, 0) * 100}%` }}
        />
      </button>
      {running ? (
        <button type="button" className="btn btn-primary touch-manipulation" disabled={busy || stopped !== null} onPointerDown={tap}>
          {t('event.lockpicking.set')}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setRunning(true)}>
          {lock.set > 0 || lock.broken > 0 ? t('event.lockpicking.again') : t('event.lockpicking.try')}
        </button>
      )}
      <p className="m-0 text-xs text-muted">{t('event.lockpicking.hint')}</p>
    </div>
  );
}
