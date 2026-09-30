import { useState } from 'react';
import { FloorMap } from '../../components/map/FloorMap';
import { MiniMap } from '../../components/map/MiniMap';
import { useMapText } from '../../components/map/text';
import { CenterModal } from '../../components/CenterModal';
import { MAPS, exitsFor, type MapExample } from './mapExamples';
import './MapPreview.css';

function Example({ example }: { example: MapExample }) {
  const { t } = useMapText();
  const [current, setCurrent] = useState(example.current);
  const [map, setMap] = useState(example.id === 'lair' ? example.revealed : example.map);
  const [open, setOpen] = useState(false);
  const exits = exitsFor(map, current);
  const move = (to: number) => {
    setCurrent(to);
    setMap(value => ({ ...value, rooms: value.rooms.map(r => r.id === to ? { ...r, type: r.type ?? 'empty', visited: true } : r) }));
  };
  const props = { width: example.width, height: example.height, map, current, banner: '#669baa', exits, disabled: false, onMove: move };
  return <article className="map-preview-card" data-map-fixture={example.id}>
    <h3>{t(example.id)}</h3><FloorMap {...props} />
    <div className="map-preview-stage"><MiniMap {...props} onOpen={() => setOpen(true)} /></div>
    <div className="map-preview-controls">
      <button className="btn btn-small" onClick={() => exits[0] && move(exits[0].to)}>{t('walk')}</button>
      <button className="btn btn-small" onClick={() => move(map.rooms.find(r => Math.abs(r.x - map.rooms.find(r => r.id === current)!.x) + Math.abs(r.y - map.rooms.find(r => r.id === current)!.y) > 1)?.id ?? example.current)}>{t('portal')}</button>
      <button className="btn btn-small" onClick={() => setMap(example.revealed)}>{t('reveal')}</button>
      <button className="btn btn-small" onClick={() => { setMap(example.map); setCurrent(example.current); }}>{t('reset')}</button>
    </div>
    {open && <CenterModal onClose={() => setOpen(false)} width={520} label={t('lab.mapLabel')} head={t('lab.mapLabel')}><FloorMap {...props} /></CenterModal>}
  </article>;
}
export function MapPreview() {
  const { t } = useMapText();
  return <section className="map-preview"><h2 className="sub-heading m-0">{t('preview')}</h2>
    <div className="map-preview-list">{MAPS.map(example => <Example key={example.id} example={example} />)}</div>
  </section>;
}
