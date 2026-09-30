import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  STANCES, TIERS, type CheckView, type Direction, type DuoPartner, type Exit, type Facing, type FeatureView, type KitItemView, type LabyrinthResult,
  type LabyrinthView, type RunSummary,
} from '@dark/shared';
import { api, ApiRequestError } from '../../api';
import { CenterModal } from '../../components/CenterModal';
import { Guide } from '../../components/Guide';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { useLoad, useRefresh } from '../../components/useLoad';
import { DuoCard } from '../../components/DuoCard';
import { OmenNote } from '../../components/OmenNote';
import { useSheet } from '../../components/Sheet';
import { BOSS_RING, MONSTER_RING, Token } from '../../components/Token';
import { describeError } from '../../errors';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { play, playTier } from '../../sound';
import { formatClock, formatDuration, useAt, useNow } from '../../time';
import { Belt, BeltIcon, type BeltPick } from './Belt';
import { EventPanel } from './EventPanel';
import { EliteBadge } from '../../components/EliteBadge';
import { THREAT_TONE, ThreatChip } from '../../components/ThreatChip';
import { FightScene, preloadFightScene } from '../../components/fight/FightScene';
import { FightLog } from './FightLog';
import { FloorMap } from './FloorMap';
import { FirstSteps } from '../../components/FirstSteps';
import { MiniMap } from '../../components/map/MiniMap';
import { roomArt } from './roomArt';
import { TierBurst } from '../../components/loot/TierBurst';

type Act = (call: () => Promise<LabyrinthResult>) => Promise<void>;

/**
 * The Labyrinth tab: the gate while the Hero is in the City, otherwise the Room
 * it stands in, its Doors, and the Hero's Map of the Floor.
 */
