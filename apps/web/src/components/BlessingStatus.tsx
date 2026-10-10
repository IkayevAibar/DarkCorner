import type { HeroView } from '@dark/shared';
import { useI18n } from '../i18n';
import { formatDuration, useNow } from '../time';
import { useText } from './items/text';
import './blessing.css';

/** A curse occupies the Blessing slot, but never borrows its benevolent treatment. */
export function BlessingStatus({ blessing }: { blessing: NonNullable<HeroView['luck']['blessing']> }) {
  const { t, locale } = useI18n(), text = useText(), now = useNow(30_000);
  return <section className="blessing-status" data-curse={blessing.curse || undefined}>
    <svg viewBox="0 0 32 40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      {blessing.curse ? <><path d="M5 34 3 10 9 3h14l6 7-2 24ZM18 3l-6 10 9 4-10 10 6 10M6 36h20" /><path d="m8 13 4 1m9 6 6-4" /></> : <><path d="M16 3 20 14 29 19 20 24 16 37 12 24 3 19 12 14Z" /><circle cx="16" cy="19" r="4" /></>}
    </svg>
    <div><small>{blessing.curse ? (locale === 'ru' ? 'Проклятие' : 'Curse') : t('temple.blessings')}</small>
      <strong>{text(blessing.name)}</strong><p>{text(blessing.description)}</p>
      {/* Solo, the description already says it lasts until the Hero sleeps. */}
      {!__SOLO__ && <span>{t('temple.left', { time: formatDuration(t, new Date(blessing.until).getTime() - now) })}</span>}
    </div>
  </section>;
}
