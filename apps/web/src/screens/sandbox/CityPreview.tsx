import { useState } from 'react';
import type { SeasonView } from '@dark/shared';
import { CityMap } from '../../components/city/CityMap';
import { useI18n } from '../../i18n';

const STATES = ['planned', 'active', 'open', 'finale', 'ended'] as const;

export function CityPreview() {
  const { t } = useI18n();
  const [state, setState] = useState<typeof STATES[number]>('active');
  const season: SeasonView = {
    number: 0, status: state === 'open' ? 'active' : state,
    startsAt: null, bossGateAt: state === 'open' || state === 'finale' || state === 'ended' ? '2020-01-01T00:00:00Z' : null,
    wipeAt: null, weakening: 0, podium: [], relicsLeft: 10,
  };
  return (
    <section className="city-surface grid gap-3">
      <h2 className="sub-heading m-0">{t('city.map')}</h2>
      <div className="flex flex-wrap gap-2">
        {STATES.map((s) => <button key={s} type="button" className="btn btn-small" aria-pressed={state === s} onClick={() => setState(s)}>
          {s === 'open' ? t('city.bossGateOpen') : t(`season.${s}`)}
        </button>)}
      </div>
      <CityMap season={season} />
    </section>
  );
}
