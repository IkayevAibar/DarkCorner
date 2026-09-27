import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ItemView, OpenChestResult, Tier } from '@dark/shared';
import { ItemChip, ItemDetails } from '../../components/items/ItemChip';
import { useI18n } from '../../i18n';
import { play, playTier } from '../../sound';

const TILE = 76;
const COUNT = 34;
const PRIZE_AT = 29;
const DECOY_ICONS = ['sword', 'axe', 'dagger', 'bow', 'staff', 'mace', 'shield', 'orb', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];

/**
 * The Spin: a strip of Items scrolls past and slows to a stop on the prize.
 *
 * Stand-in until Codex's version with Tier effects lands
 * (docs/tasks/codex-05-chest-spin.md): same props.
 */
export function ChestSpin({ result, onDone }: { result: OpenChestResult; onDone: () => void }) {
  const { t } = useI18n();
  const [spun, setSpun] = useState(false);
  const [landed, setLanded] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const strip = useMemo(() => {
    const pick = (): Tier => {
      let r = Math.random() * 100;
      return result.odds.find((o) => (r -= o.percent) < 0)?.tier ?? result.odds[0]!.tier;
    };
    return Array.from({ length: COUNT }, (_, i): ItemView => (i === PRIZE_AT ? result.prize : {
      ...result.prize,
      id: `decoy-${i}`,
      tier: pick(),
      icon: DECOY_ICONS[Math.floor(Math.random() * DECOY_ICONS.length)]!,
      art: null,
      identified: true,
      quantity: 1,
    }));
  }, [result]);

  // A tick each time a tile passes the needle, read off the strip as it moves.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (landed || reduced) return;
    play('latch');
    let frame = 0;
    let under = 0;
    const listen = () => {
      const strip = stripRef.current;
      if (strip) {
        const shift = -new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41;
        const index = Math.floor(shift / (TILE + 8));
        if (index !== under) {
          under = index;
          play('tick');
        }
      }
      frame = requestAnimationFrame(listen);
    };
    frame = requestAnimationFrame(listen);
    return () => cancelAnimationFrame(frame);
  }, [landed, reduced]);

  useEffect(() => {
    if (landed) playTier(result.prize.tier);
  }, [landed, result.prize.tier]);

  useEffect(() => {
    const start = requestAnimationFrame(() => setSpun(true));
    const stop = setTimeout(() => setLanded(true), reduced ? 50 : 3600);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(stop);
    };
  }, [reduced]);

  const offset = PRIZE_AT * (TILE + 8) + TILE / 2;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={t('loot.spin')}>
      <div className="grid w-full max-w-[540px] gap-4">
        <div className="relative h-[100px] overflow-hidden rounded-[2px] border border-brass-dim bg-[#0e0c0a]">
          <div
            ref={stripRef}
            className="absolute top-3 left-1/2 flex gap-2"
            style={{
              transform: `translateX(-${spun ? offset : TILE / 2}px)`,
              transition: reduced ? 'none' : 'transform 3.4s cubic-bezier(0.08, 0.72, 0.12, 1)',
            }}
          >
            {strip.map((item) => (
              <ItemChip key={item.id} item={item} size={TILE} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-gold shadow-[0_0_10px_#e0b86a]" />
        </div>
        {landed ? (
          <div className="panel anim-pop grid gap-4 p-4">
            <ItemDetails item={result.prize} />
            <button type="button" className="btn btn-primary" onClick={onDone}>{t('report.dismiss')}</button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setLanded(true)}>{t('fight.skip')}</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
