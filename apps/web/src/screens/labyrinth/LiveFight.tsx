import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Combatant, FightReplay, HeroActionKind, HeroActionView, LiveFight } from '@dark/shared';
import { displayNames, sound } from '../../components/fight/presentation';
import { BOSS_RING, MONSTER_RING, Token } from '../../components/Token';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { useNow } from '../../time';
import { BeltIcon } from './Belt';
import { FightLog } from './FightLog';
import { roomArt } from './roomArt';

/**
 * A fight played turn by turn (docs/design.md → Manual fights): the board, what has
 * happened, and the Hero's choices when it is this Player's turn. A working stand-in
 * until the fight scene plays it (docs/tasks/codex-16-duo-fight.md). New blows show
 * one by one; once a fight is over, its last blows show and then `onDone` brings the report.
 */

/** A fight as the board draws it: waiting for a turn, or over with its last blows still to show. */
export type BoardFight = Omit<LiveFight, 'turn'> & { turn: LiveFight['turn'] | null; outcome: FightReplay['outcome'] | null };
export const liveBoard = (live: LiveFight): BoardFight => ({ ...live, outcome: null });
export const endedBoard = (replay: FightReplay): BoardFight => ({ ...replay, turn: null, mine: false, deadline: null, auto: true, outcome: replay.outcome });

type Icon = Parameters<typeof BeltIcon>[0]['name'];
const ICON: Record<HeroActionKind, Icon> = {
  attack: 'sword', burst: 'flame', cure: 'heart', 'second-wind': 'wind', potion: 'potion', escape: 'escape', dodge: 'dodge', help: 'path', guard: 'shield',
  revive: 'bolt',
};
/** The order the choices are offered in, attacks first. */
const ORDER: HeroActionKind[] = ['attack', 'burst', 'cure', 'second-wind', 'potion', 'dodge', 'help', 'guard', 'revive', 'escape'];
const STATUS_COLOR: Record<string, string> = { burning: '#e8883a', poisoned: '#7fb85a', paralyzed: '#7aa7d8', frightened: '#a782c9' };

interface Piece { hp: number; down: boolean; gone: boolean; statuses: string[] }

/** Everyone's health and state after the first `n` blows: the server's numbers, never worked out here. */
function boardAt(fight: BoardFight, n: number): Record<string, Piece> {
  const pieces: Record<string, Piece> = {};
  for (const c of [fight.hero, ...(fight.ally ? [fight.ally] : []), ...fight.monsters]) pieces[c.key] = { hp: c.hp, down: false, gone: false, statuses: [] };
  const set = (key: string | undefined, hp: number | undefined) => {
    const p = key ? pieces[key] : undefined;
    if (p && hp !== undefined) {
      p.hp = hp;
      if (hp > 0) p.down = false;
    }
  };
  for (const e of fight.events.slice(0, n)) {
    switch (e.type) {
      case 'attack': set(e.target, e.targetHp); break;
      case 'burst': for (const hit of e.targets) set(hit.key, hit.hp); break;
      case 'heal': set(e.actor, e.hp); break;
      case 'feature': set(e.actor ?? 'hero', e.hp); break;
      case 'power': set(e.power === 'drain' || e.power === 'undying' ? e.actor : e.target ?? e.actor, e.hp); break;
      case 'tick': set(e.target, e.hp); break;
      case 'rise': set(e.actor ?? 'hero', e.hp); break;
      case 'revive': if (e.success) set(e.target, e.hp); break;
      case 'status': pieces[e.target]?.statuses.push(e.status); break;
      case 'expire': {
        const p = pieces[e.target];
        if (p) p.statuses = p.statuses.filter((s) => s !== e.status);
        break;
      }
      case 'defeated': if (pieces[e.key]) Object.assign(pieces[e.key]!, { down: true, statuses: [] }); break;
      case 'fled': if (pieces[e.key]) pieces[e.key]!.gone = true; break;
      case 'down': if (pieces[e.actor ?? 'hero']) Object.assign(pieces[e.actor ?? 'hero']!, { hp: 0, down: true, statuses: [] }); break;
      case 'escape': if (e.success && pieces[e.actor ?? 'hero']) pieces[e.actor ?? 'hero']!.gone = true; break;
      default: break;
    }
  }
  return pieces;
}

function Bar({ hp, max, hero }: { hp: number; max: number; hero: boolean }) {
  return (
    <div className="h-[5px] w-full border border-black bg-[#2a211a]">
      <div className="h-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.round((hp / Math.max(1, max)) * 100))}%`, background: hero ? '#c23030' : '#8a2a22' }} />
    </div>
  );
}

