import { useTrustText } from './messages';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DuoChestView, ItemView } from '@dark/shared';
import { ItemChip, ItemDetails, useText } from '../../../components/items/ItemChip';
import { useSheet } from '../../../components/Sheet';
import { useReducedMotion } from '../../../components/loot/motion';
import { play, playTier } from '../../../sound';
import { useNow } from '../../../time';
import { useI18n } from '../../../i18n';
import { TrustPortrait, type TrustPair } from './OathScene';
import { useTrustCopy } from './copy';
import './trust.css';

export function ChestProp() {
  return <svg className="duo-chest-prop" viewBox="0 0 260 145" aria-hidden="true">
    <ellipse cx="130" cy="126" rx="116" ry="15" fill="#000" opacity=".6" />
    <path d="M43 69h174l-9 60H52Z" fill="#392a20" stroke="#100c0b" strokeWidth="6" />
    <path d="M48 76h165M50 98h160M75 71l4 58m105-58-4 58" stroke="#826847" strokeWidth="6" />
    <path d="M45 69h171l-17-15H60Z" fill="#090d0b" stroke="#aa8a52" strokeWidth="2" />
    <g className="duo-chest-lid"><path d="M42 70V34Q130-19 218 34v36Z" fill="#3b3025" stroke="#100c0b" strokeWidth="6" /><path d="M45 55h170M73 22v48m113-48v48" fill="none" stroke="#9b8058" strokeWidth="7" /><path d="M119 49h22v31h-22Z" fill="#9b8058" stroke="#1e1812" strokeWidth="3" /><circle cx="130" cy="61" r="3" fill="#1e1812" /></g>
    <path className="duo-chest-light" d="m56 60 20-49h108l20 49Z" fill="#e6c17c" opacity=".18" />
    <path d="M122 98v18m16-18v18" stroke="#b5a17c" strokeWidth="3" />
  </svg>;
}

type Flight = { item: ItemView; side: 'me' | 'partner'; x: number; y: number; dx: number; dy: number };

/** Server snapshots own every pick. The scene only animates new takenBy transitions. */
export function ChestScene({ chest, hero, partner, busy, onPick }: TrustPair & { chest: DuoChestView; busy: boolean; onPick: (index: number) => void }) {
  const trustText = useTrustText();
  const { t, locale } = useI18n(), text = useText(), copy = useTrustCopy(), reduced = useReducedMotion(), now = useNow(1000);
  const { openSheet } = useSheet();
  const root = useRef<HTMLDivElement>(null), previous = useRef(chest), [flights, setFlights] = useState<Flight[]>([]);
  const pending = useRef(false);
  const seconds = Math.max(0, Math.ceil((Date.parse(chest.deadline) - now) / 1000));
  const empty = chest.items.every(entry => entry.takenBy !== null);
  useEffect(() => { const id = requestAnimationFrame(() => play('latch', { rate: .8 })); return () => cancelAnimationFrame(id); }, []);
  useLayoutEffect(() => {
    pending.current = false;
    const before = previous.current;
    previous.current = chest;
    const changed = chest.items.flatMap((entry, index) => entry.takenBy && before.items[index]?.item.id === entry.item.id && before.items[index]?.takenBy === null ? [{ ...entry, index, side: entry.takenBy }] : []);
    const box = root.current?.getBoundingClientRect();
    if (!box || !changed.length) return;
    playTier(changed[0]!.item.tier);
    if (reduced) return;
    const next = changed.flatMap(entry => {
      const start = root.current?.querySelector(`[data-chest-item="${entry.index}"] .duo-item-art`)?.getBoundingClientRect();
      const end = root.current?.querySelector(`[data-chest-portrait="${entry.side}"] .trust-portrait>span`)?.getBoundingClientRect();
      if (!start || !end) return [];
      const x = start.x + start.width / 2 - 29, y = start.y + start.height / 2 - 29;
      return [{ item: entry.item, side: entry.side, x: x - box.x, y: y - box.y, dx: end.x + end.width / 2 - (x + 29), dy: end.y + end.height / 2 - (y + 29) }];
    });
    setFlights(current => [...current, ...next]);
  }, [chest, reduced]);
  useEffect(() => { if (!busy) pending.current = false; }, [busy]);
  const pick = (index: number) => {
    if (pending.current || busy || chest.turn !== 'me' || chest.full || seconds === 0 || chest.items[index]?.takenBy !== null) return;
    pending.current = true;
    onPick(index);
  };
  const mine = chest.turn === 'me' && !chest.full;
  return <div ref={root} className="duo-chest-scene" data-chest-turn={chest.turn ?? 'done'}>
    <div className="trust-portraits">{(['me', 'partner'] as const).map(side => <div key={side} data-chest-portrait={side} data-active={chest.turn === side}><TrustPortrait person={side === 'me' ? hero : partner} label={side === 'me' ? copy.you : copy.partner} /></div>)}</div>
    <div className="duo-chest-stage"><ChestProp /></div>
    <div className="duo-chest-turn" data-mine={mine}>
      <strong role="status">{empty ? copy.empty : chest.turn === null ? trustText('chest.full') : seconds === 0 ? copy.picking : mine ? copy.turn : copy.theirs}</strong>
      {chest.turn !== null && !empty && <span className="duo-countdown" data-urgent={seconds <= 5} style={{ '--clock': `${Math.min(100, seconds / 30 * 100)}%` } as CSSProperties}>{seconds}<small>{locale === 'ru' ? 'с' : 's'}</small></span>}
    </div>
    {chest.full && !empty && <p className="duo-bag-full">{trustText('chest.bagFull')}</p>}
    <div className="duo-chest-items">{chest.items.map(({ item, takenBy }, index) => <article key={item.id} data-chest-item={index} data-taken={takenBy ?? undefined} style={{ '--item-tier': `var(--color-tier-${item.tier})` } as CSSProperties}>
      <div className="duo-item-art"><ItemChip item={item} size={58} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} /></div>
      <span className="duo-item-name">{text(item.name)}</span>
      <small>{t(`tier.${item.tier}`)}</small>
      {takenBy ? <div className="duo-item-owner"><span>✓ {copy.claimed}</span><strong>{takenBy === 'me' ? hero.name : partner?.name ?? copy.partner}</strong></div> : <button type="button" className="btn btn-small" disabled={busy || !mine || seconds === 0} onClick={() => pick(index)}>{trustText('chest.take')}</button>}
    </article>)}</div>
    <p className="duo-chest-hint">{trustText('chest.hint')}</p>
    {flights.map(flight => <div key={flight.item.id} className="duo-item-flight" data-flight-to={flight.side} aria-hidden="true" inert style={{ left: flight.x, top: flight.y, '--flight-x': `${flight.dx}px`, '--flight-y': `${flight.dy}px` } as CSSProperties} onAnimationEnd={() => setFlights(current => current.filter(f => f !== flight))}><ItemChip item={flight.item} size={58} /></div>)}
  </div>;
}
