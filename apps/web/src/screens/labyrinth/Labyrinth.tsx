import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import {
  STANCES, TIERS, type CheckView, type Direction, type Exit, type Facing, type LabyrinthResult, type LabyrinthView, type Threat,
} from '@dark/shared';
import { api, ApiRequestError } from '../../api';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { Meter } from '../../components/Meter';
import { useSheet } from '../../components/Sheet';
import { BOSS_RING, MONSTER_RING, Token } from '../../components/Token';
import { describeError } from '../../errors';
import { useI18n } from '../../i18n';
import { play, playTier } from '../../sound';
import { formatClock, formatDuration, useAt, useNow } from '../../time';
import { EventPanel } from './EventPanel';
import { EliteBadge, FightPlayback } from './FightPlayback';
import { FloorMap } from './FloorMap';

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

  const load = useCallback(async () => {
    try {
      const result = await api.labyrinth();
      setView(result.view);
      setStatus('ready');
    } catch (e) {
      setStatus(e instanceof ApiRequestError && e.body?.error === 'no_hero' ? 'noHero' : 'failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Stamina ticks back and Camps finish resting on the server's clock: look again then.
  const refresh = () => {
    if (!busy && !playing) void load();
  };
  useAt(view?.hero.staminaNextAt, refresh);
  useAt(view?.room?.restedAt, refresh);

  const act: Act = async (call) => {
    setBusy(true);
    setError(null);
    try {
      const result = await call();
      setReport(null);
      if (result.fight) {
        setPlaying(result);
      } else {
        setView(result.view);
        if (hasNews(result)) {
          setReport(result);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
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
    window.scrollTo({ top: 0 });
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
        <Gate view={view} busy={busy} error={error} act={act} />
      ) : (
        <Inside view={view} busy={busy} error={error} act={act} />
      )}
      {playing?.fight && <FightPlayback replay={playing.fight} onDone={fightOver} />}
    </div>
  );
}

const hasNews = (r: LabyrinthResult) =>
  r.fight !== null || r.loot.length > 0 || r.gold > 0 || r.xp > 0 || r.levelUp !== null || r.died || r.notices.length > 0
  || r.checks.length > 0 || r.duel !== null;

/** Drinks one Healing potion from the Bag, then shows the Labyrinth again. */
async function drinkPotion(): Promise<LabyrinthResult> {
  const me = await api.myHero();
  const potion = me.hero?.bag.find((i) => i.base === 'potion');
  if (potion) await api.drink(potion.id);
  return api.labyrinth();
}

function HeroStatus({ view }: { view: LabyrinthView }) {
  const { t } = useI18n();
  const text = useText();
  const now = useNow();
  const { hero } = view;
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-3">
        <Token art={hero.portraitUrl} label={hero.name} ring={hero.banner} size={52} />
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate font-head text-lg leading-tight font-extrabold">{hero.name}</span>
          <span className="truncate text-sm text-muted">
            {view.floor ? `${t('lab.floor', { n: view.floor.number })} · ${text(view.floor.name)}` : t('lab.inCity')}
          </span>
        </div>
      </div>
      <Meter label={t('hero.health')} value={hero.hp} max={hero.maxHp} kind="health" />
      <div className="grid gap-0.5">
        <Meter label={t('hero.stamina')} value={hero.stamina} max={hero.staminaMax} kind="stamina" />
        {hero.staminaNextAt && (
          <span className="justify-self-end text-xs text-muted">
            {t('lab.staminaNext', { time: formatDuration(t, new Date(hero.staminaNextAt).getTime() - now) })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="chip">{t('hero.level', { n: hero.level })}</span>
        <span className="chip">{hero.xpNext === null ? t('lab.xpMax', { n: hero.xp }) : t('lab.xp', { n: hero.xp, m: hero.xpNext })}</span>
        {hero.carriedGold > 0 && <span className="chip text-[#f1c75b]">{t('lab.carried', { n: hero.carriedGold })}</span>}
        <span className="chip">{t('lab.potions', { n: hero.potions })}</span>
        {hero.spells > 0 && <span className="chip">{t('lab.spells', { n: hero.spells })}</span>}
        {hero.heals > 0 && <span className="chip">{t('lab.heals', { n: hero.heals })}</span>}
      </div>
    </div>
  );
}

/** In the City: the way down, at the gate or at any Waypoint already woken. */
function Gate({ view, busy, error, act }: { view: LabyrinthView; busy: boolean; error: string | null; act: Act }) {
  const { t } = useI18n();
  const floors = [1, ...view.waypoints.filter((n) => n !== 1).sort((a, b) => a - b)];
  const shut = view.season.status === 'planned';
  return (
    <section className="panel grid gap-4 p-4">
      <HeroStatus view={view} />
      <div className="grid gap-1">
        <h1 className="m-0 font-head text-2xl font-extrabold">{t('lab.gate.title')}</h1>
        <p className="m-0 text-muted">{t('lab.gate.body')}</p>
        {view.bestFloor > 0 && <span className="text-sm text-muted">{t('lab.bestFloor', { n: view.bestFloor })}</span>}
        {shut && <p className="m-0 font-bold text-[#ff9a8a]">{t('lab.notStarted')}</p>}
      </div>
      <div className="grid gap-2">
        {floors.map((n) => (
          <button
            key={n}
            type="button"
            className={`btn ${n === 1 ? 'btn-primary' : ''}`}
            disabled={busy || shut}
            onClick={() => {
              play('door', { rate: 0.8 });
              void act(() => api.enterLabyrinth(n));
            }}
          >
            {n === 1 ? t('lab.enter') : t('lab.enterWaypoint', { n })}
          </button>
        ))}
      </div>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}

const DIRECTION_ORDER: Direction[] = ['n', 'e', 's', 'w'];

function Inside({ view, busy, error, act }: { view: LabyrinthView; busy: boolean; error: string | null; act: Act }) {
  const { t, locale } = useI18n();
  const floor = view.floor!;
  const room = view.room!;
  const exits = [...view.exits].sort((a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction));
  const move = (to: number) => {
    play(exits.find((e) => e.to === to)?.kind === 'open' ? 'door' : 'creak');
    void act(() => api.moveTo(to));
  };
  const walk = (call: () => Promise<LabyrinthResult>) => {
    play('step');
    play('step', { delay: 260 });
    void act(call);
  };
  const facing = room.facing;
  const canLeave = (floor.number === 1 && room.type === 'landing') || (room.type === 'waypoint' && view.waypoints.includes(floor.number));
  const canAscend = floor.number > 1 && room.type === 'landing';
  const label = floor.number === 1 && room.type === 'landing' ? t('room.entrance') : t(`room.${room.type}`);

  return (
    <>
      <section className="panel p-3.5">
        <HeroStatus view={view} />
      </section>

      <section className="grid gap-2">
        <h2 className="m-0 flex items-baseline gap-2 px-1 font-head text-xl font-extrabold">
          {label}
          {room.cleared && room.type !== 'empty' && <span className="font-body text-sm font-normal text-muted">{t('room.cleared')}</span>}
          {facing && <ThreatChip threat={facing.threat[view.hero.stance]} />}
        </h2>
        <div className="relative mx-1 aspect-square overflow-hidden rounded-[2px] border border-brass-dim bg-black shadow-[0_0_0_1px_#000,0_14px_34px_rgb(0_0_0/0.7)]">
          <img src={`/art/rooms/${room.map}.jpg`} alt="" className="absolute inset-0 size-full object-cover brightness-[0.78]" draggable={false} />
          {facing ? (
            <FacingTokens facing={facing} view={view} />
          ) : (
            <>
              <div className="absolute inset-0 grid place-items-center">
                <Token art={view.hero.portraitUrl} label={view.hero.name} ring={view.hero.banner} size={86} />
              </div>
              {exits.map((exit) => (
                <DoorMarker key={exit.to} exit={exit} disabled={busy} onMove={move} />
              ))}
            </>
          )}
        </div>
        {room.restedAt && (
          <p className="m-0 px-1 text-sm text-muted">{t('lab.restedAt', { time: formatClock(locale, room.restedAt) })}</p>
        )}
        {room.vault && (
          <p className="m-0 px-1 text-sm text-gold">
            {room.vault.state === 'sealed' && room.vault.opensAt
              ? t('lab.vault.sealed', { time: formatClock(locale, room.vault.opensAt) })
              : t(`lab.vault.${room.vault.state}`)}
          </p>
        )}
      </section>

      {error && <p className="m-0 px-1 text-sm text-tier-mythic">{error}</p>}

      {facing && <FacingPanel facing={facing} view={view} busy={busy} act={act} />}

      {room.eventView && <EventPanel event={room.eventView} view={view} busy={busy} act={act} />}

      {view.hero.potions > 0 && view.hero.hp < view.hero.maxHp && (
        <button type="button" className="btn" disabled={busy} onClick={() => void act(drinkPotion)}>
          {t('lab.drink', { n: view.hero.potions })}
        </button>
      )}

      {facing ? (
        <p className="m-0 px-1 text-sm text-muted">{t('facing.blocked')}</p>
      ) : (
        <section className="grid gap-2">
          <span className="sub-heading">{t('lab.doors')}</span>
          {exits.map((exit) => (
            <ExitButton key={exit.to} exit={exit} disabled={busy} onMove={move} />
          ))}
        </section>
      )}

      {(room.type === 'stairs' || canAscend || canLeave || view.hero.portalScrolls > 0) && (
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
          {view.hero.portalScrolls > 0 && !canLeave && (
            <button type="button" className="btn" disabled={busy} onClick={() => {
                play('page');
                void act(api.readPortal);
              }}>
              {t('lab.portal', { n: view.hero.portalScrolls })}
            </button>
          )}
        </section>
      )}

      {view.graves.length > 0 && <Graves view={view} busy={busy} act={act} />}

      <section className="panel grid gap-2 p-3">
        <span className="sub-heading">{t('lab.map', { n: floor.number })}</span>
        <FloorMap
          width={floor.width}
          height={floor.height}
          map={view.map!}
          current={room.id}
          banner={view.hero.banner}
          exits={exits}
          disabled={busy || facing !== null}
          onMove={move}
        />
      </section>
    </>
  );
}

const THREAT_TONE: Record<Threat, string> = {
  trivial: 'border-line text-muted',
  easy: 'border-tier-uncommon text-tier-uncommon',
  risky: 'border-gold text-gold',
  dangerous: 'border-tier-legendary text-tier-legendary',
  deadly: 'border-tier-mythic text-tier-mythic',
};

function ThreatChip({ threat }: { threat: Threat }) {
  const { t } = useI18n();
  return <span className={`chip ml-auto self-center font-head font-extrabold ${THREAT_TONE[threat]}`}>{t(`threat.${threat}`)}</span>;
}

/** The monsters in the doorway above, the Hero below, as in the fight that may follow. */
function FacingTokens({ facing, view }: { facing: Facing; view: LabyrinthView }) {
  const text = useText();
  const size = facing.monsters.length <= 2 ? 78 : 62;
  return (
    <>
      <div className="absolute inset-x-3 top-[12%] flex flex-wrap justify-center gap-3">
        {facing.monsters.map((m) => (
          <div key={m.key} className="grid justify-items-center gap-1" style={{ width: Math.max(size, 72) }}>
            <Token art={m.art} label={text(m.name)} ring={m.boss ? BOSS_RING : MONSTER_RING} size={m.boss && facing.monsters.length === 1 ? 118 : size} />
            <span className="max-w-full truncate rounded-[2px] bg-black/65 px-1.5 font-head text-xs font-bold text-bone">{text(m.name)}</span>
            {m.elite && <EliteBadge elite={m.elite} />}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex justify-center">
        <Token art={view.hero.portraitUrl} label={view.hero.name} ring={view.hero.banner} size={78} />
      </div>
    </>
  );
}

/** Monsters in the doorway: the Threat, the Stance, and Fight, Sneak past or Retreat. */
function FacingPanel({ facing, view, busy, act }: { facing: Facing; view: LabyrinthView; busy: boolean; act: Act }) {
  const { t } = useI18n();
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
    <section className="panel grid gap-3 p-3.5">
      <div className="grid gap-1">
        <span className="sub-heading">{t('facing.threat')}</span>
        <p className="m-0 text-[15px]">
          <strong className={THREAT_TONE[threat].split(' ')[1]}>{t(`threat.${threat}`)}.</strong> {t(`threat.${threat}.hint`)}
        </p>
      </div>

      <Foes facing={facing} />

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
      </div>

      <div className="grid gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => choose(() => {}, () => api.face({ action: 'fight', bomb: false }))}>
          {t('facing.fight')}
        </button>
        {fire > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => choose(() => play('latch'), () => api.face({ action: 'fight', bomb: true }))}>
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
    </section>
  );
}

/** What each monster in the doorway can do, so the Player can weigh the fight. */
function Foes({ facing }: { facing: Facing }) {
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
            <strong className="font-head">{text(m.name)}</strong>
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

const MARKER_PLACE: Record<Direction, string> = {
  n: 'top-1.5 left-1/2 -translate-x-1/2',
  s: 'bottom-1.5 left-1/2 -translate-x-1/2',
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
      } ${exit.kind === 'locked' ? 'border-[#c9a24a] text-[#e8cf9a]' : exit.visited ? 'border-bone/40 text-bone/70' : 'border-gold text-gold'}`}
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
  if (exit.suspicious) notes.push({ key: 'lie', line: t('lab.exit.suspicious'), tone: 'text-[#ff9a8a]' });
  if (exit.visited) notes.push({ key: 'seen', line: t('lab.exit.visited'), tone: 'text-muted' });

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
    if (result.died && !result.fight) play('grave');
  }, [result]);

  return (
    <section className="panel anim-pop grid gap-2.5 p-3.5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        {outcome ? (
          <span
            className={`font-head text-2xl font-extrabold ${
              outcome === 'victory' ? 'text-gold' : outcome === 'dead' ? 'text-tier-mythic' : 'text-bone'
            }`}
          >
            {t(`fight.${outcome}`)}
          </span>
        ) : (
          <span />
        )}
        <button type="button" className="chip" onClick={onClose}>{t('close')}</button>
      </div>
      {(result.xp > 0 || result.gold > 0 || result.levelUp !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {result.levelUp !== null && <span className="chip border-gold text-gold">{t('report.levelUp', { n: result.levelUp })}</span>}
          {result.xp > 0 && <span className="chip">{t('report.xp', { n: result.xp })}</span>}
          {result.gold > 0 && <span className="chip text-[#f1c75b]">{t('report.gold', { n: result.gold })}</span>}
        </div>
      )}
      {result.loot.length > 0 && (
        <div className="grid gap-1.5">
          <span className="sub-heading">{t('report.loot')}</span>
          <div className="flex flex-wrap gap-2">
            {result.loot.map((item) => (
              <ItemChip key={item.id} item={item} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} />
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
    </section>
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
