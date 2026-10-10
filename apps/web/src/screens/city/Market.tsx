import { useState } from 'react';
import type { ItemView, Listing } from '@dark/shared';
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
import { NeedHero } from './NeedHero';

type Tab = 'browse' | 'mine' | 'sell';

export function Market() {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const [tab, setTab] = useState<Tab>('browse');
  const { data, failed, reload } = useLoad(api.market);
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero } = data;
  const done = () => {
    closeSheet();
    void reload();
  };

  return (
    <Building title={t('city.market')} blurb={t('market.blurb', { tax: data.taxPercent, days: data.days })} hero={hero}>
      <div className="grid grid-cols-3 gap-1.5">
        {(['browse', 'mine', 'sell'] as const).map((id) => (
          <button key={id} type="button" className={`btn btn-small ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
            {t(`market.tab.${id}`)}{id === 'mine' && data.mine.length > 0 ? ` · ${data.mine.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        data.listings.length === 0
          ? <p className="m-0 text-muted italic">{t('market.empty')}</p>
          : (
            <div className="grid gap-2">
              {data.listings.map((l) => (
                <ListingRow key={l.id} listing={l} onPick={() => openSheet({ title: text(l.item.name), body: <BuyListing listing={l} gold={hero.gold} onDone={done} /> })} />
              ))}
            </div>
          )
      )}

      {tab === 'mine' && (
        data.mine.length === 0
          ? <p className="m-0 text-muted italic">{t('market.noneMine')}</p>
          : (
            <div className="grid gap-2">
              {data.mine.map((l) => (
                <ListingRow key={l.id} listing={l} onPick={() => openSheet({ title: text(l.item.name), body: <TakeBack listing={l} onDone={done} /> })} />
              ))}
            </div>
          )
      )}

      {tab === 'sell' && (
        <ItemPicker
          title={t('market.pick')}
          items={[...hero.bag, ...hero.storage]}
          onPick={(item) => openSheet({ title: text(item.name), body: <ListItem item={item} tax={data.taxPercent} onDone={() => { done(); setTab('mine'); }} /> })}
          empty={t('shop.nothingToSell')}
        />
      )}
    </Building>
  );
}

function ListingRow({ listing, onPick }: { listing: Listing; onPick: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const now = useNow(60_000);
  return (
    <button type="button" className="btn flex items-center gap-3 p-2 text-left font-body font-normal" onClick={onPick}>
      <ItemTile item={listing.item} size={52} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-head font-bold" style={{ color: `var(--color-tier-${listing.item.tier})` }}>{text(listing.item.name)}</span>
        <span className="truncate text-xs text-muted">
          {listing.mine ? '' : `${listing.seller} · `}
          {listing.expired ? t('market.expired') : t('market.left', { time: formatDuration(t, new Date(listing.expiresAt).getTime() - now) })}
        </span>
      </span>
      <span className="font-head font-bold text-[#f1c75b]">{listing.price.toLocaleString()}</span>
    </button>
  );
}

function BuyListing({ listing, gold, onDone }: { listing: Listing; gold: number; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <div className="grid gap-4">
      <ItemCard item={listing.item} />
      <span className="text-sm text-muted">{t('market.soldBy', { name: listing.seller })}</span>
      <button type="button" className="btn btn-primary" disabled={busy || gold < listing.price} onClick={() => void run(async () => {
        await api.buyListing(listing.id);
        play('coins');
        onDone();
      })}>
        {t('shop.buyFor', { n: listing.price.toLocaleString() })}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function TakeBack({ listing, onDone }: { listing: Listing; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <div className="grid gap-4">
      <ItemCard item={listing.item} />
      <span className="text-sm text-muted">{t('market.listedFor', { n: listing.price.toLocaleString() })}</span>
      <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => {
        await api.cancelListing(listing.id);
        play('loot');
        onDone();
      })}>
        {t('market.takeBack')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function ListItem({ item, tax, onDone }: { item: ItemView; tax: number; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const [price, setPrice] = useState(String(Math.max(1, item.worth * 3)));
  const value = Number.parseInt(price, 10);
  const valid = Number.isInteger(value) && value >= 1;
  return (
    <div className="grid gap-4">
      <ItemCard item={item} />
      <label className="grid gap-1">
        <span className="sub-heading">{t('market.price')}</span>
        <input className="field" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
        {valid && <span className="text-sm text-muted">{t('market.youGet', { n: (value - Math.ceil((value * tax) / 100)).toLocaleString(), tax })}</span>}
      </label>
      <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => void run(async () => {
        await api.list(item.id, value);
        play('page');
        onDone();
      })}>
        {t('market.listGo')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
