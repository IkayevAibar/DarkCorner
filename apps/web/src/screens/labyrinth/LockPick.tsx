import { useEffect, useRef, useState } from 'react';
import { type EventView, LOCK_TAP_MAX, lockPinAt, lockPinSets } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import lockStyles from './lock.css?inline';

export type LockView = NonNullable<Extract<EventView, { kind: 'lockpicking' }>['lock']>;

/** Send the tap immediately, but let the final turn finish before presenting its Chest. */
export function lockTurnDelay(lock: LockView, tap: number): number {
  return lock.set === lock.pins.length - 1 && lockPinSets(lock.pins[lock.set]!, tap)
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 650 : 0;
}

export function LockPick({ lock, busy, onTap }: { lock: LockView; busy: boolean; onTap: (ms: number) => void }) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<{ at: number; hit: boolean } | null>(null);
  const start = useRef(0), submitted = useRef(false), wasBusy = useRef(busy);
  const marker = useRef<HTMLSpanElement>(null);
  const pin = lock.pins[lock.set];
  const step = `${lock.set}:${lock.broken}`;
  // Polling the same Duo view must not restart a sweep.
  const pinKey = pin ? `${lock.set}:${pin.period}:${pin.phase}:${pin.center}:${pin.width}` : '';

  useEffect(() => { setStopped(null); submitted.current = false; }, [step]);
  useEffect(() => {
    // A rejected request leaves the pin unchanged; allow another attempt after the error.
    if (wasBusy.current && !busy) { setStopped(null); submitted.current = false; }
    wasBusy.current = busy;
  }, [busy]);
  useEffect(() => {
    if (!running || !pin || stopped || busy) return;
    start.current = performance.now();
    let frame = 0;
    const draw = () => {
      if (marker.current) marker.current.style.left = `${lockPinAt(pin, performance.now() - start.current) * 100}%`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [running, pinKey, stopped, busy]);

  if (!pin) return null;
  const tap = () => {
    if (!running || submitted.current || stopped || busy) return;
    const ms = Math.round(performance.now() - start.current);
    if (ms > LOCK_TAP_MAX) { start.current = performance.now(); return; }
    submitted.current = true;
    const hit = lockPinSets(pin, ms);
    setStopped({ at: lockPinAt(pin, ms), hit });
    play(hit ? 'latch' : 'miss');
    onTap(ms);
  };
  const setCount = lock.set + (stopped?.hit ? 1 : 0);
  const broken = lock.broken + (stopped && !stopped.hit ? 1 : 0);
  const opening = setCount === lock.pins.length;
  const disabled = !running || busy || stopped !== null;

  return <div className="lock-picking" data-lock-scene data-step={step} data-feedback={stopped ? stopped.hit ? 'set' : 'miss' : 'idle'} data-opening={opening}>
    <style>{lockStyles}</style>
    <div className="lock-face" aria-hidden="true">
      <i className="lock-rivet one" /><i className="lock-rivet two" /><i className="lock-rivet three" /><i className="lock-rivet four" />
      <div className="lock-core">
        <div className="lock-pins">
          {lock.pins.map((_, i) => <div key={i} className="lock-pin-slot" data-set={i < setCount} data-active={i === lock.set && !opening}>
            <i className="lock-spring" /><span className="lock-pin"><i /><b>{['I', 'II', 'III'][i]}</b></span>
          </div>)}
        </div>
        <div className="lock-shear" /><div className="lock-keyway"><i /></div>
      </div>
      <svg className="lock-tension" viewBox="0 0 320 80"><path d="M12 61h132l16-22h47" fill="none" stroke="#080706" strokeWidth="11"/><path d="M12 58h132l16-22h47" fill="none" stroke="#b6a17a" strokeWidth="5"/></svg>
    </div>
    <div className="lock-status">
      <span>{t('event.lockpicking.pins', { n: setCount, m: lock.pins.length })}</span>
      <span className="lock-picks" aria-label={t('event.lockpicking.picks', { n: Math.max(0, lock.picks - broken) })}>
        {Array.from({ length: lock.picks }, (_, i) => <svg key={i} viewBox="0 0 48 28" aria-hidden="true" data-broken={i < broken} data-snap={i === lock.broken && stopped?.hit === false}>
          <path className="lock-pick-handle" d="M2 20h19l5-6"/><path className="lock-pick-tip" d="m26 14 7-7h12"/>
        </svg>)}
      </span>
    </div>
    <button type="button" className="lock-feeler" aria-label={t('event.lockpicking.set')} disabled={disabled} onPointerDown={tap} onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); tap(); } }}>
      <span className="lock-track">
        <span className="lock-sweet" style={{ left: `${(pin.center - pin.width / 2) * 100}%`, width: `${pin.width * 100}%` }}><i /></span>
        <span className="lock-marker" ref={marker} style={{ left: `${(stopped ? stopped.at : lockPinAt(pin, 0)) * 100}%` }}><i /></span>
      </span>
    </button>
    <button type="button" className="btn btn-primary lock-tap" disabled={busy || stopped !== null}
      onPointerDown={running ? tap : undefined}
      onClick={() => { if (!running) setRunning(true); }}
      onKeyDown={e => { if (running && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); tap(); } }}>
      {running ? t('event.lockpicking.set') : lock.set > 0 || lock.broken > 0 ? t('event.lockpicking.again') : t('event.lockpicking.try')}
    </button>
    <p className="m-0 text-xs text-muted">{t('event.lockpicking.hint')}</p>
  </div>;
}
