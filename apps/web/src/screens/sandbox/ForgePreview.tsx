import { useState } from 'react';
import type { UpgradeResult } from '@dark/shared';
import { UpgradeStrike } from '../../components/forge/UpgradeStrike';
import { useI18n } from '../../i18n';
import { LOOT_HERO, REVEALS } from './lootFixtures';

export const FORGE_ITEM = { ...REVEALS.rare, id: 'forge-sword', base: 'longsword', icon: 'sword', art: '/art/gear/longsword.webp', upgrade: 7, name: { en: 'Sword of the Watch', ru: 'Меч дозора' },
  gear: { ...REVEALS.rare.gear!, slot: 'main' as const, group: 'martial' as const, damage: { dice: 1, sides: 8, min: 2, max: 12, percent: 150, hits: 'slash' as const } } };
export const UPGRADES: Record<string, UpgradeResult> = {
  success: { outcome: 'success', roll: 18, chance: 40, item: { ...FORGE_ITEM, upgrade: 8 }, hero: LOOT_HERO },
  failed: { outcome: 'failed', roll: 94, chance: 85, item: { ...FORGE_ITEM, upgrade: 2 }, hero: LOOT_HERO },
  dropped: { outcome: 'dropped', roll: 72, chance: 40, item: { ...FORGE_ITEM, upgrade: 6 }, hero: LOOT_HERO },
  saved: { outcome: 'saved', roll: 99, chance: 40, item: { ...FORGE_ITEM, upgrade: 6 }, hero: LOOT_HERO },
  destroyed: { outcome: 'destroyed', roll: 97, chance: 40, item: null, hero: LOOT_HERO },
  ten: { outcome: 'success', roll: 12, chance: 20, item: { ...FORGE_ITEM, upgrade: 10 }, hero: LOOT_HERO },
};

export function ForgePreview() {
  const { t } = useI18n();
  const [choice, setChoice] = useState('success');
  const [round, setRound] = useState(0);
  const result = UPGRADES[choice]!;
  return <section className="grid gap-3" data-forge-preview>
    <h2 className="sub-heading m-0">{t('city.forge')}</h2>
    <div className="flex flex-wrap gap-2">{Object.entries(UPGRADES).map(([key, value]) => <button key={key} type="button" className="btn btn-small" data-upgrade={key} onClick={() => { setChoice(key); setRound(n => n + 1); }}>
      {t(`forge.outcome.${value.outcome}`, { n: value.item?.upgrade ?? 0 })}
    </button>)}</div>
    <UpgradeStrike key={round} item={{ ...FORGE_ITEM, upgrade: choice === 'ten' ? 9 : choice === 'failed' ? 2 : 7 }} result={result} onDone={() => {}} />
  </section>;
}
