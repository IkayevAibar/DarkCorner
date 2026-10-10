import type { DuoPartner } from '@dark/shared';
import { useI18n } from '../i18n';
import { Token } from './Token';
import { BondedPortraits, type HeroPortrait } from './BondedPortraits';
import { TwinMark } from './TwinMark';

/** Presentational partner strip; leaving the Duo remains the screen's API action. */
export function DuoStrip({ hero, partner, busy, onLeave }: { hero: HeroPortrait; partner: DuoPartner; busy: boolean; onLeave: () => void }) {
  const { t } = useI18n();
  return <section className="grid gap-1.5 rounded-[2px] border border-line bg-[rgb(22_18_14/0.7)] p-2">
    <div className="flex items-center gap-2.5">
      {partner.bonded ? <BondedPortraits hero={hero} partner={partner} size={36} />
        : <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={36} />}
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-head font-bold">{t('duo.with', { name: partner.name })}</span>
          {/* Solo, the partner is the Companion: always there, and let go at the Tavern. */}
          {!__SOLO__ && <span className={`shrink-0 text-xs ${partner.online ? 'text-tier-uncommon' : 'text-[#ff9a8a]'}`}>{partner.online ? t('duo.online') : t('duo.away')}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] leading-none text-muted tabular-nums">
          <div className="h-[5px] flex-1 border border-black bg-[#2a211a]">
            <div className="h-full bg-[#c23030]" style={{ width: `${Math.round((partner.hp / Math.max(1, partner.maxHp)) * 100)}%` }} />
          </div>
          <span>{partner.hp}/{partner.maxHp}</span><span>· {t('hero.stamina')} {partner.stamina}</span>
        </div>
      </div>
      {!partner.bonded && !__SOLO__ && <button type="button" className="btn btn-small shrink-0" disabled={busy} onClick={onLeave}>{t('duo.leave')}</button>}
    </div>
    {partner.bonded && <div className="bond-footer"><p className="bond-note"><svg viewBox="0 0 24 24" aria-hidden="true"><TwinMark /></svg>{t('duo.bonded')}</p>{!__SOLO__ && <button type="button" className="btn btn-small" disabled={busy} onClick={onLeave}>{t('duo.leave')}</button>}</div>}
    {!partner.online && <p className="m-0 text-sm text-[#ff9a8a]">{t('duo.awayNote', { name: partner.name })}</p>}
  </section>;
}