export function Labyrinth() {
  const { t } = useI18n();
  const [view, setView] = useState<LabyrinthView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'noHero' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A result whose fight is being played back; its view shows once the fight is over. */
  const [playing, setPlaying] = useState<LabyrinthResult | null>(null);
  const [report, setReport] = useState<LabyrinthResult | null>(null);

  useEffect(() => { void preloadFightScene().catch(() => { /* Playback can retry or show its fallback. */ }); }, []);

  /** Where the Hero stands, to hear a Duo partner lead it on. */
  const place = useRef<string | null>(null);
  /**
   * Shows a result: a fight plays first. A Duo fight shows as its log in the report
   * until the fight scene draws a partner (docs/tasks/codex-16-duo-fight.md). News
   * that comes while a report is open joins it rather than hiding it.
   */
  const present = useCallback((result: LabyrinthResult, polled = false) => {
    const at = result.view.floor && result.view.room ? `${result.view.floor.number}:${result.view.room.id}` : null;
    if (polled && place.current !== null && at !== place.current) play('door', { rate: 0.9 });
    place.current = at;
    if (result.fight && !result.fight.ally) {
      setPlaying(result);
      return;
    }
    setView(result.view);
    if (hasNews(result)) setReport((open) => (open ? joinReports(open, result) : result));
  }, []);

  const load = useCallback(async (polled = false) => {
    try {
      present(await api.labyrinth(), polled);
      setStatus('ready');
    } catch (e) {
      setStatus(e instanceof ApiRequestError && e.body?.error === 'no_hero' ? 'noHero' : 'failed');
    }
  }, [present]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stamina ticks back and Camps finish resting on the server's clock: look again then.
  const refresh = () => {
    if (!busy && !playing) void load();
  };
  useAt(view?.hero.staminaNextAt, refresh);
  useAt(view?.room?.restedAt, refresh);
  // In a Duo either Player can lead, so look every few seconds for what the other did.
  const inDuo = view?.duo != null;
  const poll = useCallback(async () => {
    if (inDuo && !busy && !playing) await load(true);
  }, [inDuo, busy, playing, load]);
  useRefresh(poll, 4_000);

  const act: Act = async (call) => {
    setBusy(true);
    setError(null);
    try {
      const result = await call();
      setReport(null);
      present(result);
    } catch (e) {
      setError(describeError(t, e));
      void load();
    } finally {
      setBusy(false);
    }
  };

  const fightOver = () => {
    if (!playing) return;
    setView(playing.view);
    setReport(playing);
    setPlaying(null);
  };

  if (status === 'loading') return <p className="text-center text-muted">{t('loading')}</p>;
  if (status === 'noHero') {
    return (
      <div className="panel grid gap-3 p-4 text-center">
        <p className="m-0">{t('lab.noHero')}</p>
        <NavLink to="/heroes" className="btn btn-primary no-underline">{t('lab.createHero')}</NavLink>
      </div>
    );
  }
  if (status === 'failed' || !view) {
    return (
      <div className="panel grid gap-3 p-4 text-center">
        <p className="m-0">{t('error')}</p>
        <button type="button" className="btn" onClick={() => void load()}>{t('retry')}</button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {report && <Report result={report} onClose={() => setReport(null)} />}
      {view.location === 'city' ? (
        <Gate view={view} busy={busy} error={error} act={act} onDuo={() => void load()} />
      ) : (
        <Inside view={view} busy={busy} error={error} act={act} />
      )}
      {playing?.fight && (
        <FightScene
          replay={playing.fight}
          room={view?.floor && view.room ? { floor: view.floor.number, room: view.room.id } : undefined}
          onDone={fightOver}
        />
      )}
    </div>
  );
}

const hasNews = (r: LabyrinthResult) =>
  r.fight !== null || r.loot.length > 0 || r.gold > 0 || r.xp > 0 || r.levelUp !== null || r.died || r.notices.length > 0
  || r.checks.length > 0 || r.duel !== null || r.run !== null || r.deeds.length > 0;

/** Two results in one report, the newer's fight and view winning. */
const joinReports = (a: LabyrinthResult, b: LabyrinthResult): LabyrinthResult => ({
  view: b.view,
  fight: b.fight ?? a.fight,
  loot: [...a.loot, ...b.loot],
  gold: a.gold + b.gold,
  xp: a.xp + b.xp,
  levelUp: b.levelUp ?? a.levelUp,
  died: a.died || b.died,
  notices: [...a.notices, ...b.notices],
  checks: [...a.checks, ...b.checks],
  duel: b.duel ?? a.duel,
  run: b.run ?? a.run,
  deeds: [...a.deeds, ...b.deeds],
});

/** Drinks one Healing potion from the Bag, then shows the Labyrinth again. */
async function drinkPotion(): Promise<LabyrinthResult> {
  const me = await api.myHero();
  const potion = me.hero?.bag.find((i) => i.base === 'potion');
  if (potion) await api.drink(potion.id);
  return api.labyrinth();
}

/**
 * In the City: the Labyrinth's gate as a stage like the Rooms below, with the Hero's
 * status and belt, and under it the way down: the gate, a Waypoint already woken,
 * or an open Town Portal.
 */
function Gate({ view, busy, error, act, onDuo }: { view: LabyrinthView; busy: boolean; error: string | null; act: Act; onDuo: () => void }) {
  const { t, locale } = useI18n();
  const [popup, setPopup] = useState<Popup | null>(null);
  const duo = view.duo;
  // A Duo enters where both can: Floor 1, or a Waypoint both Heroes have woken.
  const woken = view.waypoints.filter((n) => n !== 1).sort((a, b) => a - b);
  const floors = [1, ...woken.filter((n) => !duo || duo.waypoints.includes(n))];
  const shut = view.season.status === 'planned';
  const hero = view.hero;
  const enter = (floor: number, portal = false) => {
    play('door', { rate: portal ? 1.2 : 0.8 });
    void act(() => api.enterLabyrinth(floor, portal));
  };
  return (
    <>
      <Stage art={{ src: GATE_ART, style: undefined }} dim="brightness-[0.42]" view={view} onPopup={setPopup}>
        <div className="absolute inset-x-0 top-[48%] grid -translate-y-1/2 justify-items-center gap-2.5 px-6 text-center">
          <Pair view={view} size={86} />
          <h1 className="m-0 font-head text-[28px] leading-tight font-extrabold [text-shadow:0_2px_8px_#000]">{t('lab.gate.title')}</h1>
          <p className="m-0 max-w-[32ch] text-sm text-bone/85 [text-shadow:0_1px_4px_#000]">{t('lab.gate.body')}</p>
        </div>
      </Stage>

      <div className="grid gap-1 px-1 text-sm text-muted">
        {view.bestFloor > 0 && <span>{t('lab.bestFloor', { n: view.bestFloor })}</span>}
        {shut && <span className="font-bold text-[#ff9a8a]">{t('lab.notStarted')}</span>}
      </div>
      {view.season.omen && <OmenNote omen={view.season.omen} />}

      {duo && <DuoStrip partner={duo} busy={busy} act={act} />}
      <section className="grid gap-2">
        {view.portal && !duo && (
          <div className="grid gap-1">
            <button type="button" className="btn btn-primary" disabled={busy || shut} onClick={() => enter(view.portal!.floor, true)}>
              {t('lab.portalBack', { n: view.portal.floor })}
            </button>
            <span className="justify-self-center text-xs text-muted">{t('lab.portalCloses', { time: formatClock(locale, view.portal.closesAt) })}</span>
          </div>
        )}
        {floors.map((n) => (
          <button key={n} type="button" className={`btn ${n === 1 && (!view.portal || duo) ? 'btn-primary' : ''}`} disabled={busy || shut} onClick={() => enter(n)}>
            {duo ? (n === 1 ? t('duo.enter') : t('duo.enterWaypoint', { n })) : n === 1 ? t('lab.enter') : t('lab.enterWaypoint', { n })}
          </button>
        ))}
        {duo && floors.length <= woken.length && <span className="px-1 text-xs text-muted">{t('duo.shared')}</span>}
        {duo && view.portal && <span className="px-1 text-xs text-muted">{t('err.duo_portal')}</span>}
      </section>
      {error && <p className="m-0 px-1 text-sm text-tier-mythic">{error}</p>}
      {!duo && <DuoCard onChange={onDuo} />}
      {view.bestFloor === 0 && <FirstRunTips />}
      <FirstSteps />

      {popup && popup !== 'map' && <BeltPopup popup={popup} view={view} busy={busy} act={act} onClose={() => setPopup(null)} />}
    </>
  );
}

/** Three things to know before a first Run, with the whole guide a tap away. */
function FirstRunTips() {
  const { t } = useI18n();
  const { openSheet } = useSheet();
  return (
    <section className="panel grid gap-2 p-3.5">
      <span className="sub-heading">{t('lab.firstTips.title')}</span>
      <ul className="m-0 grid gap-1.5 pl-4 text-sm">
        <li>{t('lab.firstTips.doors')}</li>
        <li>{t('lab.firstTips.monsters')}</li>
        <li>{t('lab.firstTips.gold')}</li>
      </ul>
      <button type="button" className="btn btn-small justify-self-start" onClick={() => openSheet({ title: t('guide.title'), body: <Guide /> })}>
        {t('lab.firstTips.guide')}
      </button>
    </section>
  );
}

/** The gate has no map of its own yet: the first Floor's warrens stand in, dimmed. */
const GATE_ART = '/art/rooms/goblins-1.webp';

const DIRECTION_ORDER: Direction[] = ['n', 'e', 's', 'w'];

type Popup = 'map' | 'bag' | BeltPick;

/**
 * Inside the Labyrinth, layout B: the Room edge to edge as a stage, the Hero's
 * status with the Map and Bag buttons over its top, the belt along its bottom,
 * and where to go next below it. Anything that needs the Player (monsters in
 * the doorway, an event, the Map, the belt's details) comes up in the middle.
 */
function Inside({ view, busy, error, act }: { view: LabyrinthView; busy: boolean; error: string | null; act: Act }) {
  const { t, locale } = useI18n();
  const now = useNow();
  const floor = view.floor!;
  const room = view.room!;
  const exits = [...view.exits].sort((a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction));
  const [popup, setPopup] = useState<Popup | null>(null);
  // Monsters and a waiting event come up by themselves, and "look around first" puts
  // them aside; a finished event opens again only when asked.
  const [aside, setAside] = useState(false);
  const [peek, setPeek] = useState(false);
  /** The monster whose card is open, by its key. */
  const [foe, setFoe] = useState<string | null>(null);
  const facing = room.facing;
  const event = room.eventView;
  const eventOpen = event !== null && !event.done;
  useEffect(() => {
    setAside(false);
    setPeek(false);
    setFoe(null);
  }, [floor.number, room.id, facing !== null, eventOpen]);
  // A new Room: back up to the stage, since the Door was often tapped below it.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [floor.number, room.id]);
  const facingCard = facing !== null && !aside;
  const eventCard = !facing && event !== null && (eventOpen ? !aside : peek);

  /** The Door the Player chose while a Camp's rest was under way, waiting for a yes. */
  const [leaving, setLeaving] = useState<number | null>(null);
  const hero = view.hero;
  const resting = room.type === 'camp' && room.restedAt !== null && new Date(room.restedAt).getTime() > now
    && (hero.hp < hero.maxHp || hero.stamina < hero.staminaMax || hero.shortRests.left < hero.shortRests.of);
  const go = (to: number) => {
    setPopup(null);
    setLeaving(null);
    play(exits.find((e) => e.to === to)?.kind === 'open' ? 'door' : 'creak');
    void act(() => api.moveTo(to));
  };
  const move = (to: number) => {
    if (resting) {
      setPopup(null);
      setLeaving(to);
      return;
    }
    go(to);
  };
  const walk = (call: () => Promise<LabyrinthResult>) => {
    play('step');
    play('step', { delay: 260 });
    void act(call);
  };
  const canLeave = (floor.number === 1 && room.type === 'landing') || (room.type === 'waypoint' && view.waypoints.includes(floor.number));
  const canAscend = floor.number > 1 && room.type === 'landing';
  const label = floor.number === 1 && room.type === 'landing' ? t('room.entrance') : t(`room.${room.type}`);

  return (
    <>
      <Stage art={roomArt(room.map, { floor: floor.number, room: room.id })} view={view} onPopup={setPopup}>
        {facing ? (
          <FacingTokens facing={facing} view={view} onFoe={setFoe} />
        ) : (
          <>
            <div className="absolute inset-0 grid place-items-center">
              <Pair view={view} size={86} />
            </div>
            {exits.map((exit) => (
              <DoorMarker key={exit.to} exit={exit} disabled={busy} onMove={move} />
            ))}
          </>
        )}
        <div className="absolute top-[70px] left-3 grid max-w-[40%] rounded-[2px] border border-[#4a3a26] bg-[rgb(22_18_14/0.88)] px-2.5 py-1 leading-tight">
          <span className="font-head text-[13px] font-bold text-bone">{label}</span>
          {room.cleared && room.type !== 'empty' && <span className="text-[11px] text-muted">{t('room.cleared')}</span>}
        </div>
        {facing && (
          <div className="absolute top-[70px] right-3">
            <ThreatChip threat={facing.threat[hero.stance]} />
          </div>
        )}
        {/* The corner above the belt: clear of every Door arrow, the monsters and the Hero. */}
        {view.map && (
          <div className="absolute right-3 bottom-[66px]">
            <MiniMap key={floor.number} map={view.map} current={room.id} banner={hero.banner} exits={exits} onOpen={() => setPopup('map')} />
          </div>
        )}
      </Stage>

      {view.duo && <DuoStrip partner={view.duo} busy={busy} act={act} />}
      <div className="grid gap-1 px-1 text-sm text-muted">
        <span className="flex flex-wrap gap-1.5">
          <span className="chip">{hero.xpNext === null ? t('lab.xpMax', { n: hero.xp }) : t('lab.xp', { n: hero.xp, m: hero.xpNext })}</span>
          {hero.carriedGold > 0 && <span className="chip text-[#f1c75b]">{t('lab.carried', { n: hero.carriedGold })}</span>}
        </span>
        {hero.staminaNextAt && <span>{t('hero.stamina')} {hero.stamina}/{hero.staminaMax} · {t('lab.staminaNext', { time: formatDuration(t, new Date(hero.staminaNextAt).getTime() - now) })}</span>}
        {hero.hp < hero.maxHp && room.type !== 'camp' && <span>{t('lab.recovering')}</span>}
        {room.restedAt && <span>{t('lab.restedAt', { time: formatClock(locale, room.restedAt) })}</span>}
        {room.vault && (
          <span className="text-gold">
            {room.vault.state === 'sealed' && room.vault.opensAt
              ? t('lab.vault.sealed', { time: formatClock(locale, room.vault.opensAt) })
              : t(`lab.vault.${room.vault.state}`)}
          </span>
        )}
      </div>
      {view.season.omen && <OmenNote omen={view.season.omen} />}
      {error && <p className="m-0 px-1 text-sm text-tier-mythic">{error}</p>}

      {facing && aside && (
        <button type="button" className="btn btn-primary" onClick={() => setAside(false)}>{t('lab.decide')}</button>
      )}
      {!facing && event && !eventCard && (
        <button
          type="button"
          className={`btn grid gap-0.5 ${eventOpen ? 'btn-primary' : ''}`}
          onClick={() => (eventOpen ? setAside(false) : setPeek(true))}
        >
          <span>{t(`event.${event.kind}` as MessageKey)}</span>
          <span className="text-xs font-normal opacity-80">{eventOpen ? t('lab.eventWaiting') : t('event.done')}</span>
        </button>
      )}

      {facing ? (
        <p className="m-0 px-1 text-sm text-muted">{t('facing.blocked')}</p>
      ) : (
        <section className="grid gap-2">
          <span className="sub-heading">{t('lab.whereNext')}</span>
          {exits.map((exit) => (
            <ExitButton key={exit.to} exit={exit} disabled={busy} onMove={move} />
          ))}
        </section>
      )}

      {(room.type === 'stairs' || canAscend || canLeave) && (
        <section className="grid gap-2">
          {room.type === 'stairs' && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => walk(api.descend)}>
              {t('lab.descend')}
            </button>
          )}
          {canAscend && (
            <button type="button" className="btn" disabled={busy} onClick={() => walk(api.ascend)}>
              {t('lab.ascend')}
            </button>
          )}
          {canLeave && (
            <button type="button" className="btn" disabled={busy} onClick={() => walk(api.leaveLabyrinth)}>
              {t('lab.leave')}
            </button>
          )}
        </section>
      )}

      {view.graves.length > 0 && <Graves view={view} busy={busy} act={act} />}

      {facingCard && <FacingCard facing={facing} view={view} busy={busy} act={act} onAside={() => setAside(true)} onFoe={setFoe} />}
      {facing && foe && <FoeCard facing={facing} monsterKey={foe} onClose={() => setFoe(null)} />}
      {eventCard && (
        <CenterModal
          label={t(`event.${event.kind}` as MessageKey)}
          head={<span className="sub-heading">{t(`event.${event.kind}` as MessageKey)}</span>}
          onClose={() => (eventOpen ? setAside(true) : setPeek(false))}
          closeLabel={eventOpen ? t('lab.lookAround') : t('close')}
          width={420}
        >
          <EventPanel event={event} view={view} busy={busy} act={act} />
        </CenterModal>
      )}
      {popup === 'map' && (
        <CenterModal
          label={t('lab.map', { n: floor.number })}
          head={<span className="sub-heading">{t('lab.map', { n: floor.number })}</span>}
          onClose={() => setPopup(null)}
          width={520}
        >
          <FloorMap
            width={floor.width}
            height={floor.height}
            map={view.map!}
            current={room.id}
            banner={hero.banner}
            exits={exits}
            disabled={busy || facing !== null}
            onMove={move}
          />
        </CenterModal>
      )}
      {popup && popup !== 'map' && <BeltPopup popup={popup} view={view} busy={busy} act={act} onClose={() => setPopup(null)} />}
      {leaving !== null && room.restedAt && (
        <CenterModal label={t('camp.leave.title')} onClose={() => setLeaving(null)} head={<span className="sub-heading">{t('camp.leave.title')}</span>}>
          <p className="m-0 text-[15px] leading-snug">
            {t('camp.leave.body', {
              time: formatClock(locale, room.restedAt),
              left: formatDuration(t, new Date(room.restedAt).getTime() - now),
            })}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setLeaving(null)}>{t('camp.leave.stay')}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => go(leaving)}>{t('camp.leave.go')}</button>
        </CenterModal>
      )}
    </>
  );
}

