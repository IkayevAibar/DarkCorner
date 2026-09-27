import { useState } from 'react';
import type { EventAction, EventView, ItemView, LabyrinthResult, LabyrinthView } from '@dark/shared';
import { api } from '../../api';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { ItemPicker } from '../../components/ItemPicker';
import { useSheet } from '../../components/Sheet';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';

type Act = (call: () => Promise<LabyrinthResult>) => Promise<void>;

const ALTAR_TIERS = ['common', 'uncommon', 'rare'];

/** What an Event room offers, with its buttons (docs/design.md → Event rooms). */
export function EventPanel({ event, view, busy, act }: { event: EventView; view: LabyrinthView; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const send = (action: EventAction) => act(() => api.eventAction(action));
  const pickFromBag = (title: string, filter: (i: ItemView) => boolean, note: (i: ItemView) => string | null, action: (i: ItemView) => EventAction) =>
    openSheet({
      title,
      body: <BagPicker filter={filter} note={note} onPick={(item) => { closeSheet(); void send(action(item)); }} />,
    });

  const intro = t(`event.${event.kind}.intro` as MessageKey);
  const done = event.done && event.kind !== 'merchant';

  return (
    <section className="panel grid gap-3 p-3.5">
      <div className="grid gap-0.5">
        <span className="sub-heading">{t(`event.${event.kind}` as MessageKey)}</span>
        <p className="m-0">{intro}</p>
        {done && <p className="m-0 text-sm text-muted italic">{t('event.done')}</p>}
      </div>

      {event.kind === 'three-chests' && (
        <div className="grid grid-cols-3 gap-2">
          {event.chests.map((chest, i) => (
            <button
              key={i}
              type="button"
              className={`btn grid justify-items-center gap-1 p-2 ${chest.picked ? 'border-gold' : ''}`}
              disabled={busy || event.done}
              onClick={() => void send({ action: 'pick', chest: i })}
            >
              <span className="font-head text-2xl">{['I', 'II', 'III'][i]}</span>
              <span className="text-xs font-normal">
                {chest.content === null ? t('event.three-chests.closed')
                  : chest.content.kind === 'gold' ? t('hero.gold', { n: chest.content.amount })
                  : chest.content.kind === 'mimic' ? t('event.three-chests.mimic')
                  : t(`tier.${chest.content.tier}`)}
              </span>
            </button>
          ))}
        </div>
      )}

      {event.kind === 'shrine' && !event.done && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send({ action: 'pray' })}>{t('event.shrine.pray')}</button>
      )}

      {event.kind === 'gambler' && !event.done && (
        <Gamble
          maxBet={event.maxBet}
          busy={busy}
          onBet={(amount) => void send({ action: 'bet-gold', amount })}
          onBetItem={() => pickFromBag(
            t('event.gambler.betItem'),
            (i) => i.kind === 'gear' && !['mythic', 'relic'].includes(i.tier),
            (i) => t(`tier.${i.tier}`),
            (i) => ({ action: 'bet-item', itemId: i.id }),
          )}
        />
      )}

      {event.kind === 'merchant' && (
        <>
          <div className="grid gap-2">
            {event.wares.map((w) => (
              <button
                key={w.id}
                type="button"
                className="btn flex items-center gap-3 p-2 text-left font-body font-normal"
                disabled={busy || w.sold}
                onClick={() => openSheet({
                  title: text(w.item.name),
                  body: (
                    <div className="grid gap-4">
                      <ItemDetails item={w.item} />
                      <button type="button" className="btn btn-primary" disabled={view.hero.carriedGold < w.price} onClick={() => { closeSheet(); void send({ action: 'buy', ware: w.id }); }}>
                        {t('shop.buyFor', { n: w.price.toLocaleString() })}
                      </button>
                      <span className="text-xs text-muted">{t('event.merchant.carried', { n: view.hero.carriedGold })}</span>
                    </div>
                  ),
                })}
              >
                <ItemChip item={w.item} size={48} />
                <span className="min-w-0 flex-1 truncate font-head font-bold">{text(w.item.name)}</span>
                <span className="font-head font-bold text-[#f1c75b]">{w.sold ? t('shop.soldOut') : w.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => pickFromBag(
              t('event.merchant.sell'),
              (i) => i.tier !== 'relic',
              (i) => t('hero.gold', { n: i.worth * event.buysAt }),
              (i) => ({ action: 'sell', itemId: i.id }),
            )}
          >
            {t('event.merchant.sell')}
          </button>
        </>
      )}

      {event.kind === 'cursed-altar' && !event.done && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => pickFromBag(
            t('event.cursed-altar.offer'),
            (i) => i.kind === 'gear' && i.identified && ALTAR_TIERS.includes(i.tier),
            (i) => t(`tier.${i.tier}`),
            (i) => ({ action: 'offer', itemId: i.id }),
          )}
        >
          {t('event.cursed-altar.offer')}
        </button>
      )}

      {event.kind === 'locked-cache' && !event.done && (
        <button type="button" className="btn btn-primary" disabled={busy || !event.canOpen} onClick={() => void send({ action: 'open' })}>
          {event.free ? t('event.locked-cache.pick') : event.canOpen ? t('event.locked-cache.key') : t('event.locked-cache.noKey')}
        </button>
      )}

      {event.kind === 'lockpicking' && !event.done && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send({ action: 'pick-lock' })}>{t('event.lockpicking.try')}</button>
      )}
    </section>
  );
}

function Gamble({ maxBet, busy, onBet, onBetItem }: { maxBet: number; busy: boolean; onBet: (amount: number) => void; onBetItem: () => void }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(Math.min(maxBet, 50)));
  const value = Number.parseInt(amount, 10);
  const valid = Number.isInteger(value) && value >= 1 && value <= maxBet;
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input className="field flex-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-label={t('event.gambler.amount')} />
        <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => onBet(value)}>{t('event.gambler.bet')}</button>
      </div>
      <span className="text-xs text-muted">{t('event.gambler.max', { n: maxBet })}</span>
      <button type="button" className="btn" disabled={busy} onClick={onBetItem}>{t('event.gambler.betItem')}</button>
    </div>
  );
}

/** The Hero's Bag, for choosing what to bet, sell or offer. */
function BagPicker({ filter, note, onPick }: { filter: (i: ItemView) => boolean; note: (i: ItemView) => string | null; onPick: (i: ItemView) => void }) {
  const { t } = useI18n();
  const { data } = useLoad(api.myHero);
  if (!data?.hero) return <p className="m-0 text-muted">{t('loading')}</p>;
  return <ItemPicker title={t('hero.bag', { n: data.hero.bag.length, m: data.hero.bagSlots })} items={data.hero.bag.filter(filter)} note={note} onPick={onPick} />;
}
