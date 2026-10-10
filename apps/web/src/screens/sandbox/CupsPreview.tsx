import { useRef, useState } from 'react';
import type { CupsView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { Cups } from '../labyrinth/Cups';

type Game = NonNullable<CupsView['game']>;

/** A fake game as the server deals it on Floor 1 or 10, palmed or not, seen by a Rogue or not. */
export function deal(floor: 1 | 10, palmed: boolean, rogue: boolean, bet: number): Game {
  const sequence: [number, number][] = [[0, 2], [1, 2], [0, 1], [2, 0], [1, 2], [0, 1], [2, 1], [0, 2], [1, 0]];
  return { bet, start: floor === 1 ? 1 : 2, swaps: sequence.slice(0, 4 + Math.ceil(floor / 2)), swapMs: floor === 1 ? 650 : 330, palmed: rogue ? palmed : null, end: null };
}

const COPY = {
  en: { title: 'The goblin’s cups', shallow: 'Floor 1', deep: 'Floor 10', palmed: 'He palms it', rogue: 'Rogue', again: 'Again', resume: 'Return to a paid game' },
  ru: { title: 'Напёрстки гоблина', shallow: 'Этаж 1', deep: 'Этаж 10', palmed: 'Прячет в рукав', rogue: 'Плут', again: 'Ещё раз', resume: 'Вернуться к оплаченной игре' },
};

/** The cups against fake games, each pick judged a moment later as the server would. */
export function CupsPreview() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [floor, setFloor] = useState<1 | 10>(1);
  const [palmed, setPalmed] = useState(false);
  const [rogue, setRogue] = useState(false);
  const [cups, setCups] = useState<CupsView>({ maxBet: 60, game: null });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  // Whether the game on the table is palmed, as dealt (a non-Rogue's view doesn't say).
  const dealtPalmed = useRef(false);
  const reset = () => {
    setCups({ maxBet: 30 * (floor + 1), game: null });
    setRound((n) => n + 1);
  };
  const bet = (amount: number) => {
    setBusy(true);
    window.setTimeout(() => {
      dealtPalmed.current = palmed;
      setCups((c) => ({ ...c, game: deal(floor, palmed, rogue, amount) }));
      setBusy(false);
    }, 250);
  };
  const pick = (choice: number | 'cheat') => {
    setBusy(true);
    window.setTimeout(() => {
      setCups((c) => {
        const game = c.game!;
        let at = game.start;
        for (const [a, b] of game.swaps) at = at === a ? b : at === b ? a : at;
        const sleeve = dealtPalmed.current;
        const won = choice === 'cheat' ? sleeve : !sleeve && choice === at;
        return { ...c, game: { ...game, end: { gem: sleeve ? null : at, won } } };
      });
      setBusy(false);
    }, 250);
  };
  return (
    <section className="grid gap-2" data-cups-preview>
      <h2 className="sub-heading m-0">{copy.title}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-small" disabled={busy} aria-pressed={floor === 1} onClick={() => { setFloor(1); reset(); }}>{copy.shallow}</button>
        <button type="button" className="btn btn-small" disabled={busy} aria-pressed={floor === 10} onClick={() => { setFloor(10); reset(); }}>{copy.deep}</button>
        <button type="button" className="btn btn-small" disabled={busy} aria-pressed={palmed} onClick={() => { setPalmed((v) => !v); reset(); }}>{copy.palmed}</button>
        <button type="button" className="btn btn-small" disabled={busy} aria-pressed={rogue} onClick={() => { setRogue((v) => !v); reset(); }}>{copy.rogue}</button>
        <button type="button" className="btn btn-small" disabled={busy} onClick={reset}>{copy.again}</button>
        <button type="button" className="btn btn-small" disabled={busy} onClick={() => { dealtPalmed.current = palmed; setCups({ maxBet: 30 * (floor + 1), game: deal(floor, palmed, rogue, 20) }); setRound(n => n + 1); }}>{copy.resume}</button>
      </div>
      <Cups key={round} cups={{ ...cups, maxBet: 30 * (floor + 1) }} busy={busy} onBet={bet} onPick={pick} />
    </section>
  );
}
