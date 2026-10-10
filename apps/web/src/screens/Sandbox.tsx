import { useState } from 'react';
import { TavernPreview } from './sandbox/TavernPreview';
import { CityPreview } from './sandbox/CityPreview';
import { LootPreview } from './sandbox/LootPreview';
import { TurnPreview } from './sandbox/TurnPreview';
import { TwinPreview } from './sandbox/TwinPreview';
import { TrustPreview } from './sandbox/TrustPreview';
import { MapPreview } from './sandbox/MapPreview';
import { LockPreview } from './sandbox/LockPreview';
import { CupsPreview } from './sandbox/CupsPreview';
import { DicePreview } from './sandbox/DicePreview';
import { ForgePreview } from './sandbox/ForgePreview';
import { SoundPreview } from './sandbox/SoundPreview';
import type { FightReplay } from '@dark/shared';
import { useI18n } from '../i18n';
import { FightScene } from '../components/fight/FightScene';
import { FIGHTS } from './sandbox/fightExamples';
import { FightLog } from './labyrinth/FightLog';
import { classPowerFixtures } from '../components/fight/classPowerFixtures';

const POWER_FIGHTS = classPowerFixtures(FIGHTS['goblins-victory-crit']!);

/**
 * Codex builds visual components here against @dark/shared types with fake
 * data, before they are wired to the API. Only reachable in development builds.
 */
export function Sandbox() {
  const { t } = useI18n();
  const [fight, setFight] = useState<FightReplay | null>(null);
  const [report, setReport] = useState<FightReplay | null>(null);
  return (
    <section className="grid gap-3">
      <h1 className="sub-heading m-0">{t('sandbox.title')}</h1>
      <p className="m-0 text-muted">{t('sandbox.body')}</p>

      <DicePreview />
      <ForgePreview />
      <SoundPreview />
      <CupsPreview />
      <LockPreview />
      <TrustPreview />
      <TwinPreview onFight={setFight} />
      <TavernPreview />
      <CityPreview />
      <LootPreview />
      <MapPreview />
      <TurnPreview />
      <h2 className="sub-heading m-0">{t('fight.title')}</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries({ ...POWER_FIGHTS, ...FIGHTS }).map(([name, replay]) => (
          <button key={name} type="button" className="btn btn-small" onClick={() => setFight(replay)}>
            {name}
          </button>
        ))}
      </div>
      {fight && <FightScene replay={fight} onDone={() => { setReport(fight); setFight(null); }} />}
      {report && <details className="panel p-4" open data-fight-report>
        <summary>{t('report.fightLog')}</summary><FightLog replay={report} />
      </details>}
    </section>
  );
}
