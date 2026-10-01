import { useState } from 'react';
import { type LockPin, lockPinSets } from '@dark/shared';
import { useI18n } from '../../i18n';
import { LockPick, type LockView } from '../labyrinth/LockPick';

const pins = (period: number, width: number): LockPin[] => [
  { period, phase: 0.73, center: 0.68, width },
  { period: Math.round(period * 0.92), phase: 0.2, center: 0.31, width },
  { period: Math.round(period * 0.84), phase: 0.55, center: 0.5, width },
];

/** Fake locks as the server deals them: Floor 1, Floor 10, and a Rogue's on Floor 1 with DEX +3. */
const LOCKS = {
  shallow: { pins: pins(1400, 0.11), picks: 2 },
  deep: { pins: pins(800, 0.11), picks: 2 },
  rogue: { pins: pins(1400, 0.2), picks: 3 },
};

const COPY = {
  en: { shallow: 'Floor 1', deep: 'Floor 10', rogue: 'Rogue', open: 'The lock gives.', jammed: 'The lock jams.', again: 'Again' },
  ru: { shallow: 'Этаж 1', deep: 'Этаж 10', rogue: 'Плут', open: 'Замок поддаётся.', jammed: 'Замок заклинило.', again: 'Ещё раз' },
};

/** The Lockpicking minigame against a fake lock, each tap judged a moment later as the server would (lockPinSets). */
export function LockPreview() {
  const { t, locale } = useI18n();
  const copy = COPY[locale];
  const [kind, setKind] = useState<keyof typeof LOCKS>('shallow');
  const [at, setAt] = useState({ set: 0, broken: 0 });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const lock = LOCKS[kind];
  const view: LockView = { ...lock, ...at };
  const done = at.set >= lock.pins.length ? copy.open : at.broken >= lock.picks ? copy.jammed : null;
  const reset = (next: keyof typeof LOCKS) => {
    setKind(next);
    setAt({ set: 0, broken: 0 });
    setRound((n) => n + 1);
  };
  const tap = (ms: number) => {
    setBusy(true);
    window.setTimeout(() => {
      setAt((a) => (lockPinSets(lock.pins[a.set]!, ms) ? { ...a, set: a.set + 1 } : { ...a, broken: a.broken + 1 }));
      setBusy(false);
    }, 250);
  };
  return (
    <section className="grid gap-2" data-lock-preview>
      <h2 className="sub-heading m-0">{t('event.lockpicking')}</h2>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LOCKS) as (keyof typeof LOCKS)[]).map((k) => (
          <button key={k} type="button" className="btn btn-small" aria-pressed={kind === k} onClick={() => reset(k)}>{copy[k]}</button>
        ))}
      </div>
      {done ? (
        <div className="flex items-center gap-3">
          <p className="m-0">{done}</p>
          <button type="button" className="btn btn-small" onClick={() => reset(kind)}>{copy.again}</button>
        </div>
      ) : (
        <LockPick key={round} lock={view} busy={busy} onTap={tap} />
      )}
    </section>
  );
}
