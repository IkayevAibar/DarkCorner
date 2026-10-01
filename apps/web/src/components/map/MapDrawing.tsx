import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CELL, canSlide, center, doorKey, frame, reveals, type MapProps, type MapView } from './geometry';
import { DoorGlyph, Glyph } from './Glyph';
import { useMapText } from './text';
import './map.css';

type DrawingProps = Pick<MapProps, 'map' | 'current' | 'banner' | 'exits'> & Partial<Pick<MapProps, 'width' | 'height' | 'disabled' | 'onMove'>> & { mini?: boolean };

function useMotion(map: MapView, current: number) {
  const [snapshot, setSnapshot] = useState({ map, current, revision: 0, slide: false,
    rooms: new Map<number, number>(), doors: new Set<string>() });
  if (snapshot.map !== map || snapshot.current !== current) {
    const oldDoors = new Set(snapshot.map.doors.map(doorKey));
    const next = { map, current, revision: snapshot.revision + 1,
      slide: snapshot.current === current || canSlide(map, snapshot.current, current),
      rooms: reveals(snapshot.map, map, current),
      doors: new Set(map.doors.filter(d => d.kind === 'secret' && !oldDoors.has(doorKey(d))).map(doorKey)),
    };
    setSnapshot(next);
    return next;
  }
  return snapshot;
}

