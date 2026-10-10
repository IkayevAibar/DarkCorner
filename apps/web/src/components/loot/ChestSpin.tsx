import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OpenChestResult } from '@dark/shared';
import { ItemTile } from '../items/ItemTile';
import { ItemCard } from '../items/ItemCard';
import { useI18n } from '../../i18n';
import { play, playTier } from '../../sound';
import { useReducedMotion } from './motion';
import { makeStrip, SPIN_MS, STRIDE, TILE, stripOffset } from './strip';
import { TierBurst } from './TierBurst';

export function ChestSpin(props: { result: OpenChestResult; onDone: () => void }) {
  return <Spin key={props.result.prize.id} {...props} />;
}

function Spin({ result, onDone }: { result: OpenChestResult; onDone: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [landed, setLanded] = useState(reduced);
  const complete = landed || reduced;
  const tiles = useMemo(() => makeStrip(result), [result]);
  const strip = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const cue = useRef(false);
  const finished = useRef(false);
  const done = () => { if (!finished.current) { finished.current = true; onDone(); } };
  const next = useRef(() => {});
  next.current = () => complete ? done() : setLanded(true);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    action.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); next.current(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
        .filter(el => !el.closest('[inert]'));
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => { if (reduced) setLanded(true); }, [reduced]);
  useEffect(() => {
    if (complete) {
      if (strip.current) strip.current.style.transform = `translateX(-${stripOffset(1)}px)`;
      if (!cue.current) { cue.current = true; playTier(result.prize.tier); }
      return;
    }
    let frame = 0, start: number | null = null, under = 0, lastTick = 0;
    // Defer sound to the frame too, so StrictMode's setup/cleanup probe stays silent.
    const animate = (now: number) => {
      if (start === null) { start = now; play('latch'); }
      const progress = Math.min(1, (now - start) / SPIN_MS);
      const offset = stripOffset(progress);
      if (strip.current) strip.current.style.transform = `translateX(-${offset}px)`;
      const index = Math.floor(offset / STRIDE);
      if (index !== under && now - lastTick >= 45) { under = index; lastTick = now; play('tick'); }
      if (progress === 1) setLanded(true);
      else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [complete, result.prize.tier]);

  return createPortal(
    <div className="loot-overlay" role="dialog" aria-modal="true" aria-label={t('loot.spin')}>
      <div ref={panel} className="loot-scene panel" data-spin-complete={complete}>
        <header className="loot-heading">
          <span className="sub-heading">{t(`loot.chest.${result.grade}`)}</span>
          <h2>{complete ? t('loot.prize') : t('loot.spin')}</h2>
        </header>
        <div className="spin-window" aria-hidden="true" inert>
          <div ref={strip} className="spin-strip" style={{ transform: `translateX(-${stripOffset(complete ? 1 : 0)}px)` }}>
            {tiles.map(item => <ItemTile key={item.id} item={item} size={TILE} />)}
          </div>
          <div className="spin-needle" />
        </div>
        {complete ? <div className="spin-prize" aria-live="polite">
          <TierBurst tier={result.prize.tier}><ItemCard item={result.prize} /></TierBurst>
        </div> : <p className="spin-hint">{t('loot.turning')}</p>}
        <button ref={action} type="button" className={`btn ${complete ? 'btn-primary' : ''}`} onClick={() => next.current()}>
          {complete ? t('report.dismiss') : t('fight.skip')}
        </button>
      </div>
    </div>, document.body,
  );
}
