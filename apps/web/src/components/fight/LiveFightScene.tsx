import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeroActionView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { useNow } from '../../time';
import { roomArt } from '../../screens/labyrinth/roomArt';
import { FightLog } from '../../screens/labyrinth/FightLog';
import { Token, BOSS_RING, MONSTER_RING } from '../Token';
import { appendTimeline, asReplay, boardKey, startTimeline, type BoardFight } from './live';
import { tokenPlaces } from './layout';
import { dieFor } from './replay';
import { cueFor, cueDuration, Playhead, readSpeed, saveSpeed, sceneTime } from './choreography';
import { describe, displayNames, sound } from './presentation';
import { TurnChoices } from './TurnChoices';
import type { FightStage } from './stage';
import './fight.css';

interface Props {
  fight: BoardFight;
  at: { floor: number; room: number } | undefined;
  busy: boolean;
  onChoose: (action: HeroActionView) => void;
  onDone: () => void;
}
export function LiveFightScene(props: Props) {
  return <LiveBoard key={boardKey(props.fight)} {...props} />;
}

function LiveBoard({ fight, at, busy, onChoose, onDone }: Props) {
  const { t, locale } = useI18n();
  // Metadata never changes during one fight. Polls and the final replay only extend its events.
  const [base] = useState(() => asReplay(fight));
  const [timeline, setTimeline] = useState(() => startTimeline(fight));
  const [shown, setShown] = useState(0), [speed, setSpeed] = useState(readSpeed);
  const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false);
  const [logOpen, setLogOpen] = useState(false), [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const renderer = useRef<FightStage | null>(null), host = useRef<HTMLDivElement>(null);
  const done = useRef(onDone), finished = useRef(false), sounded = useRef(-1);
  done.current = onDone;
  useEffect(() => { setTimeline(previous => appendTimeline(previous, fight.events)); }, [fight.events]);
  const event = timeline.events[shown] ?? null;
  const frame = timeline.frames[shown + (event ? 1 : 0)]!;
  const caughtUp = !event && shown >= fight.events.length;
  const complete = caughtUp && fight.outcome !== null;
  const paused = hidden || logOpen;
  // A long backlog (for example after reconnecting) must not consume a Duo's whole choice deadline.
  const rate = speed * (timeline.events.length - shown > 8 ? 3 : 1);
  const names = useMemo(() => displayNames(base, value => value[locale]), [base, locale]);
  const map = useMemo(() => roomArt(base.map, at), [base.map, at?.floor, at?.room]);
  const cue = useMemo(() => cueFor(base, event, reduced), [base, event, reduced]);
  const clock = useMemo(() => new Playhead(), [shown, event]);
  const latest = useRef({ frame, event, cue, reduced }); latest.current = { frame, event, cue, reduced };
  const places = useMemo(() => tokenPlaces(base), [base]);
  const heroes = [base.hero, ...(base.ally ? [base.ally] : [])];
  const fighters = [...base.monsters, ...heroes];
  const replay = { ...base, events: timeline.events, outcome: fight.outcome ?? 'victory' as const };
  const die = dieFor(event), dramatic = event?.type === 'death-save' || event?.type === 'reroll';
  const myTurn = caughtUp && !complete && fight.mine && fight.turn !== null;
  const canChoose = ready && myTurn && !busy;
  const now = useNow(500);
  const seconds = fight.deadline ? Math.max(0, Math.ceil((Date.parse(fight.deadline) - now) / 1000)) : null;
  const status = complete ? t(`fight.${fight.outcome!}`) : !caughtUp ? t('live.watch')
    : myTurn ? t(fight.turn!.continuing ? 'live.again' : 'live.yours')
    : fight.auto && !base.ally ? t('live.onItsOwn') : t('live.theirs', { name: names.ally ?? names.hero! });

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches), visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const miss = t('fight.whiff');
  useEffect(() => {
    const controller = new AbortController(); setReady(false); setFallback(false);
    void import('./stage').then(module => module.createFightStage({ host: host.current!, replay: base, names, map, signal: controller.signal, miss }))
      .then(stage => {
        if (controller.signal.aborted) { stage.destroy(); return; }
        renderer.current = stage; const value = latest.current;
        stage.show(value.frame, value.event, value.reduced, value.cue); setReady(true);
      }).catch(() => { if (!controller.signal.aborted) { setFallback(true); setReady(true); } });
    return () => { controller.abort(); renderer.current?.destroy(); renderer.current = null; };
  }, [base, names, map, miss]);
  useEffect(() => { renderer.current?.show(frame, event, reduced, cue); }, [frame, event, reduced, cue]);
  useEffect(() => {
    if (!ready || paused || complete) return;
    if (!event && reduced) { renderer.current?.draw(0); return; }
    let animation = 0, timer = 0, lastDraw = -Infinity;
    const length = event ? cueDuration(cue) : Infinity;
    clock.setRate(performance.now(), event ? rate : 1);
    const pump = (now: number) => {
      const elapsed = Math.min(length, clock.update(now));
      if (now - lastDraw >= 1000 / (event ? 60 : 30) - .5 || elapsed >= length) {
        renderer.current?.draw(sceneTime(elapsed, cue)); lastDraw = now;
      }
      if (event && elapsed >= cue.contact && sounded.current !== shown) { sounded.current = shown; sound(event); }
      if (elapsed >= length) { clock.setRate(now, 0); setShown(value => value + 1); return; }
      if (event && reduced && elapsed >= 260) timer = window.setTimeout(() => pump(performance.now()), (length - elapsed) / rate);
      else animation = requestAnimationFrame(pump);
    };
    pump(performance.now());
    return () => { cancelAnimationFrame(animation); clearTimeout(timer); clock.setRate(performance.now(), 0); };
  }, [ready, paused, complete, event, clock, cue, reduced, shown, rate]);
  useEffect(() => {
    if (!complete || paused || finished.current) return;
    const timer = setTimeout(() => { if (!finished.current) { finished.current = true; done.current(); } }, 1100);
    return () => clearTimeout(timer);
  }, [complete, paused]);

  const logUntil = shown + (event ? 1 : 0);
  const lastLine = event ? describe(t, event, names) : shown ? describe(t, timeline.events[shown - 1]!, names) : null;
  return <div className={`live-fight ${paused ? 'fight-paused' : ''}`} data-live-shown={shown} data-live-total={timeline.events.length}
    data-live-ready={ready} data-live-caught-up={caughtUp} data-live-complete={complete} style={{ '--fight-speed': speed } as React.CSSProperties}>
    <TurnChoices fight={fight} busy={busy} ready={canChoose} names={names} onChoose={onChoose}>
      {(tapMonster, marking, mark) => <>
        <header className="live-heading">
          <strong role="status">{status}</strong>
          <span>{fight.turn && !complete && t('live.round', { n: fight.turn.round })}
            {seconds !== null && !complete && <b className={seconds <= 10 ? 'turn-urgent' : ''}> · {t('live.seconds', { n: seconds })}</b>}</span>
        </header>
        <div className={`fight-board ${base.ally ? 'fight-duo' : ''}`}>
          <div ref={host} className="fight-canvas" />
          {!ready && <div className="fight-loading">{t('loading')}</div>}
          {fallback && <div className="live-fallback"><img {...map} alt="" />{fighters.map(who => {
            const place = places[who.key]!, state = frame.fighters[who.key]!;
            return <div key={who.key} style={{ left: `${place.x / 6}%`, top: `${place.y / 6}%`, opacity: state.fled ? 0 : 1 }}>
              <Token art={who.art} label={names[who.key]!} ring={who.banner ?? (who.boss ? BOSS_RING : MONSTER_RING)} size={who.key === 'hero' ? 58 : 48} fallen={state.fallen} />
              <span>{names[who.key]} · {state.hp}/{who.maxHp}</span>
            </div>;
          })}</div>}
          {canChoose && base.monsters.map(who => {
            const place = places[who.key]!, state = frame.fighters[who.key]!;
            if (!fight.turn!.targets.includes(who.key) || state.fallen || state.fled || (!marking && !fight.turn!.actions.includes('attack'))) return null;
            const width = Math.max(90, place.diameter + 26);
            return <button key={who.key} type="button" className={`turn-target ${mark === who.key ? 'turn-marked' : ''}`} data-target={who.key}
              style={{ left: `${place.x / 6}%`, top: `${place.y / 6}%`, width: `${width / 6}%`, height: `${width / 6}%` }}
              aria-label={`${t(marking ? 'live.mark' : 'live.act.attack')}: ${names[who.key]}, ${state.hp}/${who.maxHp}`} onClick={() => tapMonster(who.key)} />;
          })}
          {canChoose && (marking || fight.turn!.actions.includes('attack')) && <p className="turn-prompt">{t(marking ? 'live.marking' : 'live.tapMonster')}</p>}
          {die !== null && <div key={shown} className={`fight-die ${dramatic ? 'fight-die-large' : ''} ${reduced ? '' : 'fight-die-motion'}`} role="img" aria-label={`d20: ${die}`}>
            <svg viewBox="0 0 100 110" aria-hidden="true"><path d="M50 3 96 28 96 80 50 107 4 80 4 28Z" /></svg><strong>{die}</strong>
            {dramatic && <span className="fight-die-label">{t('fight.deathSaveTitle')}<b>{names[cue.actor ?? 'hero']}</b></span>}
          </div>}
          {heroes.some(who => frame.fighters[who.key]!.saves) && <div className="fight-saves">{heroes.map(who => {
            const saves = frame.fighters[who.key]!.saves;
            return saves && <div className="fight-save-counter" key={who.key} data-saves-for={who.key} aria-label={`${names[who.key]} · ${t('fight.saveCount', { s: saves.successes, f: saves.failures })}`}>
              {base.ally && <b>{names[who.key]}</b>}<span className="fight-save-success">{'●'.repeat(saves.successes)}{'○'.repeat(3 - saves.successes)}</span>
              <span className="fight-save-failure">{'●'.repeat(saves.failures)}{'○'.repeat(3 - saves.failures)}</span>
            </div>;
          })}</div>}
          {complete && <div className={`fight-outcome fight-outcome-${fight.outcome}`}>{status}</div>}
        </div>
        <div className="live-controls">
          <button type="button" className="btn btn-small" data-live-speed aria-pressed={speed === 2} onClick={() => { const next = speed === 1 ? 2 : 1; setSpeed(next); saveSpeed(next); }}>{speed}×</button>
          <button type="button" className="btn btn-small" data-live-log aria-expanded={logOpen} onClick={() => setLogOpen(value => !value)}>{logOpen ? t('close') : t('report.fightLog')}</button>
        </div>
        {logOpen ? <div className="fight-history" tabIndex={0}><FightLog replay={replay} until={logUntil} ongoing={!complete} /></div>
          : <p className="live-caption" aria-live="polite">{lastLine ?? status}</p>}
        <div className="sr-only">{fighters.map(who => <p key={who.key}>{names[who.key]}: {frame.fighters[who.key]!.hp}/{who.maxHp}. {Object.keys(frame.fighters[who.key]!.statuses).map(status => t(`fight.status.${status as 'burning'}`, { name: names[who.key]! })).join(' ')}</p>)}</div>
      </>}
    </TurnChoices>
  </div>;
}