export function MapDrawing({ map, current, banner, exits, width = 10, height = 10, disabled, onMove, mini = false }: DrawingProps) {
  const { t } = useMapText();
  const id = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const [pixels, setPixels] = useState({ width: 320, height: 320 });
  useLayoutEffect(() => {
    if (mini || !svg.current) return;
    const resize = new ResizeObserver(([entry]) => { if (entry) setPixels({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    resize.observe(svg.current);
    return () => resize.disconnect();
  }, [mini]);
  const motion = useMotion(map, current);
  const byId = new Map(map.rooms.map(r => [r.id, r]));
  const exitTo = new Map(exits.map(e => [e.to, e]));
  const view = frame(map.rooms, width, height);
  const here = byId.get(current);
  const point = here ? center(here) : { x: CELL / 2, y: CELL / 2 };
  const canvas = mini ? { x: 0, y: 0, w: CELL * 4, h: CELL * 4 }
    : { x: view.x * CELL, y: view.y * CELL, w: view.w * CELL, h: view.h * CELL };
  const hitRadius = Math.max(20, 22 * Math.max(canvas.w / Math.max(1, pixels.width), canvas.h / Math.max(1, pixels.height)));
  const move = (to: number) => { if (!disabled && exitTo.get(to)?.passable) onMove?.(to); };
  return <svg ref={svg} className={`floor-drawing${mini ? ' floor-drawing-mini' : ''}`}
    viewBox={`${canvas.x} ${canvas.y} ${canvas.w} ${canvas.h}`}
    role={mini ? undefined : 'group'} aria-hidden={mini || undefined} aria-label={mini ? undefined : t('lab.mapLabel')}>
    <defs>
      <pattern id={`${id}-grain`} width="12" height="14" patternUnits="userSpaceOnUse">
        <path d="M1 3 L3 2 M8 11 L10 12" stroke="#99866b" strokeWidth=".6" opacity=".17" />
      </pattern>
      <radialGradient id={`${id}-edge`}><stop offset="60%" stopColor="#100e0c" stopOpacity="0" /><stop offset="100%" stopColor="#100e0c" stopOpacity=".7" /></radialGradient>
    </defs>
    <rect x={canvas.x} y={canvas.y} width={canvas.w} height={canvas.h} fill="#191815" />
    <g className={mini && motion.slide ? 'map-camera map-walking' : 'map-camera'}
      style={mini ? { transform: `translate(${CELL * 2 - point.x}px, ${CELL * 2 - point.y}px)` } : undefined}>
      {/* Ragged outlines are deterministic ink, not a filter or a raster dependency. */}
      {map.rooms.map(r => <path key={`fog-${r.id}`} transform={`translate(${center(r).x} ${center(r).y})`}
        d="M-29-17 L-24-25-14-27-7-30 5-26 19-28 25-20 30-11 27 1 30 15 23 23 11 27 0 25-13 29-23 22-28 12-25 1 Z"
        fill={r.visited ? '#312e26' : '#22221d'} opacity={r.visited ? .85 : .6} />)}
      {map.doors.map(d => {
        const a = byId.get(d.a), b = byId.get(d.b);
        if (!a || !b) return null;
        const p = center(a), q = center(b), key = doorKey(d);
        const newly = mini && motion.doors.has(key);
        return <g key={`${key}-${newly ? motion.revision : 'known'}`} className={`map-door map-door-${d.kind}${newly ? ' map-door-new' : ''}`} data-door={key}>
          <path d={`M${p.x} ${p.y} L${q.x} ${q.y}`} className="map-passage-edge" />
          <path d={`M${p.x} ${p.y} L${q.x} ${q.y}`} className="map-passage" />
          {d.kind !== 'twin' && <g transform={`translate(${(p.x + q.x) / 2} ${(p.y + q.y) / 2})`}><DoorGlyph kind={d.kind} /></g>}
        </g>;
      })}
      {map.rooms.map(r => {
        const p = center(r), exit = exitTo.get(r.id), active = exit?.passable && !disabled;
        const fresh = mini && motion.rooms.has(r.id);
        const roomLabel = r.type ? t(`room.${r.type}`) : t('unknown');
        const dim = r.cleared && ['fight', 'treasure', 'vault', 'hidden', 'miniboss', 'boss', 'twin', 'oathstone'].includes(r.type ?? '');
        return <g key={r.id} transform={`translate(${p.x} ${p.y})`} data-room={r.id}>
          <g key={fresh ? motion.revision : 'known'} className={`map-room${r.visited ? ' map-visited' : ''}${r.id === current ? ' map-here' : ''}${active ? ' map-exit' : ''}${fresh ? ' map-uncover' : ''}`}
            style={{ '--reveal-delay': `${motion.rooms.get(r.id) ?? 0}ms` } as CSSProperties}>
            <path className="map-room-shadow" d="M-17-16 L15-18 18-13 17 17-15 18-18 13 Z" transform="translate(1 2)" />
            <path className="map-room-wall" d={`M-17-16 L${r.id % 2 ? 14 : 16}-18 18-13 17 17-15 18-18 13 Z`} />
            {r.type && <g className={`map-glyph map-glyph-${r.type}${dim ? ' map-cleared' : ''}`}><Glyph type={r.type} /></g>}
            {!r.visited && r.type && <path className="map-revealed" d="M-12 14 H12" />}
            {exit?.free && <circle className="map-free-dot" cx="-14" cy="-14" r="2.5" />}
          </g>
          {!mini && <title>{roomLabel}{dim ? ` · ${t(r.type === 'twin' || r.type === 'oathstone' ? 'room.clearedWeek' : 'room.cleared')}` : ''}</title>}
          {!mini && exit && <circle className="map-hit" r={hitRadius} role="button" tabIndex={active ? 0 : -1}
            aria-disabled={!active} aria-label={`${t(`dir.${exit.direction}`)} · ${roomLabel}${exit.free ? ` · ${t('free')}` : ''}`}
            onClick={() => move(r.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); move(r.id); } }} />}
        </g>;
      })}
      {/* The split seal sits over the wall edges so neither half disappears in a narrow passage. */}
      {map.doors.filter(d => d.kind === 'twin').map(d => {
        const a = byId.get(d.a), b = byId.get(d.b);
        if (!a || !b) return null;
        const p = center(a), q = center(b);
        return <g key={doorKey(d)} className="map-overlay" transform={`translate(${(p.x + q.x) / 2} ${(p.y + q.y) / 2})`}><DoorGlyph kind="twin" /></g>;
      })}
      {here && <g className={`map-token${mini && motion.slide ? ' map-walking' : ''}`}
        style={{ transform: `translate(${point.x + 13}px, ${point.y - 13}px)` }} data-current={current}>
        <g key={mini && !motion.slide ? motion.revision : 'walk'} className={mini && !motion.slide ? 'map-arrival' : undefined}>
          <circle r="8" fill="#100d09" stroke="#e8d9ad" strokeWidth="1.5" />
          <circle r="5.3" fill={banner} stroke="#0a0907" strokeWidth="1.5" />
          <path d="M-2-2 L1-3" stroke="#fff6dd" strokeWidth="1.5" />
        </g>
      </g>}
    </g>
    {mini && !motion.slide && motion.revision > 0 && <g key={`depart-${motion.revision}`} className="map-departure" transform={`translate(${CELL * 2 + 13} ${CELL * 2 - 13})`}>
      <circle r="8" fill="#100d09" stroke="#e8d9ad" strokeWidth="1.5" /><circle r="5.3" fill={banner} stroke="#0a0907" strokeWidth="1.5" />
    </g>}
    <rect className="map-overlay" x={canvas.x} y={canvas.y} width={canvas.w} height={canvas.h} fill={`url(#${id}-grain)`} />
    <rect className="map-overlay" x={canvas.x} y={canvas.y} width={canvas.w} height={canvas.h} fill={`url(#${id}-edge)`} />
  </svg>;
}
