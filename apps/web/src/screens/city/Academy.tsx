import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { useText } from '../../components/items/text';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { NeedHero } from './NeedHero';

/** The Academy (docs/design.md → The City): from level 12, more Talents for City gold. */
export function Academy() {
  const { t } = useI18n();
  const text = useText();
  const { data, setData, failed, reload } = useLoad(api.academy);
  const { busy, error, run } = useAction();
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero, price } = data;
  const green = hero.level < data.minLevel;
  // Known Talents last, so what can be learned comes first.
  const talents = [...data.talents].sort((a, b) => Number(a.known) - Number(b.known));

  return (
    <Building title={t('city.academy')} blurb={t('academy.blurb')} hero={hero}>
      <p className="m-0 text-sm">
        {green ? t('academy.tooGreen', { n: data.minLevel }) : price === null ? t('academy.done') : t('academy.count', { n: data.learned.length, m: data.max })}
      </p>
      <section className="grid gap-2">
        <span className="sub-heading">{t('academy.talents')}</span>
        {talents.map((talent) => (
          <div key={talent.id} className={`panel grid gap-2 p-3 ${talent.known ? 'opacity-60' : ''}`}>
            <div className="grid gap-0.5">
              <span className="font-head text-lg font-extrabold">{text(talent.name)}</span>
              <span className="text-sm text-muted">{text(talent.description)}</span>
            </div>
            {talent.known ? (
              <span className="text-sm text-muted">{data.learned.includes(talent.id) ? t('academy.learnedHere') : t('academy.known')}</span>
            ) : price !== null && !green && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || hero.gold < price || !hero.inCity}
                onClick={() => void run(async () => {
                  setData(await api.learnTalent(talent.id));
                  play('page');
                })}
              >
                {t('academy.learn', { n: price.toLocaleString() })}
              </button>
            )}
          </div>
        ))}
      </section>
      <p className="m-0 text-sm text-muted">{t('academy.note')}</p>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </Building>
  );
}
