import type { MapProps } from './geometry';
import { MapDrawing } from './MapDrawing';
import { useMapText } from './text';

/** Mount with key={floor.number}: a new Floor fades in even if Room ids repeat. */
export function MiniMap({ onOpen, ...props }: Pick<MapProps, 'map' | 'current' | 'banner' | 'exits'> & { onOpen: () => void }) {
  const { t } = useMapText();
  return <button type="button" className="mini-map" onClick={onOpen} aria-label={t('mini')}>
    <MapDrawing {...props} mini /><span className="mini-map-corner" aria-hidden="true">⌕</span>
  </button>;
}
