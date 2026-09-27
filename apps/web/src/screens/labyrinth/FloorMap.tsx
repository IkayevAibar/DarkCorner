import type { Exit, LabyrinthView } from '@dark/shared';
import { useI18n } from '../../i18n';

type MapView = NonNullable<LabyrinthView['map']>;
type MapRoom = MapView['rooms'][number];

const CELL = 10;
const ROOM = 7;

/**
 * The Hero's own Map of a Floor: Rooms stood in, the unknown Rooms next to them,
 * and the Doors between. Everything else stays in the fog. Tapping a Room behind
 * one of the current Doors moves there.
 *
 * Stand-in drawing until Codex's Floor map lands (docs/tasks/codex-04-floor-map.md).
 */
export function FloorMap({ width, height, map, current, banner, exits, disabled, onMove }: {
  width: number;
  height: number;
  map: MapView;
  current: number;
  banner: string;
  exits: Exit[];
  disabled: boolean;
  onMove: (to: number) => void;
}) {
  const { t } = useI18n();
  const byId = new Map(map.rooms.map((r) => [r.id, r]));
  const exitTo = new Map(exits.map((e) => [e.to, e]));
  const mid = (r: MapRoom) => ({ x: r.x * CELL + CELL / 2, y: r.y * CELL + CELL / 2 });
  const view = frame(map.rooms, width, height);

  return (
    <svg
      viewBox={`${view.x * CELL - 1} ${view.y * CELL - 1} ${view.w * CELL + 2} ${view.h * CELL + 2}`}
      className="block max-h-[420px] w-full select-none"
      role="img"
      aria-label={t('lab.mapLabel')}
    >
      <defs>
        <pattern id="fog" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <circle cx={CELL / 2} cy={CELL / 2} r={0.35} fill="#3a3026" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={width * CELL} height={height * CELL} fill="url(#fog)" />

      {map.doors.map((d) => {
        const a = byId.get(d.a);
        const b = byId.get(d.b);
        if (!a || !b) return null;
        const p = mid(a);
        const q = mid(b);
        return (
          <line
            key={`${d.a}-${d.b}`}
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke={d.kind === 'locked' ? '#c9a24a' : d.kind === 'cracked' ? '#8a7a60' : '#6e5530'}
            strokeWidth={d.kind === 'open' ? 1.6 : 1.2}
            strokeDasharray={d.kind === 'cracked' ? '0.8 0.8' : d.kind === 'locked' ? '1.6 0.6' : undefined}
          />
        );
      })}

      {map.rooms.map((r) => {
        const exit = exitTo.get(r.id);
        const tappable = !disabled && exit?.passable === true;
        const here = r.id === current;
        const x = r.x * CELL + (CELL - ROOM) / 2;
        const y = r.y * CELL + (CELL - ROOM) / 2;
        return (
          <g
            key={r.id}
            onClick={tappable ? () => onMove(r.id) : undefined}
            className={tappable ? 'cursor-pointer' : undefined}
            role={tappable ? 'button' : undefined}
            aria-label={tappable ? t(`dir.${exit!.direction}`) : undefined}
          >
            {here && <rect x={x - 1} y={y - 1} width={ROOM + 2} height={ROOM + 2} rx={1.2} fill="none" stroke="#e0b86a" strokeWidth={0.5} opacity={0.5} />}
            <rect
              x={x} y={y} width={ROOM} height={ROOM} rx={0.7}
              fill={r.visited ? '#241d16' : '#0f0d0b'}
              stroke={here ? '#e0b86a' : tappable ? '#9b7a3e' : r.visited ? '#5e4a2a' : '#3a3026'}
              strokeWidth={here ? 0.7 : 0.45}
              strokeDasharray={r.visited ? undefined : '1 0.7'}
            />
            {r.visited ? <Glyph room={r} cx={x + ROOM / 2} cy={y + ROOM / 2} /> : (
              <text x={x + ROOM / 2} y={y + ROOM / 2 + 1.3} textAnchor="middle" fontSize={3.6} fill="#5e4a2a" fontFamily="var(--font-head)">?</text>
            )}
            {here && <circle cx={x + ROOM - 1.3} cy={y + 1.3} r={1.1} fill={banner} stroke="#000" strokeWidth={0.3} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Grid cells to show: what is known plus a margin, at least MIN_SPAN wide and tall, inside the Floor. */
const MARGIN = 1;
const MIN_SPAN = 6;
function frame(rooms: MapRoom[], width: number, height: number) {
  const axis = (values: number[], size: number) => {
    const want = Math.min(MIN_SPAN, size);
    let lo = Math.max(0, Math.min(...values) - MARGIN);
    let hi = Math.min(size - 1, Math.max(...values) + MARGIN);
    while (hi - lo + 1 < want) {
      if (lo > 0) lo--;
      if (hi - lo + 1 < want && hi < size - 1) hi++;
    }
    return { start: lo, span: hi - lo + 1 };
  };
  if (rooms.length === 0) return { x: 0, y: 0, w: width, h: height };
  const x = axis(rooms.map((r) => r.x), width);
  const y = axis(rooms.map((r) => r.y), height);
  return { x: x.start, y: y.start, w: x.span, h: y.span };
}

/** A small mark for what a Room holds. */
function Glyph({ room, cx, cy }: { room: MapRoom; cx: number; cy: number }) {
  const dim = room.cleared;
  switch (room.type) {
    case 'stairs':
      return <path d={`M${cx - 2} ${cy - 1.3} h4 l-2 2.8 z`} fill="#c9a96a" />;
    case 'waypoint':
      return <path d={`M${cx} ${cy - 2.2} l2 2.2 -2 2.2 -2 -2.2 z`} fill="#5fb3c9" />;
    case 'camp':
      return <path d={`M${cx - 2} ${cy + 1.6} l2 -3.4 2 3.4 z`} fill="#d98a3a" />;
    case 'landing':
      return <circle cx={cx} cy={cy} r={1.6} fill="none" stroke="#c9a96a" strokeWidth={0.5} />;
    case 'treasure':
      return <circle cx={cx} cy={cy} r={1.4} fill={dim ? '#5e4a2a' : '#e0b86a'} />;
    case 'vault':
      return <rect x={cx - 1.6} y={cy - 1.6} width={3.2} height={3.2} fill="none" stroke="#e0b86a" strokeWidth={0.6} />;
    case 'event':
      return <text x={cx} y={cy + 1.4} textAnchor="middle" fontSize={4} fontWeight={800} fill="#c9a96a" fontFamily="var(--font-head)">!</text>;
    case 'miniboss':
      return <circle cx={cx} cy={cy} r={1.7} fill="#9e2020" stroke="#000" strokeWidth={0.3} />;
    case 'boss':
      return <circle cx={cx} cy={cy} r={2.3} fill="#9e2020" stroke="#e0b86a" strokeWidth={0.5} />;
    case 'fight':
      return (
        <path
          d={`M${cx - 1.5} ${cy - 1.5} L${cx + 1.5} ${cy + 1.5} M${cx + 1.5} ${cy - 1.5} L${cx - 1.5} ${cy + 1.5}`}
          stroke={dim ? '#5e4a2a' : '#b23a2a'}
          strokeWidth={0.7}
          strokeLinecap="round"
        />
      );
    default:
      return null;
  }
}
