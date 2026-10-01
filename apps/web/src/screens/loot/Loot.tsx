import { useState } from 'react';
import type { HeroView, ItemView, OpenChestResult } from '@dark/shared';
import { api } from '../../api';
import { Loading } from '../../components/Building';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { ItemPicker } from '../../components/ItemPicker';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { BlessingStatus } from '../../components/BlessingStatus';
import { NeedHero } from '../city/NeedHero';
import { ChestSpin } from '../../components/loot/ChestSpin';
import { IdentifyReveal } from '../../components/loot/IdentifyReveal';

const GRADES = ['iron', 'silver', 'gold'] as const;

/** The Loot tab: Chests to open, Items to identify, and the Hero's luck. */
export function Loot() {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const { data, failed, reload } = useLoad(api.myHero);
  const { busy, error, run } = useAction();
  const [spin, setSpin] = useState<OpenChestResult | null>(null);
  if (!data) return <Loading failed={failed !== null} onRetry={() => void reload()} />;
  if (!data.hero) return <NeedHero />;
  const hero = data.hero;
  const reachable = hero.inCity ? [...hero.bag, ...hero.storage] : hero.bag;
  const count = (base: string) => reachable.filter((i) => i.base === base).reduce((s, i) => s + i.quantity, 0);
  const hidden = reachable.filter((i) => i.kind === 'gear' && !i.identified);
  const scrolls = count('scroll-identify');
  const wizard = hero.class === 'wizard';

  const open = (chest: ItemView) => void run(async () => {
    setSpin(await api.openChest(chest.id));
  });

  return (
    <section className="grid gap-4">
      <Luck hero={hero} />

      <section className="grid gap-2">
        <span className="sub-heading">{t('loot.chests')}</span>
        {GRADES.every((g) => count(`chest-${g}`) === 0) ? (
          <p className="m-0 text-sm text-muted italic">{t('loot.noChests')}</p>
        ) : (
          GRADES.filter((g) => count(`chest-${g}`) > 0).map((g) => {
            const chest = reachable.find((i) => i.base === `chest-${g}`)!;
            const keys = count(`key-${g}`);
            return (
              <div key={g} className="panel flex items-center gap-3 p-2.5">
                <ItemChip item={{ ...chest, quantity: count(`chest-${g}`) }} size={52} />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-head font-bold">{text(chest.name)}</span>
                  <span className="text-xs text-muted">{t('loot.keys', { n: keys })}</span>
                </span>
                <button type="button" className="btn btn-primary btn-small" disabled={busy || keys === 0} onClick={() => open(chest)}>
                  {t('loot.open')}
                </button>
              </div>
            );
          })
        )}
        {!hero.inCity && <p className="m-0 text-xs text-muted">{t('loot.bagOnly')}</p>}
      </section>

      <ItemPicker
        title={t('loot.unidentified')}
        items={hidden}
        empty={t('loot.noneHidden')}
        onPick={(item) => openSheet({ title: text(item.name), body: <IdentifySheet item={item} scrolls={scrolls} free={wizard} onDone={() => void reload()} onClose={closeSheet} /> })}
      />
      <p className="m-0 text-sm text-muted">{wizard ? t('loot.wizardFree') : t('loot.scrolls', { n: scrolls })}</p>

      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      {spin && <ChestSpin result={spin} onDone={() => { setSpin(null); void reload(); }} />}
    </section>
  );
}

function Luck({ hero }: { hero: HeroView }) {
  const { t } = useI18n();
  const { luck } = hero;
  const percent = Math.min(100, (100 * luck.badLuck) / luck.badLuckMax);
  return (
    <section className="panel grid gap-2.5 p-3.5">
      <span className="sub-heading">{t('loot.luck')}</span>
      <div className="grid gap-1">
        <div className="flex items-baseline justify-between text-sm">
          <span>{t('loot.badLuck')}</span>
          <span className="font-head font-extrabold">{luck.badLuck}/{luck.badLuckMax}</span>
        </div>
        <span className="h-2.5 overflow-hidden rounded bg-black/40">
          <span className="block h-full bg-[linear-gradient(90deg,#6b3f8f,#ff8c1a)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </span>
        <span className="text-xs text-muted">{t('loot.badLuckHint', { n: luck.badLuckMax })}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="chip">{t('loot.magicFind', { n: luck.magicFind >= 0 ? `+${luck.magicFind}` : luck.magicFind })}</span>
        <span className="chip">{t('loot.goldFind', { n: luck.goldFind >= 0 ? `+${luck.goldFind}` : luck.goldFind })}</span>
      </div>
      {luck.blessing && <BlessingStatus blessing={luck.blessing} />}
    </section>
  );
}

function IdentifySheet({ item, scrolls, free, onDone, onClose }: { item: ItemView; scrolls: number; free: boolean; onDone: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const [revealed, setRevealed] = useState<ItemView | null>(null);
  if (revealed) {
    return <IdentifyReveal before={item} after={revealed} onDone={onClose} />;
  }
  return (
    <div className="grid gap-4">
      <ItemDetails item={item} />
      <button type="button" className="btn btn-primary" disabled={busy || (!free && scrolls === 0)} onClick={() => void run(async () => {
        const r = await api.identify(item.id);
        setRevealed(r.item);
        onDone();
      })}>
        {free ? t('loot.identifyFree') : t('loot.identify', { n: scrolls })}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
