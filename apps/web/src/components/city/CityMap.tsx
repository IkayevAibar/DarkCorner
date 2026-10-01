import { NavLink } from 'react-router';
import type { SeasonView } from '@dark/shared';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { useNow } from '../../time';
import { BUILDING_ICONS, type BuildingIcon } from '../buildingIcons';
import { ICON_VIEWBOX } from '../items/icons';
import './city.css';

interface Building {
  id: BuildingIcon;
  to: string;
  name: MessageKey;
  blurb: MessageKey;
  /** Anchor on the uncropped map, in fractions of its width and height. */
  x: number;
  y: number;
}

// Roof/entrance anchors from the look test's 1024 × 1536 City illustration.
const BUILDINGS: Building[] = [
  { id: 'tavern', to: '/city/tavern', name: 'city.tavern', blurb: 'city.tavern.blurb', x: .52, y: .385 },
  { id: 'shop', to: '/city/shop', name: 'city.shop', blurb: 'city.shop.blurb', x: .255, y: .555 },
  { id: 'forge', to: '/city/forge', name: 'city.forge', blurb: 'city.forge.blurb', x: .835, y: .415 },
  { id: 'market', to: '/city/market', name: 'city.market', blurb: 'city.market.blurb', x: .23, y: .385 },
  { id: 'temple', to: '/city/temple', name: 'city.temple', blurb: 'city.temple.blurb', x: .63, y: .125 },
  { id: 'academy', to: '/city/academy', name: 'city.academy', blurb: 'city.academy.blurb', x: .39, y: .19 },
  { id: 'training', to: '/city/training', name: 'city.training', blurb: 'city.training.blurb', x: .57, y: .67 },
  { id: 'well', to: '/city/delve', name: 'city.well', blurb: 'city.well.blurb', x: .865, y: .6 },
  { id: 'gate', to: '/labyrinth', name: 'city.gate', blurb: 'city.gate.blurb', x: .5, y: .795 },
];

const TORCHES = [[.373, .80], [.64, .80], [.43, .871], [.576, .871], [.565, .557], [.642, .553], [.57, .214]] as const;

function BuildingIconView({ name }: { name: BuildingIcon }) {
  return <svg viewBox={ICON_VIEWBOX} fill="currentColor" aria-hidden="true"><path d={BUILDING_ICONS[name]} /></svg>;
}

function StatusIcon({ kind }: { kind: 'flame' | 'crown' | 'lock' }) {
  const paths = {
    flame: 'M13 2c1 6-5 6-3 11 2-1 3-3 3-5 5 4 7 7 5 11-2 4-10 4-12-1C3 12 8 9 8 6c1 2 2 2 2 3 2-2 3-4 3-7Z',
    crown: 'M3 6l4 4 5-7 5 7 4-4-2 13H5L3 6Zm2 16h14',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

/** Visual only: the server's Season determines pin state; navigation uses existing routes. */
export function CityMap({ season }: { season: SeasonView | null }) {
  const { t } = useI18n();
  const now = useNow(30_000);
  const gateClosed = season?.status === 'planned';
  const badge = season?.status === 'finale' ? 'crown'
    : season?.status === 'active' && season.bossGateAt !== null && Date.parse(season.bossGateAt) <= now ? 'flame' : null;
  const badgeLabel = badge === 'crown' ? t('city.finale') : badge === 'flame' ? t('city.bossGateOpen') : null;

  return (
    <div className="city-content">
      <nav className="city-map" aria-label={t('city.map')}>
        <img src="/art/city-map.jpg" alt="" width={1024} height={1536} draggable={false} />
        <div className="city-atmosphere" aria-hidden="true">
          <span className="city-fog" />
          <span className="city-fog city-fog-back" />
          {TORCHES.map(([x, y], i) => <span key={i} className="city-torch" style={{ left: `${x * 100}%`, top: `${y * 100}%`, animationDelay: `${-i * .37}s` }} />)}
        </div>
        {BUILDINGS.map((b) => {
          const closed = b.id === 'gate' && gateClosed;
          const attention = b.id === 'tavern' && badge;
          const label = `${t(b.name)}${closed ? ` · ${t('city.gate.closed')}` : attention ? ` · ${badgeLabel}` : ''}`;
          const content = <>
            <span className="city-pin-label">
              <BuildingIconView name={b.id} />
              <span>{t(b.name)}</span>
              {closed && <StatusIcon kind="lock" />}
            </span>
            {attention && <span className="city-pin-badge" data-badge={badge} aria-hidden="true"><StatusIcon kind={badge} /></span>}
          </>;
          const props = {
            className: `city-pin${closed ? ' city-pin-closed' : ''}`,
            style: { left: `${b.x * 100}%`, top: `${b.y * 100}%` },
            'aria-label': label,
            title: label,
          };
          return closed
            ? <button key={b.id} {...props} type="button" aria-disabled="true" aria-describedby="city-gate-note">{content}</button>
            : <NavLink key={b.id} {...props} to={b.to}>{content}</NavLink>;
        })}
      </nav>
      <section className="city-directory" aria-labelledby="city-buildings-title">
        <div className="city-directory-heading">
          <h2 id="city-buildings-title" className="sub-heading m-0">{t('city.buildings')}</h2>
          <p className="m-0 text-sm text-muted">{t('city.choose')}</p>
        </div>
        {(gateClosed || badgeLabel) && <p id={gateClosed ? 'city-gate-note' : undefined} className="city-season-note" role="status">
          <StatusIcon kind={gateClosed ? 'lock' : badge!} />
          {gateClosed ? t('tavern.notStarted') : badgeLabel}
        </p>}
        <ul className="city-building-list">
          {BUILDINGS.map((b) => {
            const closed = b.id === 'gate' && gateClosed;
            const content = <>
              <span className="city-card-title"><BuildingIconView name={b.id} />{t(b.name)}</span>
              <span className="text-sm leading-snug text-muted">{closed ? t('tavern.notStarted') : t(b.blurb)}</span>
              {b.id === 'tavern' && badgeLabel && <span className="city-card-notice"><StatusIcon kind={badge!} />{badgeLabel}</span>}
            </>;
            return <li key={b.id}>{closed
              ? <div className="panel city-building-card city-card-closed" aria-disabled="true">{content}</div>
              : <NavLink to={b.to} className="panel city-building-card">{content}</NavLink>}</li>;
          })}
        </ul>
      </section>
    </div>
  );
}
