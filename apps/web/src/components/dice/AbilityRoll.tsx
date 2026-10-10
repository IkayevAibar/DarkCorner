import { useEffect, useRef, useState } from 'react';
import { ABILITY_IDS, type AbilitySetView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { useReducedMotion } from '../loot/motion';
import diceStyles from './dice.css?inline';

const STEP = 480;
const LAND = 270;
const DURATION = STEP * 6;
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

/** Changing the recorded set replaces the whole reveal, including its completion callback. */
export function AbilityRoll(props: { set: AbilitySetView; onDone?: () => void }) {
  return <Reveal key={JSON.stringify(props.set)} {...props} />;
}

function Reveal({ set, onDone }: { set: AbilitySetView; onDone?: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const callback = useRef(onDone);
  callback.current = onDone;
  const done = useRef(false);
  const complete = reduced || elapsed >= DURATION;

  useEffect(() => {
    if (reduced) { setElapsed(DURATION); return; }
    if (done.current) return;
    const start = performance.now();
    let request = 0, last = -100, sounded = -1;
    const tick = (now: number) => {
      const age = Math.min(DURATION, now - start);
      const score = Math.min(5, Math.floor(age / STEP));
      if (score !== sounded) { sounded = score; play('die', { volume: .4 }); }
      if (age - last >= 55 || age === DURATION) { last = age; setElapsed(age); }
      if (age < DURATION) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [reduced]);

  useEffect(() => {
    if (complete && !done.current) { done.current = true; callback.current?.(); }
  }, [complete]);

  return <section className="ability-roll panel" aria-label={t('hero.abilities')} aria-busy={!complete} data-ability-roll data-complete={complete}>
    <style>{diceStyles}</style>
    <div className="ability-roll-heading"><span>{t('hero.abilities')}</span><span aria-hidden="true">4d6</span></div>
    <ol className="ability-roll-scores">
      {ABILITY_IDS.map((ability, row) => {
        const roll = set.rolls[ability];
        const age = complete ? STEP : elapsed - row * STEP;
        const landed = age >= LAND, revealed = age >= LAND + 100;
        return <li key={ability} className={`ability-roll-row ${age < 0 ? 'waiting' : landed ? 'landed' : 'tumbling'}`} data-ability={ability}>
          <b className="ability-roll-label">{t(`ability.${ability}`)}</b>
          <div className="ability-roll-dice" aria-hidden="true">
            {roll.dice.map((value, i) => {
              // Decorative faces only. Final values, the dropped index and totals come straight from the server.
              const face = landed ? value : ((Math.floor(Math.max(0, age) / 55) * (i + 1) + i * 3 + row) % 6) + 1;
              return <span key={i} className={`ability-die ${revealed && i === roll.dropped ? 'dropped' : ''}`} style={{ animationDelay: `${i * -70}ms` }} data-face={landed ? value : undefined}>
                <svg viewBox="0 0 36 36" fill="currentColor">{PIPS[face]?.map(p => <circle key={p} cx={9 + p % 3 * 9} cy={9 + Math.floor(p / 3) * 9} r="2.6" />)}</svg>
              </span>;
            })}
          </div>
          <span className="sr-only">{landed && roll.dice.map((value, i) => i === roll.dropped ? <s key={i}>{value} </s> : <span key={i}>{value} </span>)}</span>
          <strong className={`ability-roll-total ${revealed ? 'revealed' : ''}`} data-score={revealed ? roll.total : undefined}>{revealed ? roll.total : '·'}</strong>
        </li>;
      })}
    </ol>
    <div className="ability-roll-sum" role="status">{complete ? t('create.total', { n: set.total }) : <span aria-hidden="true">◆ · ◆ · ◆</span>}</div>
  </section>;
}
