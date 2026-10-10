import { useEffect, useRef, useState } from 'react';
import type { CupsView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import cupsStyles from './cups.css?inline';

type Game = NonNullable<CupsView['game']>;
const VERDICT = {
  en: { won: 'Double the stake.', lost: 'The goblin keeps the stake.' },
  ru: { won: 'Ставка возвращается вдвойне.', lost: 'Ставка остаётся у гоблина.' },
};

/** Cup identity follows the server's swaps of positions, never a locally shuffled outcome. */
export function placesAfter(game: Game, step: number): number[] {
  const places = [0, 1, 2];
  for (const [a, b] of game.swaps.slice(0, step)) {
    const atA = places.indexOf(a), atB = places.indexOf(b);
    places[atA] = b; places[atB] = a;
  }
  return places;
}
const left = (place: number) => `${(place + .5) * 100 / 3}%`;

function Hand({ side }: { side: number }) {
  return <svg viewBox="0 0 100 110" aria-hidden="true"><g transform={side ? 'translate(100 0) scale(-1 1)' : undefined}>
    <path d="M13 0h64l-7 36-50 5Z" fill="#413024" stroke="#17130d" strokeWidth="4"/><path d="m22 30-6 27 8 24 9-1-4-23 8-3 5 33 9 1 1-36 7 1 3 29 9-1 3-34 7 4 7 18 8-4-9-30-20-16Z" fill="#7e8050" stroke="#262615" strokeWidth="3" strokeLinejoin="round"/><path d="m33 46 18-7 20 7M28 35l10-9M46 48l2 23M63 46v24" fill="none" stroke="#b3ac75" strokeWidth="2"/><path d="M14 14h61" stroke="#8f6741" strokeWidth="3"/>
  </g></svg>;
}

export function Cups({ cups, busy, onBet, onPick }: {
  cups: CupsView; busy: boolean; onBet: (amount: number) => void; onPick: (pick: number | 'cheat') => void;
}) {
  const { t, locale } = useI18n(), game = cups.game;
  // A mounted game is a return visit: only a stake placed with this table open earns a shuffle.
  const [fresh, setFresh] = useState(() => game === null);
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick'>(game ? 'pick' : 'show');
  const [step, setStep] = useState(0), [picked, setPicked] = useState<number | 'cheat' | null>(null);
  const [amount, setAmount] = useState(String(Math.min(cups.maxBet, 20)));
  const cupNodes = useRef<(HTMLButtonElement | null)[]>([]), handNodes = useRef<(HTMLDivElement | null)[]>([]);
  const submitted = useRef(false), wasBusy = useRef(busy), hadGame = useRef(game !== null);
  const sequence = game ? JSON.stringify([game.bet, game.start, game.swaps, game.swapMs]) : '';
  const ended = game?.end != null;

  useEffect(() => {
    if (!game && hadGame.current) { setFresh(true); setPhase('show'); setStep(0); setPicked(null); submitted.current = false; }
    hadGame.current = game !== null;
  }, [game !== null]);
  useEffect(() => {
    if (wasBusy.current && !busy && !ended) { submitted.current = false; setPicked(null); }
    wasBusy.current = busy;
  }, [busy, ended]);
  useEffect(() => {
    if (!game || !fresh || phase === 'pick' || ended) return;
    if (phase === 'show') {
      const timer = window.setTimeout(() => setPhase('shuffle'), 1200);
      return () => clearTimeout(timer);
    }
    if (step >= game.swaps.length) { setPhase('pick'); return; }
    const before = placesAfter(game, step), after = placesAfter(game, step + 1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const moving = before.map((p, i) => p !== after[i] ? i : -1).filter(i => i >= 0);
    const animations: Animation[] = [];
    moving.forEach((cup, hand) => {
      for (const node of [cupNodes.current[cup], handNodes.current[hand]]) {
        if (!node) continue;
        animations.push(node.animate([
          { left: left(before[cup]!), transform: 'translate(-50%, 0)' },
          { left: left((before[cup]! + after[cup]!) / 2), transform: `translate(-50%, ${reduced ? 0 : hand ? 18 : -24}px)` },
          { left: left(after[cup]!), transform: 'translate(-50%, 0)' },
        ], { duration: game.swapMs, easing: 'linear', fill: 'forwards' }));
      }
    });
    const timer = window.setTimeout(() => { play('tick'); setStep(n => n + 1); }, game.swapMs);
    return () => { clearTimeout(timer); animations.forEach(a => a.cancel()); };
  }, [sequence, fresh, phase, step, ended]);
  useEffect(() => { if (ended) play('reveal'); }, [ended]);

  const places = game ? placesAfter(game, fresh && phase !== 'pick' && !ended ? step : game.swaps.length) : [0, 1, 2];
  const end = game?.end ?? null;
  const showing = game && fresh && phase === 'show' && !end;
  const sleeve = end?.gem === null;
  const glimpse = game && phase === 'pick' && game.palmed !== null && !end;
  const gemPlace = showing ? game.start : end?.gem;
  const choose = (pick: number | 'cheat') => {
    if (submitted.current || busy || end || phase !== 'pick') return;
    submitted.current = true; setPicked(pick); play('tick'); onPick(pick);
  };
  const value = Number.parseInt(amount, 10), valid = Number.isInteger(value) && value >= 1 && value <= cups.maxBet;

  return <div className="cups-scene" data-cups-scene data-phase={game ? end ? 'end' : phase : 'bet'} data-sleeve={sleeve} data-caught={sleeve && picked === 'cheat'} data-glimpse={Boolean(glimpse)} data-won={end?.won}>
    <style>{cupsStyles}</style>
    <div className="cups-stage">
      <div className="cups-body" aria-hidden="true"/>
      <div className="cups-goblin" aria-hidden="true"><img src="/art/tokens/goblin-cutpurse.webp" alt="" draggable={false}/><i className="cups-eye"/></div>
      <div className="cups-table" aria-hidden="true"><i/><i/><i/></div>
      {[0, 1].map(side => <div key={side} ref={node => { handNodes.current[side] = node; }} className={`cups-hand hand-${side}`} aria-hidden="true"><Hand side={side}/>{side === 1 && <i className="cups-sleeve-gem"/>}</div>)}
      <div className="cups-row">
        {typeof gemPlace === 'number' && <i className="cups-gem" style={{ left: left(gemPlace) }} aria-hidden="true"/>}
        {places.map((place, cup) => <button key={cup} ref={node => { cupNodes.current[cup] = node; }} type="button" className="cups-cup" data-cup={cup} data-place={place}
          data-lifted={Boolean(showing && cup === game.start || end && (sleeve || place === end.gem || place === picked) || !end && place === picked)}
          data-selected={place === picked} style={{ left: left(place) }} aria-label={t('event.cups.cup', { n: place + 1 })}
          disabled={!game || busy || end !== null || phase !== 'pick' || picked !== null} onClick={() => choose(place)}>
          <span className="cups-shell"><i/><b/><em/></span><span className="cups-place" aria-hidden="true">{['I','II','III'][place]}</span>
        </button>)}
      </div>
      {game && <span className="cups-stake">{t('event.cups.staked', { n: game.bet })}</span>}
    </div>
    {!game ? <>
      <p className="m-0 text-sm">{t('event.cups.about')}</p>
      <div className="flex gap-2"><input className="field min-w-0 flex-1" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} aria-label={t('event.gambler.amount')}/>
        <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => { if (!submitted.current) { submitted.current = true; onBet(value); } }}>{t('event.cups.play')}</button></div>
      <span className="text-xs text-muted">{t('event.cups.max', { n: cups.maxBet })}</span>
    </> : <div className="cups-caption" aria-live="polite">
      {!end && phase !== 'pick' && <p>{t('event.cups.watch')}</p>}
      {!end && phase === 'pick' && <>
        {game.palmed !== null && <p className="cups-clue">{t(game.palmed ? 'event.cups.palmed' : 'event.cups.clean')}</p>}
        <p>{t('event.cups.pick')}</p><button type="button" className="btn" disabled={busy || picked !== null} onClick={() => choose('cheat')}>{t('event.cups.cheat')}</button>
      </>}
      {end && <><p className="cups-verdict">{VERDICT[locale][end.won ? 'won' : 'lost']}</p>{sleeve && <p>{t('event.cups.sleeve')}</p>}</>}
    </div>}
  </div>;
}
