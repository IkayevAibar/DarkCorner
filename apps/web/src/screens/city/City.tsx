import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api';
import { CityMap } from '../../components/city/CityMap';
import { FirstSteps } from '../../components/FirstSteps';
import { InstallCard } from '../../components/InstallCard';
import { useLoad, useRefresh } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { isPhone } from '../../install';
import { QuickStart } from '../heroes/QuickStart';

const INSTALL_DISMISSED = 'dc.install.dismissed';
const seen = (key: string) => {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};
const remember = (key: string) => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Private windows can refuse storage; the card just comes back next time.
  }
};

/** Existing Tavern data supplies the Season; map rendering stays independently previewable. */
export function City() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, failed, reload } = useLoad(api.tavern);
  useRefresh(reload, 25_000);
  // A new Player lands here first: point them at the one thing to do before anything else.
  const mine = useLoad(api.myHero);
  const needsHero = mine.data !== null && mine.data.hero === null && mine.data.canCreate;
  // Phones get the home-screen offer until it's taken or waved away (the account sheet keeps it).
  const [offerInstall, setOfferInstall] = useState(() => isPhone && !seen(INSTALL_DISMISSED));

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
      {needsHero && <QuickStart onCreated={() => navigate('/labyrinth')} onCustom={() => navigate('/heroes?custom=1')} />}
      {mine.data?.hero && <FirstSteps />}
      {offerInstall && (
        <InstallCard
          onDismiss={() => {
            remember(INSTALL_DISMISSED);
            setOfferInstall(false);
          }}
        />
      )}
      <CityMap season={data?.season ?? null} />
    </div>
  );
}
