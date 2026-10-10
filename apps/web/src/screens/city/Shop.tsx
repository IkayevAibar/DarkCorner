import type { HeroView, ItemView, ShopOffer } from '@dark/shared';
import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { ItemTile } from '../../components/items/ItemTile';
import { ItemCard } from '../../components/items/ItemCard';
import { useText } from '../../components/items/text';
import { ItemPicker } from '../../components/ItemPicker';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { formatDuration, useNow } from '../../time';
import { BulkPanel } from './BulkPanel';
import { NeedHero } from './NeedHero';

/** What the Shops pay: the Buyback price times the Hero's rate (a Haggler's and Charisma's better deal, from the server). */
const sellPrice = (rate: number, item: ItemView, quantity = item.quantity) => Math.round((item.worth / item.quantity) * quantity * rate);

export function Shop() {
  const { t } = useI18n();
  const text = useText();
  const now = useNow(30_000);
  const { openSheet, closeSheet } = useSheet();
  const { data, failed, reload } = useLoad(api.shop);
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero } = data;
  const done = () => {
    closeSheet();
    void reload();
  };

  const showOffer = (offer: ShopOffer, stackable: boolean) =>
    openSheet({ title: text(offer.item.name), body: <BuySheet offer={offer} stackable={stackable} gold={hero.gold} onDone={done} /> });
  const showSell = (item: ItemView) =>
    openSheet({ title: text(item.name), body: <SellSheet item={item} rate={data.sellRate} onDone={done} /> });
  const sellable = [...hero.bag, ...hero.storage];

  return (
    <Building title={t('city.shop')} blurb={t('shop.blurb')} hero={hero}>
      <section className="grid gap-2">
        <span className="sub-heading">{t('shop.basics')}</span>
        {data.basics.map((offer) => (
          <button key={offer.id} type="button" className="btn flex items-center gap-3 p-2 text-left font-body font-normal" onClick={() => showOffer(offer, true)}>
            <ItemTile item={offer.item} size={44} />
            <span className="min-w-0 flex-1 truncate font-head font-bold">{text(offer.item.name)}</span>
            <span className="font-head font-bold text-[#f1c75b]">{t('hero.gold', { n: offer.price })}</span>
          </button>
        ))}
      </section>

      <ItemPicker
        title={t('shop.stock', { time: formatDuration(t, new Date(data.restocksAt).getTime() - now) })}
        items={data.stock.map((o) => o.item)}
        note={(item) => {
          const offer = data.stock.find((o) => o.item.id === item.id)!;
          return offer.soldOut ? t('shop.soldOut') : t('hero.gold', { n: offer.price });
        }}
        onPick={(item) => {
          const offer = data.stock.find((o) => o.item.id === item.id)!;
          if (!offer.soldOut) showOffer(offer, false);
        }}
      />

      <BulkPanel mode="sell" bag={hero.bag} rate={data.sellRate} onDone={() => void reload()} />

      <ItemPicker
        title={t('shop.sell')}
        items={sellable}
        note={(item) => (item.tier === 'relic' ? '—' : t('hero.gold', { n: sellPrice(data.sellRate, item) }))}
        onPick={showSell}
        empty={t('shop.nothingToSell')}
      />
    </Building>
  );
}

function BuySheet({ offer, stackable, gold, onDone }: { offer: ShopOffer; stackable: boolean; gold: number; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const buy = (quantity: number) => void run(async () => {
    await api.shopBuy(offer.id, quantity);
    play('coins');
    onDone();
  });
  return (
    <div className="grid gap-4">
      <ItemCard item={offer.item} />
      <div className="flex flex-wrap gap-2">
        {(stackable ? [1, 5] : [1]).map((n) => (
          <button key={n} type="button" className="btn btn-primary flex-1" disabled={busy || gold < offer.price * n} onClick={() => buy(n)}>
            {n === 1 ? t('shop.buyFor', { n: offer.price }) : t('shop.buyMany', { m: n, n: offer.price * n })}
          </button>
        ))}
      </div>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function SellSheet({ item, rate, onDone }: { item: ItemView; rate: number; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const sell = (quantity: number) => void run(async () => {
    await api.sell(item.id, quantity);
    play('coins');
    onDone();
  });
  return (
    <div className="grid gap-4">
      <ItemCard item={item} />
      {item.tier === 'relic' ? (
        <p className="m-0 text-sm text-muted">{t('shop.noRelics')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.quantity > 1 && (
            <button type="button" className="btn flex-1" disabled={busy} onClick={() => sell(1)}>
              {t('shop.sellOne', { n: sellPrice(rate, item, 1) })}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => sell(item.quantity)}>
            {t(item.quantity > 1 ? 'shop.sellAll' : 'shop.sellFor', { n: sellPrice(rate, item) })}
          </button>
        </div>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
