import { ROOM_TYPES } from '@dark/shared';
import { useId } from 'react';
import { DoorGlyph, Glyph } from './Glyph';
import { MapDrawing } from './MapDrawing';
import type { MapProps } from './geometry';
import { useMapText } from './text';

export function FloorMap(props: MapProps) {
  const { t } = useMapText();
  const legendId = useId();
  return <div className="floor-map">
    <div className="map-sheet"><MapDrawing {...props} />
      <details className="map-legend">
        <summary aria-label={t('legend')} aria-controls={legendId}>?</summary>
        <div id={legendId} className="map-legend-body">
          <strong>{t('legend')}</strong>
          <ul>{ROOM_TYPES.map(type => <li key={type}><svg viewBox="-17 -17 34 34" className={`map-glyph map-glyph-${type}`} aria-hidden="true"><Glyph type={type} /></svg><span>{t(`room.${type}`)}</span></li>)}
            {(['open', 'locked', 'cracked', 'secret', 'twin'] as const).map(kind => <li key={kind}>
              <svg viewBox="-17 -17 34 34" className={`map-door map-door-${kind}`} aria-hidden="true"><path d="M-15 0 H15" className="map-passage" /><DoorGlyph kind={kind} /></svg><span>{t(kind)}</span>
            </li>)}
            <li><i className="map-legend-token" style={{ background: props.banner }} /><span>{t('here')}</span></li>
            <li><i className="map-legend-unknown" /><span>{t('unknown')}</span></li>
            <li><i className="map-legend-cleared">×</i><span>{t('cleared')}</span></li>
            <li><i className="map-legend-revealed" /><span>{t('revealed')}</span></li>
            <li><i className="map-legend-free" /><span>{t('free')}</span></li>
          </ul>
        </div>
      </details>
    </div>
    <nav className="map-exits" aria-label={t('exits')}>
      {props.exits.map(exit => <button type="button" key={exit.to} className="map-exit-button" disabled={props.disabled || !exit.passable}
        onClick={() => props.onMove(exit.to)}>
        <span aria-hidden="true" className="map-direction">{{ n: '↑', s: '↓', e: '→', w: '←' }[exit.direction]}</span>
        <span><b>{t(`dir.${exit.direction}`)}</b><small>{exit.kind === 'open' ? (exit.free ? t('free') : t('open')) : t(exit.kind)}{exit.kind !== 'open' && exit.free ? ` · ${t('free')}` : ''}</small></span>
      </button>)}
    </nav>
  </div>;
}
