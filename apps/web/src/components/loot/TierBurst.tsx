import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { TIERS, type Tier } from '@dark/shared';
import { useReducedMotion } from './motion';
import './loot.css';

/** Visuals only: the owning scene plays one Tier cue, even when several Items arrive together. */
export function TierBurst({ tier, children }: { tier: Tier; children: ReactNode }) {
  const rank = TIERS.indexOf(tier);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || rank < 5) return;
    const target = root.current?.closest('[role="dialog"]') ?? document.getElementById('root');
    const distance = rank === 6 ? 7 : 4;
    const shake = target?.animate?.(
      [0, -1, 1, -.6, .5, -.2, 0].map(x => ({ translate: `${x * distance}px ${Math.abs(x) * 2}px` })),
      { duration: 440, easing: 'ease-out' },
    );
    return () => shake?.cancel();
  }, [rank, reduced]);

  const rays = rank === 6 ? 10 : rank >= 2 ? rank - 1 : 0;
  return (
    <div ref={root} className="tier-burst" data-tier={tier} data-reduced={reduced || undefined}
      style={{ '--loot-color': `var(--color-tier-${tier})`, '--loot-rank': rank } as CSSProperties}>
      {rank > 0 && <div className="tier-fx" aria-hidden="true">
        <i className="tier-glow" />
        {!reduced && <>
          {rank >= 3 && <i className="tier-ring" />}
          {Array.from({ length: rays }, (_, i) => <i key={`ray-${i}`} className="tier-ray"
            style={{ '--angle': `${rank === 6 ? i * 36 : (i - (rays - 1) / 2) * 24}deg` } as CSSProperties} />)}
          {Array.from({ length: rank * 4 }, (_, i) => {
            const angle = i * 2.39996;
            const distance = 32 + rank * 13 + (i % 4) * 9;
            return <i key={i} className="tier-spark" style={{
              '--x': `${Math.cos(angle) * distance}px`, '--y': `${Math.sin(angle) * distance - 32}px`,
              '--delay': `${i % 5 * 30}ms`,
            } as CSSProperties} />;
          })}
        </>}
      </div>}
      <div className="tier-content">{children}</div>
    </div>
  );
}
