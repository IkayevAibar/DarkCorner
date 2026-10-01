import { ABILITY_IDS, type AbilityId } from '@dark/shared';
import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { play } from '../../sound';
import { formatClock, formatDuration, useAt, useNow } from '../../time';
import { NeedHero } from './NeedHero';

const CAP = 20;

/** The Training grounds (docs/design.md → The City): +1 to an ability after 8 hours away, for City gold. */
export function TrainingGrounds() {
  const { t, locale } = useI18n();
  const { data, setData, failed, reload } = useLoad(api.training);
  const { busy, error, run } = useAction();
  const now = useNow(30_000);
  // When the training ends, look again: the +1 has landed.
  useAt(data?.current?.until ?? null, () => void reload());
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero, price, current } = data;
  const status = current
    ? t('training.under', { ability: t(`ability.${current.ability}` as MessageKey), time: formatClock(locale, current.until), left: formatDuration(t, Date.parse(current.until) - now) })
    : price === null ? t('training.done') : t('training.count', { n: data.trained.length, m: data.max });

  return (
    <Building title={t('city.training')} blurb={t('training.blurb', { hours: data.hours })} hero={hero}>
      <p className={`m-0 text-sm ${current ? 'text-gold' : ''}`}>{status}</p>
      <section className="grid gap-2">
        <span className="sub-heading">{t('training.abilities')}</span>
        {ABILITY_IDS.map((ability: AbilityId) => {
          const score = hero.abilities[ability];
          return (
            <div key={ability} className="panel flex items-center justify-between gap-3 p-3">
              <span className="grid gap-0.5">
                <span className="font-head text-lg font-extrabold">{t(`ability.${ability}` as MessageKey)} {score}{current?.ability === ability ? ` → ${score + 1}` : ''}</span>
                {score >= CAP && <span className="text-xs text-muted">{t('training.capped', { n: CAP })}</span>}
              </span>
              {price !== null && !current && score < CAP && (
                <button
                  type="button"
                  className="btn btn-primary shrink-0"
                  disabled={busy || hero.gold < price || !hero.inCity}
                  onClick={() => void run(async () => {
                    setData(await api.startTraining(ability));
                    play('equip');
                  })}
                >
                  {t('training.train', { n: price.toLocaleString() })}
                </button>
              )}
            </div>
          );
        })}
      </section>
      <p className="m-0 text-sm text-muted">{t('training.note', { hours: data.hours })}</p>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </Building>
  );
}