function PieceToken({ who, piece, size, name, lit, onTap, hero }: {
  who: Combatant; piece: Piece; size: number; name: string; lit: boolean; onTap?: () => void; hero: boolean;
}) {
  const ring = who.banner ?? (who.boss ? BOSS_RING : MONSTER_RING);
  const body = (
    <>
      <span className={`rounded-full transition-transform duration-200 ${lit ? 'scale-110 shadow-[0_0_14px_rgb(224_184_106/0.8)]' : ''}`}>
        <Token art={who.art} label={name} ring={ring} size={size} fallen={piece.down} />
      </span>
      <span className="max-w-full truncate rounded-[2px] bg-black/65 px-1.5 font-head text-[11px] font-bold text-bone">{name}</span>
      <span className="flex w-full items-center gap-1">
        <Bar hp={piece.hp} max={who.maxHp} hero={hero} />
        <span className="shrink-0 text-[10px] leading-none text-bone/80 tabular-nums">{piece.hp}</span>
      </span>
      {piece.statuses.length > 0 && (
        <span className="flex gap-1">
          {[...new Set(piece.statuses)].map((s) => <span key={s} title={s} className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />)}
        </span>
      )}
    </>
  );
  const cls = `grid justify-items-center gap-1 border-0 bg-transparent p-0 ${piece.gone ? 'opacity-0' : ''}`;
  return onTap
    ? <button type="button" className={`${cls} cursor-crosshair active:scale-95`} style={{ width: Math.max(size, 70) }} onClick={onTap}>{body}</button>
    : <div className={cls} style={{ width: Math.max(size, 70) }}>{body}</div>;
}

