import { useState } from 'react';
import { BULK_TIERS, type BulkTier, type ItemView, takenInBulk } from '@dark/shared';
import { api } from '../../api';
import { ItemChip, useText } from '../../components/items/ItemChip';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { play } from '../../sound';

const remembered = (mode: string): BulkTier => {
  try {
    const saved = localStorage.getItem(`dc.bulk.${mode}`);
    return (BULK_TIERS as readonly string[]).includes(saved ?? '') ? (saved as BulkTier) : 'uncommon';
  } catch {
    return 'uncommon';
  }
};
const remember = (mode: string, tier: BulkTier) => {
  try {
    localStorage.setItem(`dc.bulk.${mode}`, tier);
  } catch {
    // A private window: the choice just isn't kept.
  }
};

/**
 * Selling or Salvage in bulk (docs/design.md → The City): every Bag Item up to a Tier, listed
 * before it goes. The server takes the same Items (takenInBulk from packages/shared).
 */
export function BulkPanel({ mode, bag, rate = 0, onDone }: { mode: 'sell' | 'salvage'; bag: ItemView[]; rate?: number; onDone: () => void }) {
  const { t } = useI18n();
  const { openSheet, closeSheet } = useSheet();
  const [upTo, setUpTo] = useState<BulkTier>(() => remembered(mode));
  const [result, setResult] = useState<string | null>(null);
  const items = bag.filter((i) => takenInBulk({ ...i, gear: i.kind === 'gear' }, upTo));
  const gold = items.reduce((sum, i) => sum + Math.round(i.worth * rate), 0);
  const pick = (tier: BulkTier) => {
    setUpTo(tier);
    remember(mode, tier);
    setResult(null);
  };

  const confirm = () => openSheet({
    title: t(mode === 'sell' ? 'bulk.sellTitle' : 'bulk.salvageTitle'),
    body: (
      <BulkConfirm
        mode={mode}
        items={items}
        gold={gold}
        upTo={upTo}
        onDone={(line) => {
          setResult(line);
          closeSheet();
          onDone();
        }}
      />
    ),
  });

  return (
    <section className="grid gap-2">
      <span className="sub-heading">{t(mode === 'sell' ? 'bulk.sellHeading' : 'bulk.salvageHeading')}</span>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t('bulk.upTo')}>
        <span className="text-sm text-muted">{t('bulk.upTo')}</span>
        {BULK_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={upTo === tier}
            className={`btn btn-small ${upTo === tier ? 'border-gold text-gold' : ''}`}
            onClick={() => pick(tier)}
          >
            {t(`tier.${tier}` as MessageKey)}
          </button>
        ))}
      </div>
      <button type="button" className="btn" disabled={items.length === 0} onClick={confirm}>
        {items.length === 0 ? t('bulk.none')
          : mode === 'sell' ? t('bulk.sellButton', { n: items.length, gold: gold.toLocaleString() }) : t('bulk.salvageButton', { n: items.length })}
      </button>
      {result && <p className="m-0 text-sm text-gold">{result}</p>}
      <p className="m-0 text-xs text-muted">{t('bulk.keeps')}</p>
    </section>
  );
}

function BulkConfirm({ mode, items, gold, upTo, onDone }: { mode: 'sell' | 'salvage'; items: ItemView[]; gold: number; upTo: BulkTier; onDone: (line: string) => void }) {
  const { t } = useI18n();
  const text = useText();
  const { busy, error, run } = useAction();
  const go = () => void run(async () => {
    if (mode === 'sell') {
      const r = await api.sellBulk(upTo);
      play('coins');
      onDone(t('bulk.sold', { n: r.sold, gold: r.gold.toLocaleString() }));
    } else {
      play('anvil', { rate: 1.15 });
      const r = await api.salvageBulk(upTo);
      play('loot', { delay: 150 });
      onDone(t('bulk.salvaged', { n: r.salvaged, got: r.got.map((g) => `${text(g.name)} ×${g.quantity}`).join(', ') || '—' }));
    }
  });
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
        {items.map((item) => <ItemChip key={item.id} item={item} size={52} />)}
      </div>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={go}>
        {mode === 'sell' ? t('bulk.sellGo', { n: items.length, gold: gold.toLocaleString() }) : t('bulk.salvageGo', { n: items.length })}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
