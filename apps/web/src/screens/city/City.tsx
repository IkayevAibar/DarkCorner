import { NavLink } from 'react-router';
import { iconSvg } from '../../components/items/icons';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';

const BUILDINGS: { to: string; icon: string; name: MessageKey; blurb: MessageKey }[] = [
  { to: '/city/tavern', icon: 'potion', name: 'city.tavern', blurb: 'city.tavern.blurb' },
  { to: '/city/shop', icon: 'chest', name: 'city.shop', blurb: 'city.shop.blurb' },
  { to: '/city/forge', icon: 'mace', name: 'city.forge', blurb: 'city.forge.blurb' },
  { to: '/city/market', icon: 'key', name: 'city.market', blurb: 'city.market.blurb' },
  { to: '/city/temple', icon: 'holy-symbol', name: 'city.temple', blurb: 'city.temple.blurb' },
  { to: '/labyrinth', icon: 'sword', name: 'city.gate', blurb: 'city.gate.blurb' },
];

/**
 * The City: the map, and its Buildings as cards until Codex's map with pins lands
 * (docs/plan-season-0.md, week 5).
 */
export function City() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <div className="mx-1 overflow-hidden rounded-sm border border-[#6e5530] bg-black shadow-[0_0_0_1px_#000,0_14px_34px_rgb(0_0_0/0.7)]">
        <img src="/art/city-map.jpg" alt={t('tab.city')} className="block h-auto w-full" draggable={false} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {BUILDINGS.map((b) => (
          <NavLink key={b.to} to={b.to} className="panel grid gap-1 p-3 text-bone no-underline active:translate-y-px">
            <span className="flex items-center gap-2 font-head text-lg font-extrabold">
              <svg viewBox="0 0 64 64" fill="currentColor" className="size-6 text-gold" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(b.icon) }} />
              {t(b.name)}
            </span>
            <span className="text-sm leading-snug text-muted">{t(b.blurb)}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
