import type { FightEventView, FightReplay } from '@dark/shared';
import { describe, displayNames } from '../../components/fight/presentation';
import { useI18n } from '../../i18n';

/** How a line stands out: crits in gold, misses faint, the Hero's fall in red, healing in green. */
function tone(e: FightEventView): string {
  if (e.type === 'attack') return e.crit ? 'text-gold' : e.hit ? '' : 'text-muted';
  if (e.type === 'defeated' || e.type === 'fled') return 'font-bold';
  if (e.type === 'down' || e.type === 'death-save') return 'text-tier-mythic';
  if (e.type === 'heal' || e.type === 'rise' || (e.type === 'feature' && e.feature !== 'ward')) return 'text-tier-uncommon';
  return '';
}

/** Every line of a fight as the scene told it, to read at leisure after it's over. */
export function FightLog({ replay }: { replay: FightReplay }) {
  const { t, locale } = useI18n();
  const names = displayNames(replay, (value) => value[locale]);
  const lines = replay.events.flatMap((e) => {
    const line = describe(t, e, names);
    return line ? [{ e, line }] : [];
  });
  return (
    <ol className="m-0 grid list-none gap-1 p-0 text-[15px] leading-snug">
      {lines.map(({ e, line }, i) => (
        <li key={i} className={`grid grid-cols-[1.75rem_1fr] gap-2 ${tone(e)}`}>
          <span className="pt-px text-right text-xs text-muted tabular-nums">{i + 1}</span>
          <span>{line}</span>
        </li>
      ))}
      <li className="mt-1 border-t border-line/60 pt-2 text-center font-head text-lg font-extrabold">{t(`fight.${replay.outcome}`)}</li>
    </ol>
  );
}
