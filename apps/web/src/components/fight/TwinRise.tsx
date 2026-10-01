import type { FightEventView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { TwinMark } from '../TwinMark';

const COPY = {
  en: { end: 'Round’s end', rise: ' rises again', rule: 'Fell both in the same round.' },
  ru: { end: 'Конец раунда', rise: ' встаёт вновь', rule: 'Повергните обоих за один раунд.' },
};

/** Stays readable in calm playback and when WebGL is unavailable, too. */
export function TwinRise({ event, names }: { event: FightEventView | null; names: Record<string, string> }) {
  const { locale } = useI18n(), text = COPY[locale];
  if (event?.type !== 'power' || event.power !== 'twin' || !event.target) return null;
  return <div className="fight-twin-rise" role="status" data-twin-rise={event.target}>
    <small><svg viewBox="0 0 24 24" aria-hidden="true"><TwinMark /></svg>{text.end}</small>
    <strong>{names[event.target]}{text.rise}</strong>
    <span>{text.rule}</span>
  </div>;
}
