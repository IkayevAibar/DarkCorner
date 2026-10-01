import type { MapDoor, MapRoom } from './geometry';
import { TwinMark } from '../TwinMark';
import { OathMark } from '../OathMark';

/** Small ink silhouettes use shape as well as color: readable without a color key. */
export function Glyph({ type }: { type: MapRoom['type'] }) {
  switch (type) {
    case 'landing': return <><path d="M-9 8 V-3 Q0-17 9-3 V8 M-5 8 V-2 Q0-9 5-2 V8" /><path d="M-12 9 H12" /></>;
    case 'stairs': return <><path d="M-11-8 H-4 V-2 H3 V4 H10 V10 H-11 Z" /><path d="M3-9 L10-2 M6-2 H10 V-6" /></>;
    case 'waypoint': return <><path d="M0-13 L7-5 5 9 H-5 L-7-5 Z" /><path d="M-10 11 H10 M0-7 V4 M-3-1 H3" /></>;
    case 'camp': return <><path d="M-12 10 L0-10 12 10 Z M-4 10 L0 2 4 10 M0-10 V-14" /><path d="M-14 12 H14" /></>;
    case 'fight': return <><path d="M-10-12 L1-4 8 7 4 10-5 0 Z M10-12 L-1-4-8 7-4 10 5 0 Z" /><path d="M-11 4 L-3 12 M3 12 L11 4" /></>;
    case 'empty': return <path d="M-9 8 H9 M-6 4 H6 M-2 0 H2" />;
    case 'event': return <><path d="M0-12 L3-3 11 0 3 3 0 12-3 3-11 0-3-3 Z" /><circle r="2" /></>;
    case 'treasure': return <><path d="M-11-4 Q0-13 11-4 V9 H-11 Z M-11 0 H11" /><path d="M-2-2 H2 V4 H-2 Z M-7 3 V7 M7 3 V7" /></>;
    case 'vault': return <><path d="M-11-11 H11 V11 H-11 Z M-7-7 H7 V7 H-7 Z" /><circle r="3" /><path d="M0-5 V5 M-5 0 H5" /></>;
    case 'hidden': return <><path d="M-13 0 Q0-15 13 0 Q0 15-13 0 Z" /><path d="M0-6 L4 0 0 6-4 0 Z" /></>;
    case 'twin': return <><path d="M-13 14H13M-10 11H10" /><g transform="translate(-12 -14)"><TwinMark /></g></>;
    case 'oathstone': return <g transform="translate(-12 -12)"><OathMark /></g>;
    case 'miniboss': return <><path d="M-8 1 Q-13-12 0-11 Q13-12 8 1 L5 4 V10 H-5 V4 Z" /><path d="M-5-2 H-2 M2-2 H5 M0 4 V10" /></>;
    case 'boss': return <><path d="M-3 11 L-10 2-13-10-5-5 0-13 5-5 13-10 10 2 3 11 Z" /><path d="M-7-1 L-3 1 M3 1 L7-1 M0 4 V9" /></>;
    default: return null;
  }
}

export function DoorGlyph({ kind }: { kind: MapDoor['kind'] }) {
  if (kind === 'locked') return <g className="map-lock"><path d="M-3-1 V-4 A3 3 0 0 1 3-4 V-1" /><path d="M-5-1 H5 V6 H-5 Z" /><path d="M0 1 V4" /></g>;
  if (kind === 'cracked') return <g className="map-crack"><path d="M-5-7 L1-3-2 1 4 7 M1-3 L6-5 M-2 1 L-6 4" /></g>;
  if (kind === 'twin') return <g className="map-twin"><circle r="9" /><g transform="translate(-7 -7) scale(.5833)"><TwinMark /></g></g>;
  return null;
}
