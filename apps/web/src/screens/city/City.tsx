import { useEffect } from 'react';
import { api } from '../../api';
import { CityMap } from '../../components/city/CityMap';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';

/** Existing Tavern data supplies the Season; map rendering stays independently previewable. */
export function City() {
  const { t } = useI18n();
  const { data, failed, reload } = useLoad(api.tavern);
  useEffect(() => {
    const id = setInterval(() => void reload(), 25_000);
    return () => clearInterval(id);
  }, [reload]);

  return (
    <div className="city-surface grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="sub-heading m-0">{t('tab.city')}</h1>
        {data && <span className="chip">{t('tavern.season', { n: data.season.number })} · {t(`season.${data.season.status}`)}</span>}
      </div>
      {failed ? <div className="flex flex-wrap items-center gap-2 text-sm text-muted" role="status">
        <span>{t('city.statusUnavailable')}</span>
        <button type="button" className="btn btn-small" onClick={() => void reload()}>{t('retry')}</button>
      </div> : !data && <p className="m-0 text-sm text-muted" role="status">{t('city.statusLoading')}</p>}
      <CityMap season={data?.season ?? null} />
    </div>
  );
}
