import { useState } from 'react';
import type { ItemView } from '@dark/shared';
import type { CompanionView } from '@dark/solo';
import { api } from '../../api';
import { Loading } from '../../components/Building';
import { Meter } from '../../components/Meter';
import { Token } from '../../components/Token';
import { ItemCard } from '../../components/items/ItemCard';
import { ItemTile } from '../../components/items/ItemTile';
import { useText } from '../../components/items/text';
import { useSheet } from '../../components/Sheet';
import { useLoad } from '../../components/useLoad';
import { describeError } from '../../errors';
import { useI18n } from '../../i18n';
import { play } from '../../sound';

/**
 * Solo: the Companion at the Tavern (docs/design.md → The solo game → The Companion):
 * today's three to hire, or the one at the Hero's side, with its gear to take back.
 */
export function Companion() {
  const { t, locale } = useI18n();
  const { data, setData, failed, reload } = useLoad(() => api.companion(locale));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (failed === 'no_hero') return <p className="tavern-empty">{t('city.noHero')}</p>;
  if (!data) return <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const act = async (call: () => Promise<CompanionView>, sound?: Parameters<typeof play>[0]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(await call());
      if (sound) play(sound);
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      setBusy(false);
    }
  };
  return <CompanionCard data={data} busy={busy} error={error}
    onHire={(offer) => void act(() => api.hireCompanion(offer, locale), 'coins')}
    onDismiss={() => void act(() => api.dismissCompanion())}
    onTakeBack={(item) => void act(() => api.takeFromCompanion(item.id), 'equip')} />;
}

export function CompanionCard({ data, busy = false, error = null, onHire, onDismiss, onTakeBack }: {
  data: CompanionView; busy?: boolean; error?: string | null;
  onHire: (offer: number) => void; onDismiss: () => void; onTakeBack: (item: ItemView) => void;
}) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const [dismissing, setDismissing] = useState(false);
  const c = data.companion;
  const showGear = (item: ItemView) => openSheet({
    title: text(item.name),
    body: <div className="grid gap-4">
      <ItemCard item={item} />
      <button type="button" className="btn" disabled={busy || c?.backAt != null || c?.waiting} onClick={() => { closeSheet(); onTakeBack(item); }}>{t('companion.takeBack')}</button>
    </div>,
  });

  return (
    <section className="tavern-lodging" data-companion>
      {data.notices.map((n, i) => <p key={i} className="m-0 text-sm text-tier-uncommon">{text(n)}</p>)}
      {c ? (
        <>
          <div className="flex items-center gap-3">
            <Token art={c.portraitUrl} label={c.name} ring={c.banner} size={56} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-head text-xl font-extrabold">{c.name}</span>
              <span className="text-xs text-muted">{t('duo.partnerLine', { level: c.level, cls: t(`class.${c.class}`) })} · {t('companion.wage', { n: c.wage.toLocaleString() })}</span>
            </div>
          </div>
          <Meter label={t('hero.health')} value={c.hp} max={c.maxHp} kind="health" />
          <Meter label={t('companion.loyalty')} value={c.loyalty} max={c.loyaltyMax} kind="loyalty" />
          <p className="m-0 text-xs text-muted">{t('companion.loyaltyAbout')}</p>
          {c.backAt && <p className="m-0 text-sm text-[#ff9a8a]">{t('companion.down')}</p>}
          {c.waiting && <p className="m-0 text-sm text-gold">{t('companion.waiting')}</p>}
          <span className="sub-heading">{t('companion.gear')}</span>
          {c.gear.length === 0 ? <p className="m-0 text-sm text-muted italic">{t('hero.empty')}</p> : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
              {c.gear.map((item) => <ItemTile key={item.id} item={item} size={56} onClick={() => showGear(item)} />)}
            </div>
          )}
          <p className="m-0 text-xs text-muted">{t('companion.giveHow', { name: c.name })}</p>
          <button type="button" className={dismissing ? 'btn btn-primary' : 'btn'} disabled={busy}
            onClick={() => (dismissing ? onDismiss() : setDismissing(true))}>
            {dismissing ? t('companion.dismissConfirm', { name: c.name }) : t('companion.dismiss', { name: c.name })}
          </button>
        </>
      ) : (
        <>
          <p className="m-0 text-sm text-muted">{t('companion.about')}</p>
          {data.offers.length === 0 ? <p className="m-0 text-sm text-muted italic">{t('companion.inCity')}</p> : data.offers.map((o, i) => (
            <div key={o.name} className="flex items-center gap-3">
              <Token art={o.portraitUrl} label={o.name} ring={o.banner} size={48} />
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-head font-bold">{o.name}</span>
                <span className="text-xs text-muted">{t('duo.partnerLine', { level: o.level, cls: t(`class.${o.class}`) })}</span>
              </div>
              <button type="button" className="btn btn-small shrink-0" disabled={busy || data.gold < o.wage} onClick={() => onHire(i)}>
                {t('companion.hire', { n: o.wage.toLocaleString() })}
              </button>
            </div>
          ))}
          {data.offers.length > 0 && <span className="text-xs text-muted">{t('companion.gold', { n: data.gold.toLocaleString() })}</span>}
        </>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}