/** The Hero over the top of the Room: portrait, level and Floor, health and Stamina, and the Map and Bag. */
function HudStrip({ view, onPopup }: { view: LabyrinthView; onPopup: (popup: Popup) => void }) {
  const { t } = useI18n();
  const hero = view.hero;
  const ready = hero.xpNext !== null && hero.xp >= hero.xpNext;
  // An icon instead of the word keeps both bars on one line in either language.
  const bar = (value: number, max: number, color: string, label: string, icon: string) => (
    <div className="grid gap-0.5" title={`${label} ${value}/${max}`} aria-label={`${label} ${value}/${max}`} role="img">
      <div className="flex items-center gap-1 text-[11px] leading-none text-bone">
        <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill={color} aria-hidden="true"><path d={icon} /></svg>
        {value}/{max}
      </div>
      <div className="h-[5px] border border-black bg-[#2a211a]"><div className="h-full" style={{ width: `${Math.round((value / max) * 100)}%`, background: color }} /></div>
    </div>
  );
  const round = 'grid size-11 shrink-0 place-items-center rounded-full border border-brass bg-[rgb(21_18_15/0.88)] p-0 text-gold shadow-[0_0_0_1px_#000] no-underline';
  return (
    <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 border-b border-brass-dim/70 bg-[rgb(11_10_9/0.8)] px-3 py-2">
      <Token art={hero.portraitUrl} label={hero.name} ring={hero.banner} size={44} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-head text-[17px] leading-tight font-extrabold">{hero.name}</span>
          <span className="truncate text-xs text-muted">
            {view.floor ? t('lab.hud', { level: hero.level, floor: view.floor.number }) : t('lab.hudCity', { level: hero.level })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {bar(hero.hp, hero.maxHp, '#c23030', t('hero.health'), 'M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z')}
          {bar(hero.stamina, hero.staminaMax, '#c9a96a', t('hero.stamina'), 'M8 2c2.2 0 3.5 2.4 3.5 5.5S10.2 13 8 13 4.5 10.6 4.5 7.5 5.8 2 8 2zM5.5 15h5v2.5a2.5 2.5 0 0 1-5 0V15zM16 6c2.2 0 3.5 2.4 3.5 5.5S18.2 17 16 17s-3.5-2.4-3.5-5.5S13.8 6 16 6zM13.5 19h5v.5a2.5 2.5 0 0 1-5 0V19z')}
        </div>
      </div>
      {ready && (
        <NavLink to="/heroes" aria-label={t('lab.levelUp')} title={t('lab.levelUp')} className={`${round} border-gold font-head text-lg shadow-[0_0_12px_rgb(224_184_106/0.5)]`}>✦</NavLink>
      )}
      {view.floor && (
        <button type="button" aria-label={t('lab.mapButton')} title={t('lab.mapButton')} className={round} onClick={() => onPopup('map')}>
          <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
          </svg>
        </button>
      )}
      <button type="button" aria-label={t('lab.bagButton')} title={t('lab.bagButton')} className={round} onClick={() => onPopup('bag')}>
        <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The stage: a map edge to edge under the Hero's status strip and above the belt,
 * inside the Labyrinth and at its gate alike.
 */
function Stage({ art, dim = 'brightness-[0.78]', view, onPopup, children }: {
  art: { src: string; style: CSSProperties | undefined };
  dim?: string;
  view: LabyrinthView;
  onPopup: (popup: Popup) => void;
  children: ReactNode;
}) {
  return (
    <section className="relative -mx-4 -mt-3 aspect-[390/470] max-h-[calc(100dvh_-_var(--nav-h)_-_120px)] min-h-[400px] overflow-hidden bg-black [container-type:size]">
      {/* Maps are square and turn, so the map is a square as wide as the stage's longer side. */}
      <img {...art} alt="" className={`absolute top-1/2 left-1/2 size-[max(100cqw,100cqh)] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover ${dim}`} draggable={false} />
      {children}
      <HudStrip view={view} onPopup={onPopup} />
      <Belt hero={view.hero} onPick={onPopup} />
    </section>
  );
}

/** Whatever the status strip or the belt opened, but the Map: the Bag, a feature, a Bag item, the short rests. */
function BeltPopup({ popup, view, busy, act, onClose }: { popup: Exclude<Popup, 'map'>; view: LabyrinthView; busy: boolean; act: Act; onClose: () => void }) {
  if (popup === 'bag') return <BagCard onClose={onClose} />;
  if ('feature' in popup) return <FeatureCard pick={popup.feature} onClose={onClose} />;
  if ('kit' in popup) return <KitCard pick={popup.kit} view={view} busy={busy} onClose={onClose} act={act} />;
  return <RestCard view={view} busy={busy} act={act} onClose={onClose} />;
}

/** A class feature from the belt: what it does now, its uses, and what it becomes (D2). */
function FeatureCard({ pick, onClose }: { pick: FeatureView; onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <CenterModal
      label={text(pick.name)}
      onClose={onClose}
      head={
        <div className="flex items-center gap-3">
          <span className={`grid size-14 shrink-0 place-items-center rounded-[2px] border bg-[#241c12] ${pick.kind === 'locked' ? 'border-line text-brass-dim' : 'border-gold text-gold'}`}>
            <BeltIcon name={pick.icon} className="size-8" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-head text-[22px] leading-tight font-extrabold">{text(pick.name)}</span>
            <span className="text-sm text-muted">{pick.uses ? t('belt.kind.rest', { left: pick.uses.left, of: pick.uses.of }) : t(`belt.kind.${pick.kind}`)}</span>
          </div>
        </div>
      }
    >
      <p className="m-0 text-[15px] leading-snug">{text(pick.now)}</p>
      {pick.next && <p className="m-0 text-sm text-muted"><span className="text-bone">{t('belt.later')}</span> {text(pick.next)}</p>}
      {pick.kind === 'rest' && <p className="m-0 text-sm text-muted">{t('belt.rest')}</p>}
      <button type="button" className="btn" onClick={onClose}>{t('close')}</button>
    </CenterModal>
  );
}

/** A Bag item on the belt: what it does, how many, and its use when it has one here. */
function KitCard({ pick, view, busy, act, onClose }: { pick: KitItemView; view: LabyrinthView; busy: boolean; act: Act; onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const hurt = view.hero.hp < view.hero.maxHp;
  return (
    <CenterModal
      label={text(pick.name)}
      onClose={onClose}
      head={
        <div className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-[2px] border border-gold bg-[#241c12] text-gold">
            <BeltIcon name={pick.base} className="size-8" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-head text-[22px] leading-tight font-extrabold">{text(pick.name)}</span>
            <span className="text-sm text-muted">{t('belt.count', { n: pick.count })}</span>
          </div>
        </div>
      }
    >
      <p className="m-0 text-[15px] leading-snug">{text(pick.about)}</p>
      {pick.base === 'potion' && (
        <button type="button" className="btn btn-primary" disabled={busy || !hurt} onClick={() => { onClose(); void act(drinkPotion); }}>
          {hurt ? t('belt.drink') : t('belt.fullHealth')}
        </button>
      )}
      {pick.base === 'scroll-portal' && view.location === 'labyrinth' && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { onClose(); play('page'); void act(api.readPortal); }}>
          {t('belt.read')}
        </button>
      )}
      {(pick.base === 'bomb-fire' || pick.base === 'bomb-smoke') && <p className="m-0 text-sm text-muted">{t('belt.bomb')}</p>}
      <button type="button" className="btn" onClick={onClose}>{t('close')}</button>
    </CenterModal>
  );
}

/** Everything in the Bag, one tap from anywhere in the Labyrinth. */
function BagCard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  const { data } = useLoad(api.myHero);
  const hero = data?.hero;
  return (
    <CenterModal
      label={t('lab.bagButton')}
      head={<span className="sub-heading">{hero ? t('hero.bag', { n: hero.bag.length, m: hero.bagSlots }) : t('lab.bagButton')}</span>}
      onClose={onClose}
      width={440}
    >
      {!hero ? (
        <p className="m-0 text-muted">{t('loading')}</p>
      ) : hero.bag.length === 0 ? (
        <p className="m-0 text-muted">{t('lab.bagEmpty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-2">
          {hero.bag.map((item) => (
            <ItemChip key={item.id} item={item} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} />
          ))}
        </div>
      )}
    </CenterModal>
  );
}

/** The Hero's token, and in a Duo its partner's beside it, a little smaller. */
function Pair({ view, size }: { view: LabyrinthView; size: number }) {
  const hero = view.hero;
  const partner = view.duo;
  return (
    <span className="flex items-end justify-center gap-2">
      <Token art={hero.portraitUrl} label={hero.name} ring={hero.banner} size={size} />
      {partner && (
        <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={Math.round(size * 0.78)} className={partner.online ? '' : 'opacity-60'} />
      )}
    </span>
  );
}

/** The Duo partner: its health and Stamina, whether its Player is here, and leaving the Duo. */
function DuoStrip({ partner, busy, act }: { partner: DuoPartner; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const leave = () => void act(async () => {
    await api.duoLeave();
    return api.labyrinth();
  });
  return (
    <section className="grid gap-1.5 rounded-[2px] border border-line bg-[rgb(22_18_14/0.7)] p-2">
      <div className="flex items-center gap-2.5">
        <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={36} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-head font-bold">{t('duo.with', { name: partner.name })}</span>
            <span className={`shrink-0 text-xs ${partner.online ? 'text-tier-uncommon' : 'text-[#ff9a8a]'}`}>{partner.online ? t('duo.online') : t('duo.away')}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] leading-none text-muted tabular-nums">
            <div className="h-[5px] flex-1 border border-black bg-[#2a211a]">
              <div className="h-full bg-[#c23030]" style={{ width: `${Math.round((partner.hp / Math.max(1, partner.maxHp)) * 100)}%` }} />
            </div>
            <span>{partner.hp}/{partner.maxHp}</span>
            <span>· {t('hero.stamina')} {partner.stamina}</span>
          </div>
        </div>
        <button type="button" className="btn btn-small shrink-0" disabled={busy} onClick={leave}>{t('duo.leave')}</button>
      </div>
      {!partner.online && <p className="m-0 text-sm text-[#ff9a8a]">{t('duo.awayNote', { name: partner.name })}</p>}
    </section>
  );
}

/** The monsters in the doorway above, the Hero below, as in the fight that may follow. */
function FacingTokens({ facing, view, onFoe }: { facing: Facing; view: LabyrinthView; onFoe: (key: string) => void }) {
  const text = useText();
  const size = facing.monsters.length <= 2 ? 78 : 62;
  return (
    <>
      <div className="absolute inset-x-3 top-[116px] flex flex-wrap justify-center gap-3">
        {facing.monsters.map((m) => (
          <button
            key={m.key}
            type="button"
            className="grid justify-items-center gap-1 border-0 bg-transparent p-0 active:scale-95"
            style={{ width: Math.max(size, 72) }}
            onClick={() => onFoe(m.key)}
          >
            <Token art={m.art} label={text(m.name)} ring={m.boss ? BOSS_RING : MONSTER_RING} size={m.boss && facing.monsters.length === 1 ? 118 : size} />
            <span className="max-w-full truncate rounded-[2px] bg-black/65 px-1.5 font-head text-xs font-bold text-bone">{text(m.name)}</span>
            {m.elite && <EliteBadge elite={m.elite} />}
          </button>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[66px] flex justify-center">
        <Pair view={view} size={78} />
      </div>
    </>
  );
}

/** Monsters in the doorway: the Threat, the Stance, and Fight, Sneak past or Retreat. */
function FacingCard({ facing, view, busy, act, onAside, onFoe }: {
  facing: Facing; view: LabyrinthView; busy: boolean; act: Act; onAside: () => void; onFoe: (key: string) => void;
}) {
  const { t } = useI18n();
  const text = useText();
  const stance = view.hero.stance;
  const threat = facing.threat[stance];
  const { fire, smoke } = view.hero.bombs;
  const sneak = facing.sneak;
  const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
  const choose = (sound: () => void, call: () => Promise<LabyrinthResult>) => {
    sound();
    void act(call);
  };
  return (
    <CenterModal
      label={t('facing.title')}
      onClose={onAside}
      closeLabel={t('lab.lookAround')}
      width={420}
      head={
        <div className="flex items-center gap-2.5">
          <Pair view={view} size={44} />
          <span className="font-head text-sm font-extrabold text-muted">{t('facing.vs')}</span>
          <div className="flex min-w-0 flex-wrap gap-1">
            {facing.monsters.map((m) => (
              <button key={m.key} type="button" className="rounded-full border-0 bg-transparent p-0 active:scale-95" aria-label={text(m.name)} onClick={() => onFoe(m.key)}>
                <Token art={m.art} label={text(m.name)} ring={m.boss ? BOSS_RING : MONSTER_RING} size={44} />
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="grid gap-1">
        <span className="sub-heading">{t('facing.threat')}</span>
        <p className="m-0 text-[15px]">
          <strong className={THREAT_TONE[threat].split(' ')[1]}>{t(`threat.${threat}`)}.</strong> {t(`threat.${threat}.hint`)}
        </p>
      </div>

      <p className="-mt-1.5 m-0 text-xs text-muted">{t('foe.tap')}</p>

      <Foes facing={facing} onFoe={onFoe} />

      <div className="grid gap-1.5">
        <span className="sub-heading">{t('stance.title')}</span>
        <div className="grid grid-cols-3 gap-1.5">
          {STANCES.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-small grid gap-0.5 ${s === stance ? 'btn-primary' : ''}`}
              disabled={busy}
              aria-pressed={s === stance}
              onClick={() => s !== stance && choose(() => play('equip'), () => api.setStance(s))}
            >
              <span>{t(`stance.${s}`)}</span>
              <span className={`text-[11px] font-bold ${THREAT_TONE[facing.threat[s]].split(' ')[1]}`}>{t(`threat.${facing.threat[s]}`)}</span>
            </button>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">{t(`stance.${stance}.blurb`)}</p>
        {view.duo && <p className="m-0 text-sm text-muted">{t('duo.fightNote', { name: view.duo.name })}</p>}
      </div>

      <div className="grid gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => choose(() => {}, () => api.face({ action: 'fight', bomb: false, auto: true }))}>
          {t('facing.fight')}
        </button>
        {fire > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => choose(() => play('latch'), () => api.face({ action: 'fight', bomb: true, auto: true }))}>
            {t('facing.bomb', { n: fire })}
          </button>
        )}
        {sneak && (
          <button type="button" className="btn grid gap-0.5" disabled={busy} onClick={() => choose(() => play('step', { volume: 0.5 }), () => api.face({ action: 'sneak', smoke: false }))}>
            <span>{t('facing.sneak')}</span>
            <span className="text-xs font-normal text-muted">
              {t('facing.sneakOdds', { ability: t('ability.dex'), mod: signed(sneak.modifier), dc: sneak.dc })}
              {sneak.edge !== 'normal' && ` · ${t(`facing.${sneak.edge}`)}`}
            </span>
            {view.duo && <span className="text-xs font-normal text-muted">{t('duo.sneakNote')}</span>}
          </button>
        )}
        {sneak && smoke > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => choose(() => play('miss', { rate: 0.7 }), () => api.face({ action: 'sneak', smoke: true }))}>
            {t('facing.smoke', { n: smoke })}
          </button>
        )}
        <button type="button" className="btn grid gap-0.5" disabled={busy} onClick={() => choose(() => play('step'), () => api.face({ action: 'retreat' }))}>
          <span>{t('facing.retreat')}</span>
          <span className="text-xs font-normal text-muted">{t('facing.retreatHint')}</span>
        </button>
      </div>
    </CenterModal>
  );
}

/** What each monster in the doorway can do, so the Player can weigh the fight. */
function Foes({ facing, onFoe }: { facing: Facing; onFoe: (key: string) => void }) {
  const { t } = useI18n();
  const text = useText();
  const seen = new Set<string>();
  const kinds = facing.monsters.filter((m) => {
    const id = `${text(m.name)}:${m.elite ?? ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!kinds.some((m) => m.powers.length > 0 || m.elite)) return null;
  return (
    <div className="grid gap-1.5">
      <span className="sub-heading">{t('facing.who')}</span>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {kinds.map((m) => (
          <li key={m.key} className="text-sm leading-snug">
            <button type="button" className="border-0 bg-transparent p-0 font-head font-bold text-bone underline decoration-brass-dim decoration-dotted underline-offset-4" onClick={() => onFoe(m.key)}>
              {text(m.name)}
            </button>
            {m.elite && <span className={m.elite === 'gilded' ? 'text-gold' : 'text-tier-epic'}> · {t(`elite.${m.elite}`)}: {t(`elite.${m.elite}.blurb`)}</span>}
            {m.powers.map((p) => (
              <span key={p} className="block text-muted">
                <span className="text-bone">{t(`power.${p}`)}.</span> {t(`power.${p}.blurb`)}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {kinds.some((m) => m.elite) && <p className="m-0 text-xs text-muted">{t('elite.note')}</p>}
    </div>
  );
}

/** One monster up close: what it is, and how it fights on this Floor today. */
function FoeCard({ facing, monsterKey, onClose }: { facing: Facing; monsterKey: string; onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const m = facing.monsters.find((x) => x.key === monsterKey);
  const foe = facing.foes.find((x) => x.key === monsterKey);
  if (!m || !foe) return null;
  const [n, sides, bonus] = foe.damage;
  const dice = `${n}d${sides}${bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` − ${-bonus}` : ''}`;
  const average = Math.round(((n * (sides + 1)) / 2 + bonus) * foe.damageFactor);
  const stats: [string, string][] = [
    [t('foe.health'), String(m.maxHp)],
    [t('foe.ac'), String(m.ac)],
    [t('foe.toHit'), `+${foe.attack}`],
    [t('foe.damage'), t('foe.damageValue', { dice, n: average })],
    ...(foe.attacks > 1 ? [[t('foe.attacks'), String(foe.attacks)] as [string, string]] : []),
  ];
  return (
    <CenterModal
      label={text(m.name)}
      onClose={onClose}
      head={
        <div className="flex items-center gap-3">
          <Token art={m.art} label={text(m.name)} ring={m.boss ? BOSS_RING : MONSTER_RING} size={64} />
          <div className="grid min-w-0 justify-items-start gap-1">
            <span className="font-head text-[22px] leading-tight font-extrabold">{text(m.name)}</span>
            <span className="text-sm text-muted">{t(`kin.${foe.kin}`)} · {t(`foe.role.${foe.role}`)}</span>
            {m.elite && <EliteBadge elite={m.elite} />}
          </div>
        </div>
      }
    >
      <p className="m-0 text-[15px] leading-snug italic">{text(foe.about)}</p>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 border-b border-line/40 pb-1">
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 text-right font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {(m.elite || m.powers.length > 0) && (
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm leading-snug">
          {m.elite && (
            <li className={m.elite === 'gilded' ? 'text-gold' : 'text-tier-epic'}>
              <span className="font-bold">{t(`elite.${m.elite}`)}.</span> {t(`elite.${m.elite}.blurb`)}
            </li>
          )}
          {m.powers.map((p) => (
            <li key={p} className="text-muted">
              <span className="font-bold text-bone">{t(`power.${p}`)}.</span> {t(`power.${p}.blurb`)}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" onClick={onClose}>{t('close')}</button>
    </CenterModal>
  );
}

/** The short rests on the belt: what one gives now, and when used ones come back. */
function RestCard({ view, busy, act, onClose }: { view: LabyrinthView; busy: boolean; act: Act; onClose: () => void }) {
  const { t, locale } = useI18n();
  const hero = view.hero;
  const { left, of, backAt } = hero.shortRests;
  const inCity = view.location === 'city';
  const blocked = inCity || view.room?.facing != null;
  const full = hero.hp >= hero.maxHp && hero.stamina >= hero.staminaMax;
  const hpAfter = Math.min(hero.maxHp, hero.hp + Math.ceil(hero.maxHp / 2));
  const staminaAfter = Math.min(hero.staminaMax, hero.stamina + Math.ceil(hero.staminaMax / 2));
  return (
    <CenterModal
      label={t('rest.title')}
      onClose={onClose}
      head={
        <div className="flex items-center gap-3">
          <span className={`grid size-14 shrink-0 place-items-center rounded-[2px] border bg-[#241c12] ${left > 0 ? 'border-gold text-gold' : 'border-line text-brass-dim'}`}>
            <BeltIcon name="rest" className="size-8" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-head text-[22px] leading-tight font-extrabold">{t('rest.title')}</span>
            <span className="text-sm text-muted">{t('rest.left', { left, of })}</span>
          </div>
        </div>
      }
    >
      <p className="m-0 text-[15px] leading-snug">{t('rest.about')}</p>
      {left > 0 && !full && !blocked && (
        <p className="m-0 text-sm">{t('rest.preview', { hp: hero.hp, hpAfter, st: hero.stamina, stAfter: staminaAfter })}</p>
      )}
      <p className="m-0 text-sm text-muted">{backAt ? t('rest.backAt', { time: formatClock(locale, backAt) }) : t('rest.back')}</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || left === 0 || blocked || full}
        onClick={() => {
          onClose();
          play('page', { rate: 0.8 });
          void act(api.shortRest);
        }}
      >
        {inCity ? t('rest.city') : blocked ? t('rest.blocked') : left === 0 ? t('rest.none') : full ? t('rest.full') : t('rest.take')}
      </button>
      <button type="button" className="btn" onClick={onClose}>{t('close')}</button>
    </CenterModal>
  );
}

const MARKER_PLACE: Record<Direction, string> = {
  n: 'top-[70px] left-1/2 -translate-x-1/2',
  s: 'bottom-[62px] left-1/2 -translate-x-1/2',
  e: 'right-1.5 top-1/2 -translate-y-1/2',
  w: 'left-1.5 top-1/2 -translate-y-1/2',
};
const ARROW: Record<Direction, string> = { n: 'M6 15l6-6 6 6', s: 'M6 9l6 6 6-6', e: 'M9 6l6 6-6 6', w: 'M15 6l-6 6 6 6' };

/** A Door on the Room map itself, where the art has its openings. */
function DoorMarker({ exit, disabled, onMove }: { exit: Exit; disabled: boolean; onMove: (to: number) => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t(`dir.${exit.direction}`)}
      disabled={disabled || !exit.passable}
      onClick={() => onMove(exit.to)}
      className={`absolute grid size-11 place-items-center rounded-full border-2 bg-black/70 p-0 shadow-[0_0_0_1px_#000] transition-transform active:scale-95 disabled:opacity-40 ${
        MARKER_PLACE[exit.direction]
      } ${exit.kind === 'secret' ? 'border-dashed border-tier-epic text-tier-epic' : exit.kind === 'locked' ? 'border-[#c9a24a] text-[#e8cf9a]' : exit.visited ? 'border-bone/40 text-bone/70' : 'border-gold text-gold'}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ARROW[exit.direction]} />
      </svg>
      {exit.suspicious && (
        <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-tier-mythic font-head text-[11px] font-extrabold text-black">!</span>
      )}
    </button>
  );
}

function ExitButton({ exit, disabled, onMove }: { exit: Exit; disabled: boolean; onMove: (to: number) => void }) {
  const { t } = useI18n();
  const text = useText();
  const notes: { key: string; line: string; tone: string }[] = [];
  if (exit.kind === 'locked') {
    notes.push({ key: 'lock', line: exit.passable ? t('lab.exit.lockedOpen') : t('lab.exit.lockedShut'), tone: 'text-[#e8cf9a]' });
  }
  if (exit.kind === 'cracked') notes.push({ key: 'crack', line: t('lab.exit.cracked'), tone: 'text-[#e8cf9a]' });
  if (exit.kind === 'secret') notes.push({ key: 'secret', line: t('lab.exit.secret'), tone: 'text-tier-epic' });
  if (exit.suspicious) notes.push({ key: 'lie', line: t('lab.exit.suspicious'), tone: 'text-[#ff9a8a]' });
  if (exit.visited) notes.push({ key: 'seen', line: exit.free ? t('lab.exit.visited') : t('lab.exit.again'), tone: 'text-muted' });

  return (
    <button
      type="button"
      className="btn grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 text-left font-body font-normal"
      disabled={disabled || !exit.passable}
      onClick={() => onMove(exit.to)}
    >
      <span className="row-span-2 font-head text-[15px] font-extrabold text-gold">{t(`dir.${exit.direction}`)}</span>
      <span className="italic">“{text(exit.clue)}”</span>
      {notes.length > 0 && (
        <span className="flex flex-wrap gap-x-2.5 text-[13px]">
          {notes.map((n) => <span key={n.key} className={n.tone}>{n.line}</span>)}
        </span>
      )}
    </button>
  );
}

function Graves({ view, busy, act }: { view: LabyrinthView; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const now = useNow(30_000);
  return (
    <section className="panel grid gap-2 p-3">
      <span className="sub-heading">{t('lab.graves')}</span>
      {view.graves.map((g) => (
        <div key={g.id} className="flex items-center justify-between gap-3">
          <div className="grid min-w-0">
            <span className="truncate font-head font-bold">{t('lab.grave', { name: g.owner })}</span>
            <span className="text-sm text-muted">
              {t('lab.graveInfo', { n: g.items, g: g.gold, time: formatDuration(t, new Date(g.expiresAt).getTime() - now) })}
            </span>
          </div>
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => void act(() => api.lootGrave(g.id))}>
            {t('lab.take')}
          </button>
        </div>
      ))}
    </section>
  );
}

/** What the last action brought: the fight's outcome, XP, gold, loot and anything to know. */
function Report({ result, onClose }: { result: LabyrinthResult; onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  const outcome = result.fight?.outcome ?? (result.died ? 'dead' : null);

  useEffect(() => {
    if (result.checks.length > 0 || result.duel) play('die');
    const best = result.loot.reduce<number>((top, item) => Math.max(top, TIERS.indexOf(item.tier)), -1);
    if (best >= 0) playTier(TIERS[best]!);
    else if (result.gold > 0 && !result.fight) play('coins');
    if (result.levelUp !== null) play('chips', { delay: 260 });
    if (result.deeds.length > 0) play('chips', { delay: 420 });
    if (result.died && !result.fight) play('grave');
  }, [result]);

  const title = outcome ? t(`fight.${outcome}`) : t('report.title');
  return (
    <CenterModal
      label={title}
      onClose={onClose}
      head={
        <span className={`font-head text-2xl font-extrabold ${outcome === 'victory' ? 'text-gold' : outcome === 'dead' ? 'text-tier-mythic' : 'text-bone'}`}>
          {title}
        </span>
      }
    >
      <div className="grid gap-2.5" aria-live="polite">
        {(result.xp > 0 || result.gold > 0 || result.levelUp !== null) && (
          <div className="flex flex-wrap gap-1.5">
            {result.levelUp !== null && (
              <NavLink to="/heroes" className="chip border-gold text-gold no-underline">{t('report.levelUp', { n: result.levelUp })}</NavLink>
            )}
            {result.xp > 0 && <span className="chip">{t('report.xp', { n: result.xp })}</span>}
            {result.gold > 0 && <span className="chip text-[#f1c75b]">{t('report.gold', { n: result.gold })}</span>}
          </div>
        )}
        {result.loot.length > 0 && (
          <div className="grid gap-1.5">
            <span className="sub-heading">{t('report.loot')}</span>
            <div className="flex flex-wrap gap-2">
              {result.loot.map((item) => (
                <TierBurst key={item.id} tier={item.tier}>
                  <ItemChip item={item} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} />
                </TierBurst>
              ))}
            </div>
          </div>
        )}
        {result.duel && (
          <p className="m-0 font-head text-[15px] font-bold">
            {t('report.duel', { a: result.duel.hero, b: result.duel.goblin })}
          </p>
        )}
        {result.checks.map((c, i) => <CheckLine key={i} check={c} />)}
        {result.notices.map((line, i) => (
          <p key={i} className="m-0 text-[15px]">{text(line)}</p>
        ))}
        {result.run && <RunCard run={result.run} />}
        {result.deeds.map((d) => (
          <NavLink key={d.id} to="/heroes" className="grid gap-0.5 rounded-[2px] border border-gold/70 bg-[rgb(224_184_106/0.08)] p-2.5 text-center no-underline">
            <span className="sub-heading">{t('report.deed')}</span>
            <span className="font-head text-lg font-extrabold text-gold">{text(d.title)}</span>
            <span className="text-sm">{t('report.deedReward', { n: d.gold })}</span>
          </NavLink>
        ))}
        {result.fight?.ally && (
          <div className="max-h-[38vh] overflow-y-auto rounded-[2px] border border-line/60 bg-black/20 p-2">
            <FightLog replay={result.fight} />
          </div>
        )}
        {result.fight && !result.fight.ally && (
          <button
            type="button"
            className="btn"
            onClick={() => openSheet({ title: t('report.fightLog'), body: <FightLog replay={result.fight!} /> })}
          >
            {t('report.fightLog')}
          </button>
        )}
        <button type="button" className="btn btn-primary mt-1" onClick={onClose}>{t('report.dismiss')}</button>
      </div>
    </CenterModal>
  );
}

/** What the whole Run brought, once it ends: back in the City, or dead. */
function RunCard({ run }: { run: RunSummary }) {
  const { t } = useI18n();
  const time = run.minutes < 60
    ? t('run.minutes', { m: run.minutes })
    : t('run.hours', { h: Math.floor(run.minutes / 60), m: run.minutes % 60 });
  const tiles: [string, string, string?][] = [
    [String(run.rooms), t('run.rooms')],
    [`${run.won}/${run.fights}`, t('run.fights')],
    [run.gold.toLocaleString(), run.died ? t('run.goldGrave') : t('run.gold'), run.died ? undefined : 'text-[#f1c75b]'],
    [String(run.items), t('run.items')],
    [run.xp.toLocaleString(), t('run.xp')],
    [String(run.deepest), t('run.deepest')],
  ];
  return (
    <div className="grid gap-1.5">
      <span className="sub-heading">{t('run.title')} · {time}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map(([value, label, tone]) => (
          <div key={label} className="grid content-start justify-items-center gap-0.5 rounded-sm border border-bone/15 bg-black/20 px-1 py-1.5 text-center">
            <span className={`font-head text-lg font-bold leading-none ${tone ?? ''}`}>{value}</span>
            <span className="text-[11px] leading-tight text-muted">{label}</span>
          </div>
        ))}
      </div>
      {run.levels.to > run.levels.from && (
        <span className="text-center font-head text-[15px] font-bold text-gold">{t('run.levels', { from: run.levels.from, to: run.levels.to })}</span>
      )}
    </div>
  );
}

/** One Check as it was rolled: the d20, the bonus, the total against the difficulty. */
function CheckLine({ check }: { check: CheckView }) {
  const { t } = useI18n();
  const text = useText();
  const mod = check.modifier >= 0 ? `+ ${check.modifier}` : `− ${-check.modifier}`;
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full border-2 font-head text-lg font-extrabold ${
          check.natural === 20 ? 'border-gold text-gold' : check.natural === 1 ? 'border-tier-mythic text-tier-mythic' : 'border-bone/60'
        }`}
      >
        {check.natural}
      </span>
      <span className="grid text-sm">
        <span className="font-bold">{text(check.label)}</span>
        <span className="text-muted">
          d20 {check.natural} {mod} = {check.total} · {t('report.dc', { n: check.dc })} ·{' '}
          <span className={check.success ? 'text-tier-uncommon' : 'text-tier-mythic'}>{check.success ? t('report.success') : t('report.failure')}</span>
          {check.dice.length > 1 && ` · ${t('report.dice', { list: check.dice.join(', ') })}`}
          {check.rerolled !== null && ` · ${t('report.rerolled', { n: check.rerolled })}`}
        </span>
      </span>
    </div>
  );
}
