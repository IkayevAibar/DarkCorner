import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { useText } from '../../components/items/ItemChip';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { formatDuration, useNow } from '../../time';
import { NeedHero } from './NeedHero';

export function Temple() {
  const { t } = useI18n();
  const text = useText();
  const now = useNow(30_000);
  const { data, setData, failed, reload } = useLoad(api.temple);
  const { busy, error, run } = useAction();
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero } = data;
  const current = hero.luck.blessing;

  return (
    <Building title={t('city.temple')} blurb={t('temple.blurb')} hero={hero}>
      {current && (
        <div className="panel grid gap-0.5 p-3">
          <span className={`font-head text-lg font-extrabold ${current.curse ? 'text-[#ff9a8a]' : 'text-gold'}`}>{text(current.name)}</span>
          <span className="text-sm">{text(current.description)}</span>
          <span className="text-xs text-muted">{t('temple.left', { time: formatDuration(t, new Date(current.until).getTime() - now) })}</span>
        </div>
      )}
      <section className="grid gap-2">
        <span className="sub-heading">{t('temple.blessings')}</span>
        {data.blessings.map((b) => (
          <div key={b.id} className="panel grid gap-2 p-3">
            <div className="grid gap-0.5">
              <span className="font-head text-lg font-extrabold">{text(b.name)}</span>
              <span className="text-sm text-muted">{text(b.description)}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || hero.gold < b.price || !hero.inCity}
              onClick={() => void run(async () => {
                setData(await api.bless(b.id));
                play('reveal', { rate: 0.8 });
              })}
            >
              {t('temple.buy', { n: b.price })}
            </button>
          </div>
        ))}
      </section>
      <p className="m-0 text-sm text-muted">{t('temple.note')}</p>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </Building>
  );
}
