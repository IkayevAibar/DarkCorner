import { useEffect } from 'react';
import { useText } from '../components/items/ItemChip';
import { useI18n } from '../i18n';
import { NEWS } from '../news';
import { markNewsRead } from '../newsState';

/** What's new: the game's patch notes, newest first. */
export function News() {
  const { t, locale } = useI18n();
  const text = useText();
  useEffect(() => markNewsRead(), []);
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h1 className="m-0 font-head text-2xl font-extrabold">{t('news.title')}</h1>
        <p className="m-0 text-muted">{t('news.blurb')}</p>
      </div>
      {NEWS.map((entry, i) => (
        <section key={entry.id} className="panel grid gap-2.5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className={`m-0 font-head text-lg leading-tight font-extrabold ${i === 0 ? 'text-gold' : ''}`}>{text(entry.title)}</h2>
            <time className="text-xs text-muted" dateTime={entry.date}>{day(entry.date)}</time>
          </div>
          <ul className="m-0 grid list-disc gap-1.5 pl-5 text-[15px] leading-snug marker:text-brass">
            {entry.items.map((item, j) => (
              <li key={j}>{text(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
