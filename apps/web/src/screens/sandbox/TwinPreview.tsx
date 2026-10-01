import { useState } from 'react';
import type { DuoPartner, FightReplay, ItemView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { DuoStrip } from '../../components/DuoStrip';
import { BondedPortraits } from '../../components/BondedPortraits';
import { Token } from '../../components/Token';
import { FloorMap } from '../../components/map/FloorMap';
import { MiniMap } from '../../components/map/MiniMap';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { useSheet } from '../../components/Sheet';
import { DoorMarker } from '../labyrinth/DoorMarker';
import { roomArt } from '../labyrinth/roomArt';
import { FIGHTS } from './fightExamples';
import { REVEALS } from './lootFixtures';
import { exitsFor } from './mapExamples';
import type { MapView } from '../../components/map/geometry';
import './TwinPreview.css';

const COPY = {
  en: { title: 'Twin doors & Bond rings', duo: 'Duo at the Door', solo: 'Solo at the Door', out: 'Leaving the Room alone', joined: 'Join the Bond rings', apart: 'Separate the Bond rings', own: 'Wardens fight · Hero', partner: 'Wardens fight · Partner', map: 'Floor map' },
  ru: { title: 'Парные двери и кольца уз', duo: 'Дуэт у двери', solo: 'У двери без напарника', out: 'Выход из комнаты без напарника', joined: 'Соединить кольца уз', apart: 'Разъединить кольца уз', own: 'Бой со стражами · герой', partner: 'Бой со стражами · напарник', map: 'Карта этажа' },
};
const HERO = { name: 'Garrick', portraitUrl: '/art/portraits/human-fighter-1.webp', banner: '#9e2a2a' };
const PARTNER: DuoPartner = { heroId: 'preview-partner', name: 'Ilyra', portraitUrl: '/art/portraits/elf-wizard-1.webp', banner: '#3b5fa8', class: 'wizard', level: 5,
  hp: 42, maxHp: 42, stamina: 18, online: true, seenAt: null, waypoints: [1], bonded: true };
const MAP: MapView = {
  rooms: [{ id: 11, x: 1, y: 2, type: 'treasure', visited: true, cleared: false }, { id: 12, x: 2, y: 2, type: 'empty', visited: true, cleared: true }, { id: 13, x: 3, y: 2, type: 'twin', visited: true, cleared: false }],
  doors: [{ a: 11, b: 12, kind: 'locked' }, { a: 12, b: 13, kind: 'twin' }],
};
const RINGS: ItemView[] = ['rare', 'epic'].map((tier, i) => ({ ...REVEALS.rare, id: `preview-bond-${i}`, base: 'bond-ring', tier: tier as 'rare' | 'epic',
  name: { en: 'Bond ring', ru: 'Кольцо уз' }, bonusStats: [{ en: '+2 Strength', ru: '+2 к силе' }, { en: '+3 Damage', ru: '+3 к урону' }],
  power: { en: `The other half belongs to ${i ? 'Garrick' : 'Ilyra'}. While a Duo wears both halves, their Bonus stats count twice in fights.`,
    ru: `Вторая половина у ${i ? 'Garrick' : 'Ilyra'}. Когда дуэт носит обе половины, их бонусы считаются дважды в боях.` },
}));

export function TwinPreview({ onFight }: { onFight: (replay: FightReplay) => void }) {
  const { locale, t } = useI18n(), copy = COPY[locale], text = useText(), { openSheet } = useSheet();
  const [mode, setMode] = useState<'duo' | 'solo' | 'out'>('duo'), [bonded, setBonded] = useState(true), [current, setCurrent] = useState(12), [mapOpen, setMapOpen] = useState(false);
  const partner = { ...PARTNER, bonded }, exits = exitsFor(MAP, current).map(exit => ({ ...exit, passable: exit.kind !== 'twin' || mode === 'duo' || current === 13 }));
  const props = { width: 5, height: 5, map: MAP, current, banner: HERO.banner, exits, disabled: false, onMove: setCurrent };
  return <section className="twin-preview" data-twin-preview>
    <h2 className="sub-heading m-0">{copy.title}</h2>
    <div className="twin-preview-controls">{(['duo', 'solo', 'out'] as const).map(value => <button className="btn btn-small" key={value} data-twin-mode={value} aria-pressed={value === mode} onClick={() => { setMode(value); setCurrent(value === 'out' ? 13 : 12); }}>{copy[value]}</button>)}</div>
    <div className="twin-preview-stage">
      <img {...roomArt('goblins-1')} alt="" />
      <span className="twin-preview-room">{t(current === 13 ? 'room.twin' : 'room.empty')}</span>
      <div className="twin-preview-mini"><MiniMap {...props} onOpen={() => setMapOpen(value => !value)} /></div>
      {exits.map(exit => <DoorMarker key={exit.to} exit={exit} disabled={false} onMove={setCurrent} />)}
      <div className="twin-preview-pair">{mode === 'duo' ? <BondedPortraits hero={HERO} partner={partner} size={72} /> : <Token art={HERO.portraitUrl} label={HERO.name} ring={HERO.banner} size={72} />}</div>
    </div>
    {mode === 'duo' && <><DuoStrip hero={HERO} partner={partner} busy={false} onLeave={() => setMode('solo')} /><button className="btn btn-small" data-bond-toggle aria-pressed={bonded} onClick={() => setBonded(value => !value)}>{bonded ? copy.apart : copy.joined}</button></>}
    <details open={mapOpen} onToggle={e => setMapOpen(e.currentTarget.open)}><summary>{copy.map}</summary><FloorMap {...props} /></details>
    <div className="twin-preview-bag"><strong>{t('lab.bagButton')}</strong>{[...RINGS, REVEALS.rare].map(item => <ItemChip key={item.id} item={item} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} />)}</div>
    <div className="twin-preview-controls"><button className="btn" data-twin-fight="hero" onClick={() => onFight(FIGHTS['duo-twin-wardens']!)}>{copy.own}</button><button className="btn" data-twin-fight="ally" onClick={() => onFight(FIGHTS['duo-twin-wardens-partner']!)}>{copy.partner}</button></div>
  </section>;
}