export function LiveFightPanel({ fight, at, busy, onChoose, onDone }: {
  fight: BoardFight;
  /** Where it is fought, to turn the Room's map as the Room does. */
  at: { floor: number; room: number } | undefined;
  busy: boolean;
  onChoose: (action: HeroActionView) => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const names = displayNames({ ...fight, outcome: fight.outcome ?? 'victory' }, (v) => v[locale]);
  const total = fight.events.length;
  const [shown, setShown] = useState(0);
  const [rage, setRage] = useState(false);
  const [mark, setMark] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [curing, setCuring] = useState(false);
  const now = useNow(500);
  const log = useRef<HTMLDivElement>(null);

  // New blows show one by one; far behind (a fight joined late), they hurry.
  useEffect(() => {
    if (shown >= total) return;
    const behind = total - shown;
    const id = setTimeout(() => {
      const e = fight.events[shown];
      if (e && behind <= 8) sound(e);
      setShown(shown + 1);
    }, behind > 8 ? 70 : 420);
    return () => clearTimeout(id);
  }, [shown, total, fight.events]);
  // Over, and every blow shown: on to the report.
  useEffect(() => {
    if (!fight.outcome || shown < total) return;
    const id = setTimeout(onDone, 1100);
    return () => clearTimeout(id);
  }, [fight.outcome, shown, total, onDone]);
  // A new turn clears the half-made choice.
  const turnKey = `${fight.turn?.hero}:${fight.turn?.round}:${fight.turn?.continuing}:${total}`;
  useEffect(() => {
    setRage(false);
    setMark(null);
    setMarking(false);
    setCuring(false);
  }, [turnKey]);
  useLayoutEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [shown]);

  const pieces = boardAt(fight, shown);
  const caughtUp = shown >= total;
  const turn = fight.turn;
  const myTurn = caughtUp && !fight.outcome && fight.mine && turn !== null;
  const ready = myTurn && !busy;
  const can = (k: HeroActionKind) => ready && (turn?.actions.includes(k) ?? false);
  const last = shown > 0 ? fight.events[shown - 1] : undefined;
  const acting = !caughtUp && last && 'actor' in last ? last.actor ?? 'hero' : myTurn ? 'hero' : null;
  const partnerName = fight.ally ? names.ally! : '';

  const choose = (action: HeroActionView) => onChoose({ ...action, ...(rage ? { rage: true } : {}), ...(mark ? { mark } : {}) });
  const tapMonster = (key: string) => {
    if (marking) {
      setMark(key);
      setMarking(false);
    } else if (can('attack')) choose({ kind: 'attack', target: key });
  };
  const targetable = (key: string) => ready && (marking || (turn?.actions.includes('attack') ?? false)) && (turn?.targets.includes(key) ?? false);

  const seconds = fight.deadline ? Math.max(0, Math.ceil((new Date(fight.deadline).getTime() - now) / 1000)) : null;
  const status = fight.outcome ? t(`fight.${fight.outcome}`)
    : !caughtUp ? t('live.watch')
    : myTurn ? (turn!.continuing ? t('live.again') : t('live.yours'))
    : fight.auto && !fight.ally ? t('live.onItsOwn')
    : t('live.theirs', { name: partnerName });
  const art = roomArt(fight.map, at);
  const count: Partial<Record<HeroActionKind, number>> = turn ? { burst: turn.spells, cure: turn.heals, potion: turn.potions } : {};
  const label = (k: HeroActionKind): string => {
    const n = count[k];
    const base = t(`live.act.${k}` as MessageKey, { name: partnerName });
    return n !== undefined ? `${base} · ${n}` : base;
  };

  return (
    <div className="grid gap-3">
      <section className="relative -mx-4 -mt-3 overflow-hidden bg-black">
        <img {...art} alt="" className="absolute top-1/2 left-1/2 size-[max(100%,480px)] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover brightness-[0.42]" draggable={false} />
        <div className="relative grid gap-4 px-3 pt-3 pb-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-head text-lg font-extrabold text-bone [text-shadow:0_2px_6px_#000]">{status}</span>
            <span className="flex items-baseline gap-2 text-xs text-bone/80">
              {turn && !fight.outcome && <span>{t('live.round', { n: turn.round })}</span>}
              {seconds !== null && caughtUp && !fight.outcome && (
                <span className={`font-bold tabular-nums ${seconds <= 10 ? 'text-[#ff9a8a]' : 'text-gold'}`}>{t('live.seconds', { n: seconds })}</span>
              )}
            </span>
          </div>
          {ready && (marking || turn!.actions.includes('attack')) && (
            <p className="-mt-2 m-0 text-center text-xs text-gold">{marking ? t('live.marking') : t('live.tapMonster')}</p>
          )}
          <div className="flex flex-wrap items-start justify-center gap-2.5">
            {fight.monsters.map((m) => (
              <PieceToken key={m.key} who={m} piece={pieces[m.key]!} name={names[m.key]!} size={fight.monsters.length > 4 ? 52 : 62} hero={false}
                lit={acting === m.key || mark === m.key} onTap={targetable(m.key) && !pieces[m.key]!.down ? () => tapMonster(m.key) : undefined} />
            ))}
          </div>
          <div className="flex items-end justify-center gap-5">
            <PieceToken who={fight.hero} piece={pieces.hero!} name={names.hero!} size={76} hero lit={acting === 'hero'} />
            {fight.ally && <PieceToken who={fight.ally} piece={pieces.ally!} name={names.ally!} size={62} hero lit={acting === 'ally'} />}
          </div>
        </div>
      </section>

      <div ref={log} className="max-h-[26vh] overflow-y-auto rounded-[2px] border border-line/60 bg-black/20 p-2">
        <FightLog replay={{ ...fight, outcome: fight.outcome ?? 'victory' }} until={shown} ongoing={!fight.outcome} />
      </div>

      {myTurn && turn && (
        <section className="grid gap-2" aria-label={t('live.title')}>
          {(turn.rage || turn.mark) && (
            <div className="flex flex-wrap gap-2">
              {turn.rage && (
                <button type="button" aria-pressed={rage} className={`btn btn-small flex items-center gap-1.5 ${rage ? 'btn-primary' : ''}`} disabled={busy} onClick={() => setRage(!rage)}>
                  <BeltIcon name="rage" className="size-4" />{t('live.rage')}
                </button>
              )}
              {turn.mark && (
                <button type="button" aria-pressed={marking || mark !== null} className={`btn btn-small flex items-center gap-1.5 ${marking || mark ? 'btn-primary' : ''}`} disabled={busy}
                  onClick={() => { setMark(null); setMarking(!marking); }}>
                  <BeltIcon name="target" className="size-4" />{mark ? t('live.marked', { name: names[mark]! }) : t('live.mark')}
                </button>
              )}
            </div>
          )}
          {curing ? (
            <div className="grid gap-2">
              <span className="sub-heading">{t('live.cureWho')}</span>
              <div className="grid grid-cols-2 gap-2">
                {turn.cure.map((k) => (
                  <button key={k} type="button" className="btn btn-primary" disabled={busy} onClick={() => choose({ kind: 'cure', target: k })}>
                    {k === 'hero' ? t('live.you') : partnerName}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-small justify-self-start" onClick={() => setCuring(false)}>{t('close')}</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ORDER.filter((k) => turn.actions.includes(k)).map((k) => (
                <button key={k} type="button" className={`btn grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0 text-left ${k === 'attack' ? 'btn-primary' : ''}`}
                  disabled={!can(k)}
                  onClick={() => {
                    if (k === 'cure' && turn.cure.length > 1) setCuring(true);
                    else choose({ kind: k, ...(k === 'cure' ? { target: turn.cure[0] } : {}) });
                  }}>
                  <BeltIcon name={ICON[k]} className="row-span-2 size-5" />
                  <span className="text-[14px] leading-tight">{label(k)}</span>
                  <span className="text-[11px] leading-tight font-normal opacity-75">{t(`live.hint.${k}` as MessageKey, { name: partnerName, n: turn.attacks })}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-small grid gap-0.5" disabled={busy} onClick={() => onChoose({ kind: 'auto' })}>
            <span className="flex items-center justify-center gap-1.5"><BeltIcon name="swords" className="size-4" />{t('live.auto')}</span>
            <span className="text-[11px] font-normal opacity-75">{t('live.autoHint')}</span>
          </button>
        </section>
      )}
      {!myTurn && !fight.outcome && caughtUp && fight.ally && !fight.auto && (
        <p className="m-0 text-center text-sm text-muted">{t('live.waitingFor', { name: partnerName })}</p>
      )}
      {!myTurn && !fight.outcome && caughtUp && fight.auto && fight.ally && (
        <p className="m-0 text-center text-sm text-muted">{t('live.onItsOwn')}</p>
      )}
    </div>
  );
}
