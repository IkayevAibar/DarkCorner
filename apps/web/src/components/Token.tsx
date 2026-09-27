/**
 * A round token: a portrait in a ring, as on a D&D table (docs/design.md → Look
 * and feel). Heroes wear their banner color; monsters a dark iron ring, bosses gold.
 */
export function Token({ art, label, ring, size = 64, fallen = false, className = '' }: {
  art: string | null;
  /** Its initial stands in when there is no art yet. */
  label: string;
  ring: string;
  size?: number;
  fallen?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full transition-[filter] duration-500 ${className}`}
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 22))}px solid ${ring}`,
        boxShadow: '0 0 0 2px #000, 0 6px 14px rgb(0 0 0 / 0.65)',
        background: `radial-gradient(circle at 50% 38%, color-mix(in srgb, ${ring} 35%, #111), #0b0a09 75%)`,
        filter: fallen ? 'grayscale(1) brightness(0.4)' : undefined,
      }}
    >
      {art ? (
        <img src={art} alt="" className="size-full scale-[1.08] object-cover" draggable={false} />
      ) : (
        <span className="font-head font-extrabold text-bone" style={{ fontSize: Math.round(size * 0.42) }}>
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export const MONSTER_RING = '#4a4038';
export const BOSS_RING = '#c9a24a';
