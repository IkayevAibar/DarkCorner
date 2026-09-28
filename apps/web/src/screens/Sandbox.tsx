import { useState } from 'react';
import { CityPreview } from './sandbox/CityPreview';
import type { FightReplay } from '@dark/shared';
import { useI18n } from '../i18n';
import { FightScene } from '../components/fight/FightScene';
import { FIGHTS } from './sandbox/fightExamples';

/**
 * Codex builds visual components here against @dark/shared types with fake
 * data, before they are wired to the API. Only reachable in development builds.
 */
export function Sandbox() {
  const { t } = useI18n();
  const [fight, setFight] = useState<FightReplay | null>(null);
  return (
    <section className="grid gap-3">
      <h1 className="sub-heading m-0">{t('sandbox.title')}</h1>
      <p className="m-0 text-muted">{t('sandbox.body')}</p>

      <CityPreview />
      <h2 className="sub-heading m-0">{t('fight.title')}</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(FIGHTS).map(([name, replay]) => (
          <button key={name} type="button" className="btn btn-small" onClick={() => setFight(replay)}>
            {name}
          </button>
        ))}
      </div>
      {fight && <FightScene replay={fight} onDone={() => setFight(null)} />}
    </section>
  );
}
