import { useState } from 'react';
import { TIERS, type OpenChestResult } from '@dark/shared';
import { ChestSpin } from '../../components/loot/ChestSpin';
import { IdentifyReveal } from '../../components/loot/IdentifyReveal';
import { TierBurst } from '../../components/loot/TierBurst';
import { ItemTile } from '../../components/items/ItemTile';
import { useSheet } from '../../components/Sheet';
import { useI18n } from '../../i18n';
import { playTier } from '../../sound';
import { CHESTS, REVEALS, sealed } from './lootFixtures';

export function LootPreview() {
  const { t } = useI18n();
  const { openSheet, closeSheet } = useSheet();
  const [spin, setSpin] = useState<OpenChestResult | null>(null);
  const [burst, setBurst] = useState(0);
  return <section className="grid gap-4 border-y border-line py-5" data-loot-preview>
    <h2 className="sub-heading m-0">{t('sandbox.loot')}</h2>
    <div className="flex flex-wrap gap-2">
      {Object.values(CHESTS).map(result => <button type="button" className="btn btn-small" key={result.grade}
        data-chest={result.grade} onClick={() => setSpin(result)}>{t(`loot.chest.${result.grade}`)}</button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      {(['rare', 'radiant', 'relic'] as const).map(key => <button type="button" className="btn btn-small" key={key}
        data-reveal={key} onClick={() => openSheet({ title: t('loot.identifyFree'),
          body: <IdentifyReveal before={sealed(REVEALS[key])} after={REVEALS[key]} onDone={closeSheet} />,
        })}>{t(`sandbox.${key}Reveal`)}</button>)}
    </div>
    <button type="button" className="btn btn-small justify-self-start" data-replay-tiers onClick={() => { setBurst(n => n + 1); playTier('relic'); }}>
      {t('sandbox.tierBursts')}
    </button>
    <div className="flex flex-wrap gap-x-4 gap-y-6" key={burst}>
      {TIERS.map(tier => <div className="grid justify-items-center gap-1" key={tier}>
        <TierBurst tier={tier}><ItemTile item={{ ...REVEALS.rare, tier }} /></TierBurst>
        <span className="text-xs" style={{ color: `var(--color-tier-${tier})` }}>{t(`tier.${tier}`)}</span>
      </div>)}
    </div>
    {spin && <ChestSpin result={spin} onDone={() => setSpin(null)} />}
  </section>;
}
