import { useEffect, useState } from 'react';
import type { CupsView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';

type Game = NonNullable<CupsView['game']>;

/** Where each cup (by the place it started) stands after the first `step` swaps. */
function placesAfter(game: Game, step: number): number[] {
  const places = [0, 1, 2];
  for (const [a, b] of game.swaps.slice(0, step)) {
    const atA = places.indexOf(a);
    const atB = places.indexOf(b);
    places[atA] = b;
    places[atB] = a;
  }
  return places;
}

const SHOW_MS = 1200;

/**
 * The goblin's cups (docs/design.md → Event rooms), a plain stand-in for Codex's scene with
 * the same props. The stake goes down first; then he shows the gem and shuffles, once. Seen
 * again (a reload, or coming back), the cups stand where the shuffle left them. Then a cup
 * by its place, or his cheat called. The server decides; this only shows it.
 */
export function Cups({ cups, busy, onBet, onPick }: {
  cups: CupsView; busy: boolean; onBet: (amount: number) => void; onPick: (pick: number | 'cheat') => void;
}) {
  const { t } = useI18n();
  const game = cups.game;
  // The shuffle plays for a stake put down while this was on screen, and only then.
  const [fresh] = useState(() => game === null);
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick'>(fresh ? 'show' : 'pick');
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | 'cheat' | null>(null);
  const [amount, setAmount] = useState(String(Math.min(cups.maxBet, 20)));

  useEffect(() => {
    if (!game || !fresh || phase === 'pick') return;
    if (phase === 'show') {
      const timer = window.setTimeout(() => setPhase('shuffle'), SHOW_MS);
      return () => window.clearTimeout(timer);
    }
    if (step >= game.swaps.length) {
      setPhase('pick');
      return;
    }
    const timer = window.setTimeout(() => {
      play('tick');
      setStep((n) => n + 1);
    }, game.swapMs);
    return () => window.clearTimeout(timer);
  }, [game, fresh, phase, step]);

  if (!game) {
    const value = Number.parseInt(amount, 10);
    const valid = Number.isInteger(value) && value >= 1 && value <= cups.maxBet;
    return (
      <div className="grid gap-2 border-t border-line pt-3">
        <p className="m-0 text-sm">{t('event.cups.about')}</p>
        <div className="flex gap-2">
          <input className="field flex-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-label={t('event.gambler.amount')} />
          <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => onBet(value)}>{t('event.cups.play')}</button>
        </div>
        <span className="text-xs text-muted">{t('event.cups.max', { n: cups.maxBet })}</span>
      </div>
    );
  }

  const places = placesAfter(game, fresh && phase !== 'pick' ? step : game.swaps.length);
  const end = game.end;
  // Where the gem shows: at the start, and at the end where it really was.
  const gemCup = phase === 'show' ? game.start : end && end.gem !== null ? places.indexOf(end.gem) : null;
  const choose = (pick: number | 'cheat') => {
    setPicked(pick);
    play('reveal');
    onPick(pick);
  };

  return (
    <div className="grid gap-3 border-t border-line pt-3">
      <p className="m-0 text-sm text-muted">{t('event.cups.staked', { n: game.bet })}</p>
      <div className="relative h-24 w-full" aria-live="polite">
        {places.map((place, cup) => {
          const lifted = end !== null && (place === end.gem || place === picked);
          return (
            <button
              key={cup}
              type="button"
              aria-label={t('event.cups.cup', { n: place + 1 })}
              className={`absolute top-2 grid h-20 w-1/4 place-items-end justify-center rounded-t-[40%] border border-brass-dim bg-panel-2 ${
                end === null && phase === 'pick' ? 'cursor-pointer hover:border-gold' : ''}`}
              style={{
                left: `${place * 37.5}%`,
                transition: `left ${game.swapMs}ms ease-in-out, transform 300ms`,
                transform: lifted || (phase === 'show' && cup === gemCup) ? 'translateY(-14px)' : undefined,
              }}
              disabled={busy || end !== null || phase !== 'pick'}
              onClick={() => choose(place)}
            >
              {cup === gemCup && <span className="mb-1 h-3 w-3 rotate-45 bg-gold" aria-hidden />}
            </button>
          );
        })}
      </div>
      {end === null && phase !== 'pick' && <p className="m-0 text-center text-sm">{t('event.cups.watch')}</p>}
      {end === null && phase === 'pick' && (
        <>
          {game.palmed !== null && <p className="m-0 text-sm text-gold">{t(game.palmed ? 'event.cups.palmed' : 'event.cups.clean')}</p>}
          <p className="m-0 text-center text-sm">{t('event.cups.pick')}</p>
          <button type="button" className="btn" disabled={busy} onClick={() => choose('cheat')}>{t('event.cups.cheat')}</button>
        </>
      )}
      {end !== null && end.gem === null && <p className="m-0 text-sm text-muted">{t('event.cups.sleeve')}</p>}
    </div>
  );
}
