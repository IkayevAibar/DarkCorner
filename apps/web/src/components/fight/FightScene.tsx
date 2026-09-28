import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FightReplay } from '@dark/shared';
import { useI18n } from '../../i18n';
import { roomArt } from '../../screens/labyrinth/roomArt';
import { BOSS_RING, MONSTER_RING, Token } from '../Token';
import { describe, displayNames, sound } from './presentation';
import { dieFor, duration, framesFor } from './replay';
import type { FightStage } from './stage';
import './fight.css';

export interface FightSceneProps {
  replay: FightReplay;
  room?: { floor: number; room: number };
  onDone: () => void;
}

/** Warm the graphics module on Labyrinth entry; applications are still created only for fights. */
export const preloadFightScene = () => import('./stage');

export function FightScene(props: FightSceneProps) {
  // A new replay is a new playback, even if the parent replaces it without closing the overlay.
  const identity = useRef({ replay: props.replay, id: 0 });
  if (identity.current.replay !== props.replay) identity.current = { replay: props.replay, id: identity.current.id + 1 };
  return <Playback key={identity.current.id} {...props} />;
}

function Playback({ replay, room, onDone }: FightSceneProps) {
  const { t, locale } = useI18n();
  const host = useRef<HTMLDivElement>(null), dialog = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null), renderer = useRef<FightStage | null>(null);
  const finishedOnce = useRef(false), done = useRef(onDone);
  done.current = onDone;
  const [step, setStep] = useState(0), [ready, setReady] = useState(false), [fallback, setFallback] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const names = useMemo(() => displayNames(replay, value => value[locale]), [replay, locale]);
  const frames = useMemo(() => framesFor(replay), [replay]);
  const frame = frames[step]!;
  const event = step ? replay.events[step - 1]! : null;
  const complete = step === replay.events.length;
  const die = dieFor(event);
  const dramatic = event?.type === 'death-save' || event?.type === 'reroll';
  const map = useMemo(() => roomArt(replay.map, room), [replay.map, room?.floor, room?.room]);
  const latest = useRef({ frame, event, reduced }); latest.current = { frame, event, reduced };
  const finish = useCallback(() => {
    if (finishedOnce.current) return;
    finishedOnce.current = true;
    renderer.current?.destroy(); renderer.current = null;
    done.current();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skip.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      if (e.key === 'Tab') {
        // The dialog has one action throughout playback. Keep focus out of the underlying Room.
        e.preventDefault(); skip.current?.focus();
      }
    };
    dialog.current?.addEventListener('keydown', keys);
    const element = dialog.current;
    return () => {
      element?.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [finish]);

  const miss = t('fight.whiff');
  useEffect(() => {
    const controller = new AbortController();
    setReady(false); setFallback(false);
    // Labyrinth may already have warmed the chunk; create its canvas only while open.
    void preloadFightScene().then(module => module.createFightStage({
      host: host.current!, replay, names, map, signal: controller.signal, miss,
    })).then(stage => {
      if (controller.signal.aborted || finishedOnce.current) { stage.destroy(); return; }
      renderer.current = stage;
      const value = latest.current;
      stage.show(value.frame, value.event, value.reduced);
      setReady(true);
    }).catch(() => {
      if (!controller.signal.aborted && !finishedOnce.current) { setFallback(true); setReady(true); }
    });
    return () => { controller.abort(); renderer.current?.destroy(); renderer.current = null; };
  }, [replay, names, map, miss]);

  useEffect(() => {
    renderer.current?.show(frame, event, reduced);
  }, [frame, event, reduced]);

  useEffect(() => {
    if (!ready || complete || finishedOnce.current) return;
    const timer = window.setTimeout(() => setStep(s => s + 1), duration(event, reduced));
    return () => window.clearTimeout(timer);
  }, [ready, complete, event, reduced]);

  const sounded = useRef(0);
  useEffect(() => {
    if (event && sounded.current !== step) { sounded.current = step; sound(event); }
  }, [step, event]);

  const lines = replay.events.slice(0, step).map(e => describe(t, e, names)).filter((line): line is string => line !== null).slice(-3);
  const outcome = event?.type === 'end' ? event.outcome : replay.outcome;
  return createPortal(
    <div className="fight-overlay" ref={dialog} role="dialog" aria-modal="true" aria-label={t('fight.title')} data-fight-step={step} data-fight-ready={ready} data-fight-complete={complete}>
      <div className="fight-panel">
        <header className="fight-heading">
          <span>{t('fight.title')}</span>
          <span className="fight-progress" aria-hidden="true">{Math.min(step, replay.events.length)} / {replay.events.length}</span>
        </header>
        <div className="fight-board">
          <div ref={host} className="fight-canvas" />
          {!ready && <div className="fight-loading" role="status">{t('loading')}</div>}
          {fallback && <div className="fight-fallback">
            <img {...map} className="fight-fallback-map" alt="" />
            {[...replay.monsters, replay.hero].map(who => {
              const state = frame.fighters[who.key]!;
              return <div key={who.key} className={who.key === 'hero' ? 'fight-fallback-hero' : ''} style={{ opacity: state.fled ? 0 : 1 }}>
                <Token art={who.art} label={names[who.key]!} ring={who.banner ?? (who.boss ? BOSS_RING : MONSTER_RING)} size={who.boss && replay.monsters.length === 1 ? 100 : 58} fallen={state.fallen} />
                <span>{names[who.key]} · {state.hp}/{who.maxHp}</span>
              </div>;
            })}
          </div>}
          {event?.type === 'surprise' && <div className="fight-ambush">{t(`fight.surprise.${event.side}`)}</div>}
          {die !== null && !complete && (
            <div key={step} className={`fight-die ${dramatic ? 'fight-die-large' : ''} ${reduced ? '' : 'fight-die-motion'} ${die === 20 ? 'fight-die-crit' : die === 1 ? 'fight-die-fumble' : ''}`} role="img" aria-label={`d20: ${die}`}>
              <svg viewBox="0 0 100 110" aria-hidden="true"><path d="M50 3 96 28 96 80 50 107 4 80 4 28Z" /><path className="fight-die-lines" d="M50 3 25 36 4 28M25 36 75 36 50 3M75 36 96 28M25 36 19 76 4 80M19 76 81 76 96 80M75 36 81 76M19 76 50 107 81 76M25 36 50 83 75 36" /></svg>
              <strong>{die}</strong>
              {dramatic && <span className="fight-die-label">{t('fight.deathSaveTitle')}</span>}
            </div>
          )}
          {frame.saves && <div className="fight-saves" aria-label={t('fight.saveCount', { s: frame.saves.successes, f: frame.saves.failures })}>
            <span className="fight-save-success">{'●'.repeat(frame.saves.successes)}{'○'.repeat(3 - frame.saves.successes)}</span>
            <span className="fight-save-failure">{'●'.repeat(frame.saves.failures)}{'○'.repeat(3 - frame.saves.failures)}</span>
          </div>}
          {complete && <div className={`fight-outcome fight-outcome-${outcome}`}>{t(`fight.${outcome}`)}</div>}
        </div>
        <div className="fight-log" aria-live="polite" aria-atomic="true">
          {lines.map((line, i) => <p key={`${step}-${i}`}>{line}</p>)}
        </div>
        <div className="sr-only">
          {[replay.hero, ...replay.monsters].map(who => <p key={who.key}>{names[who.key]}: {frame.fighters[who.key]!.hp}/{who.maxHp}. {Object.keys(frame.fighters[who.key]!.statuses).map(status => t(`fight.status.${status as 'burning' | 'poisoned' | 'paralyzed' | 'frightened'}`, { name: names[who.key]! })).join(' ')}</p>)}
        </div>
        <button ref={skip} type="button" className={`btn ${complete ? 'btn-primary' : ''}`} onClick={finish}>
          {complete ? t('report.dismiss') : t('fight.skip')}
        </button>
      </div>
    </div>, document.body,
  );
}
