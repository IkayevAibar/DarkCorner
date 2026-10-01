import type { Direction, Exit } from '@dark/shared';
import { TwinMark } from '../../components/TwinMark';
import { useMapText } from '../../components/map/text';

const MARKER_PLACE: Record<Direction, string> = {
  n: 'top-[70px] left-1/2 -translate-x-1/2',
  s: 'bottom-[62px] left-1/2 -translate-x-1/2',
  e: 'right-1.5 top-1/2 -translate-y-1/2',
  w: 'left-1.5 top-1/2 -translate-y-1/2',
};
const ARROW: Record<Direction, string> = { n: 'M6 15l6-6 6 6', s: 'M6 9l6 6 6-6', e: 'M9 6l6 6-6 6', w: 'M15 6l-6 6 6 6' };

/** A Door on the Room map itself, where the art has its openings. */
export function DoorMarker({ exit, disabled, onMove }: { exit: Exit; disabled: boolean; onMove: (to: number) => void }) {
  const { t } = useMapText();
  return (
    <button
      type="button"
      aria-label={`${t(`dir.${exit.direction}`)}${exit.kind === 'twin' ? ` · ${t('twin')}` : ''}`}
      disabled={disabled || !exit.passable}
      onClick={() => onMove(exit.to)}
      className={`absolute grid size-11 place-items-center rounded-full border-2 bg-black/70 p-0 shadow-[0_0_0_1px_#000] transition-transform active:scale-95 disabled:opacity-40 ${
        MARKER_PLACE[exit.direction]
      } ${exit.kind === 'secret' ? 'border-dashed border-tier-epic text-tier-epic' : exit.kind === 'locked' || exit.kind === 'twin' ? 'border-[#c9a24a] text-[#e8cf9a]' : exit.visited ? 'border-bone/40 text-bone/70' : 'border-gold text-gold'}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {exit.kind === 'twin' ? <TwinMark /> : <path d={ARROW[exit.direction]} />}
      </svg>
      {exit.suspicious && (
        <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-tier-mythic font-head text-[11px] font-extrabold text-black">!</span>
      )}
    </button>
  );
}

