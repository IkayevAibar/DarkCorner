import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DuoChestView } from '@dark/shared';
import { useReducedMotion } from '../../../components/loot/motion';
import { ChestScene } from './ChestScene';
import { PICK_FLIGHT_MS } from './chestPicks';
import { useTrustText } from './messages';
import type { TrustPair } from './OathScene';

/** Retain the last server snapshot and the old Duo long enough for its final picks to arrive. */
export function ClosedChest({ chest, previousChest, hero, partner, onDone }: TrustPair & {
  chest: DuoChestView; previousChest?: DuoChestView; onDone: () => void;
}) {
  const text = useTrustText(), reduced = useReducedMotion(), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', key, true);
    let timer = 0;
    const frame = requestAnimationFrame(() => { timer = window.setTimeout(onDone, reduced ? 150 : PICK_FLIGHT_MS + 200); });
    return () => {
      cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus();
    };
  }, [onDone, reduced]);
  return createPortal(<div ref={panel} className="oath-reveal-dialog closed-chest-dialog" tabIndex={-1} role="dialog" aria-modal="true" aria-label={text('chest.title')}>
    <section className="panel"><header>{text('chest.title')}</header>
      <ChestScene chest={chest} previousChest={previousChest} hero={hero} partner={partner} closed busy onPick={() => {}} />
    </section>
  </div>, document.body);
}
