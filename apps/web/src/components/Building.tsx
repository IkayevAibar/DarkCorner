import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { HeroView } from '@dark/shared';
import { useI18n } from '../i18n';

/** A City building: back to the map, its name, the Hero's gold, and a note if the Hero is away. */
export function Building({ title, blurb, hero, children }: { title: string; blurb: string; hero: HeroView | null; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <NavLink to="/city" className="w-fit text-sm text-muted no-underline">← {t('tab.city')}</NavLink>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="m-0 font-head text-[26px] leading-tight font-extrabold">{title}</h1>
          {hero && <span className="chip shrink-0 text-[#f1c75b]">{t('hero.gold', { n: hero.gold.toLocaleString() })}</span>}
        </div>
        <p className="m-0 text-muted">{blurb}</p>
      </div>
      {hero && !hero.inCity && (
        <p className="panel m-0 p-3 text-sm">{t('city.away')}</p>
      )}
      {children}
    </section>
  );
}

/** The screen-level loading and failure states every building shares. */
export function Loading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  if (!failed) return <p className="text-center text-muted">{t('loading')}</p>;
  return (
    <div className="panel grid gap-3 p-4 text-center">
      <p className="m-0">{t('error')}</p>
      <button type="button" className="btn" onClick={onRetry}>{t('retry')}</button>
    </div>
  );
}
