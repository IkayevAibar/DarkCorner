import type { DuoPartner, LabyrinthView } from '@dark/shared';
import { Token } from './Token';
import { TwinMark } from './TwinMark';
import './bond.css';

export type HeroPortrait = Pick<LabyrinthView['hero'], 'name' | 'portraitUrl' | 'banner'>;

export function BondedPortraits({ hero, partner, size }: { hero: HeroPortrait; partner: DuoPartner; size: number }) {
  return <span className="bond-portraits" data-bonded={partner.bonded || undefined}>
    <Token art={hero.portraitUrl} label={hero.name} ring={hero.banner} size={size} />
    {partner.bonded && <svg className="bond-link" viewBox="-12 0 48 24" aria-hidden="true">
      <path d="M-12 12H3M21 12H36" fill="none" stroke="currentColor" strokeWidth="1.5" /><TwinMark />
    </svg>}
    <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={Math.round(size * .78)} className={partner.online ? '' : 'opacity-60'} />
  </span>;
}
