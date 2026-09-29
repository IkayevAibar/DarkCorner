import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { FightReplay } from '@dark/shared';
import { useI18n } from '../../i18n';
import { roomArt } from '../../screens/labyrinth/roomArt';
import { BOSS_RING, MONSTER_RING, Token } from '../Token';
import { describe, displayNames, sound } from './presentation';
import { dieFor, framesFor } from './replay';
import { cueDuration, cueFor, Playhead, readSpeed, saveSpeed, sceneTime } from './choreography';
import { FightLog } from '../../screens/labyrinth/FightLog';
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
  const [speed, setSpeed] = useState(readSpeed);
  const [logOpen, setLogOpen] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const logState = useRef(logOpen); logState.current = logOpen;
  const names = useMemo(() => displayNames(replay, value => value[locale]), [replay, locale]);
  const frames = useMemo(() => framesFor(replay), [replay]);
  const frame = frames[step]!;
  const event = step ? replay.events[step - 1]! : null;
  const complete = step === replay.events.length;
  const paused = logOpen || hidden;
  const cue = useMemo(() => cueFor(replay, event, reduced), [replay, event, reduced]);
  const clock = useMemo(() => new Playhead(), [step, replay]);
  const die = dieFor(event);
  const dramatic = event?.type === 'death-save' || event?.type === 'reroll';
  const map = useMemo(() => roomArt(replay.map, room), [replay.map, room?.floor, room?.room]);
  const latest = useRef({ frame, event, reduced, cue }); latest.current = { frame, event, reduced, cue };
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
    const changed = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skip.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (logState.current) setLogOpen(false); else finish();
      }
      if (e.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? []);
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
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
      stage.show(value.frame, value.event, value.reduced, value.cue);
      setReady(true);
    }).catch(() => {
      if (!controller.signal.aborted && !finishedOnce.current) { setFallback(true); setReady(true); }
    });
    return () => { controller.abort(); renderer.current?.destroy(); renderer.current = null; };
  }, [replay, names, map, miss]);

  useEffect(() => {
    renderer.current?.show(frame, event, reduced, cue);
  }, [frame, event, reduced, cue]);

  const sounded = useRef(0);
  useEffect(() => {
    if (!ready || finishedOnce.current) return;
    if (complete) {
      if (event && sounded.current !== step) { sounded.current = step; sound(event); }
      return;
    }
    if (paused) return;
    let animation = 0, timer = 0, lastDraw = -Infinity;
    const length = cueDuration(cue);
    clock.setRate(performance.now(), speed);
    const pump = (now: number) => {
      const elapsed = Math.min(length, clock.update(now));
      // High-refresh displays still need only 60 canvas updates per second.
      if (now - lastDraw >= 1000 / 60 - .5 || elapsed >= length) {
        renderer.current?.draw(sceneTime(elapsed, cue)); lastDraw = now;
      }
      if (event && elapsed >= cue.contact && sounded.current !== step) { sounded.current = step; sound(event); }
      if (elapsed >= length) { clock.setRate(now, 0); setStep(s => s + 1); return; }
      // Calm effects have faded. Sleep until the next event instead of rendering a still canvas.
      if (reduced && elapsed >= 260) timer = window.setTimeout(() => pump(performance.now()), (length - elapsed) / speed);
      else animation = requestAnimationFrame(pump);
    };
    pump(performance.now());
    return () => { cancelAnimationFrame(animation); clearTimeout(timer); clock.setRate(performance.now(), 0); };
  }, [ready, complete, paused, speed, reduced, clock, cue, event, step]);

  const lines = replay.events.slice(0, step).map(e => describe(t, e, names)).filter((line): line is string => line !== null).slice(-3);
  const outcome = event?.type === 'end' ? event.outcome : replay.outcome;
  return createPortal(
    <div className={`fight-overlay ${paused ? 'fight-paused' : ''}`} ref={dialog} role="dialog" aria-modal="true" aria-label={t('fight.title')} data-fight-step={step} data-fight-ready={ready} data-fight-complete={complete} data-fight-paused={paused} style={{ '--fight-speed': speed } as CSSProperties}>
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
        {logOpen ? <div className="fight-history" id="playback-log" tabIndex={0} aria-label={t('report.fightLog')}>
          <FightLog replay={replay} until={step} />
        </div> : <div className="fight-log" aria-live="polite" aria-atomic="true">
          {lines.map((line, i) => <p key={`${step}-${i}`}>{line}</p>)}
        </div>}
        <div className="sr-only">
          {[replay.hero, ...replay.monsters].map(who => <p key={who.key}>{names[who.key]}: {frame.fighters[who.key]!.hp}/{who.maxHp}. {Object.keys(frame.fighters[who.key]!.statuses).map(status => t(`fight.status.${status as 'burning' | 'poisoned' | 'paralyzed' | 'frightened'}`, { name: names[who.key]! })).join(' ')}</p>)}
        </div>
        <div className="fight-actions">
          {!complete && <button type="button" className="btn" data-fight-speed aria-pressed={speed === 2} aria-label={t('fight.title') + ' · ' + speed + '×'} onClick={() => {
            const next = speed === 1 ? 2 : 1; setSpeed(next); saveSpeed(next);
          }}>{speed}×</button>}
          <button type="button" className="btn" data-fight-log aria-expanded={logOpen} aria-controls="playback-log" onClick={() => setLogOpen(value => !value)}>
            {logOpen ? t('close') : t('report.fightLog')}
          </button>
          <button ref={skip} type="button" className={`btn ${complete ? 'btn-primary' : ''}`} data-fight-skip onClick={finish}>
            {complete ? t('report.dismiss') : t('fight.skip')}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
