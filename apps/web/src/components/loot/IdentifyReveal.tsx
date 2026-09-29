import { useEffect, useRef, useState } from 'react';
import type { ItemView } from '@dark/shared';
import { ItemDetails } from '../items/ItemChip';
import { useI18n } from '../../i18n';
import { play, playTier } from '../../sound';
import { useReducedMotion } from './motion';
import { TierBurst } from './TierBurst';

export function IdentifyReveal(props: { before: ItemView; after: ItemView; onDone: () => void }) {
  return <Reveal key={props.after.id} {...props} />;
}

function Reveal({ before, after, onDone }: { before: ItemView; after: ItemView; onDone: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const last = 3 + (after.bonusStats?.length ?? 0) + Number(after.power !== null);
  const [step, setStep] = useState(reduced ? last : 0);
  const shown = reduced ? last : step;
  const complete = shown >= last;
  const cue = useRef(false);
  const dismissed = useRef(false);
  useEffect(() => {
    if (reduced) { setStep(last); return; }
    if (step >= last) return;
    const timer = window.setTimeout(() => {
      if (step === 0) play('reveal', { volume: .45 });
      else play('tick', { volume: .5 });
      setStep(step + 1);
    }, step === 0 ? 650 : 280);
    return () => clearTimeout(timer);
  }, [step, last, reduced]);
  useEffect(() => {
    if (complete && !cue.current) { cue.current = true; playTier(after.tier); }
  }, [complete, after.tier]);

  const card = <ItemDetails item={shown === 0 ? before : after} revealStep={complete || shown === 0 ? undefined : shown} />;
  return <div className="identify-reveal" data-reveal-complete={complete} data-reveal-step={shown}>
    <div className={`identify-card ${shown === 0 ? 'identify-sealed' : ''} ${complete && after.radiant ? 'identify-radiant' : ''}`}>
      {complete ? <TierBurst tier={after.tier}>{card}</TierBurst> : card}
    </div>
    <p className="sr-only" aria-live="polite">{complete ? t('loot.identified') : t('loot.identifying')}</p>
    <button type="button" className={`btn ${complete ? 'btn-primary' : ''}`} onClick={() => {
      if (!complete) setStep(last);
      else if (!dismissed.current) { dismissed.current = true; onDone(); }
    }}>{complete ? t('report.dismiss') : t('fight.skip')}</button>
  </div>;
}
