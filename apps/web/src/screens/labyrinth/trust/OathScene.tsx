import { useEffect, useState } from 'react';
import type { LabyrinthResult, OathView } from '@dark/shared';
import { PALM, FIST } from '../../../components/OathMark';
import { Token } from '../../../components/Token';
import type { HeroPortrait } from '../../../components/BondedPortraits';
import { useReducedMotion } from '../../../components/loot/motion';
import { play } from '../../../sound';
import { useTrustCopy } from './copy';
import './trust.css';

/** Settled choices only. The waiting scene never receives the partner's secret. */
export type SettledOath = NonNullable<LabyrinthResult['oath']>;
export type TrustPair = { hero: HeroPortrait; partner: HeroPortrait | null };

export function OathStone({ result, active = false }: { result?: SettledOath; active?: boolean }) {
  const cracked = result && (result.mine === 'take' || result.partner === 'take');
  return <div className="oath-stone" aria-hidden="true" data-active={active || undefined}>
    <img src="/art/props/oathstone.webp" width={640} height={640} alt="" draggable={false} />
    {cracked && <svg viewBox="0 0 320 320"><g className="oath-fracture" fill="none" stroke="#eab49b" strokeWidth="2.5"><path d="m160 18-12 52 20 27-18 32 20 27-23 39 12 85" /><path d="m168 97 30-12 22 10m-73 100-28-13-25 11" /></g>{result.mine === 'take' && result.partner === 'take' && <path className="oath-shard" d="m150 129 20 27-23 39 12 85-21-29Z" fill="#413a35" stroke="#af7159" />}</svg>}
  </div>;
}

export function TrustPortrait({ person, label }: { person: HeroPortrait | null; label: string }) {
  return <div className="trust-portrait"><Token art={person?.portraitUrl ?? null} label={person?.name ?? '?'} ring={person?.banner ?? '#4b463d'} size={48} /><div><small>{label}</small><strong>{person?.name ?? '—'}</strong></div></div>;
}

export function OathScene({ hero, partner, oath, result, revealed = false }: TrustPair & { oath?: OathView; result?: SettledOath; revealed?: boolean }) {
  const copy = useTrustCopy(), reduced = useReducedMotion();
  const [turned, setTurned] = useState(reduced);
  const outcome = result ? result.mine === 'share' && result.partner === 'share' ? 'kept' : result.mine === 'take' && result.partner === 'take' ? 'cracked' : 'broken' : null;
  useEffect(() => {
    if (!result) return;
    setTurned(reduced);
    const timer = window.setTimeout(() => { setTurned(true); play(outcome === 'kept' ? 'reveal' : 'grave', { rate: outcome === 'kept' ? .8 : .65 }); }, reduced ? 0 : 850);
    return () => clearTimeout(timer);
  }, [result, outcome, reduced]);
  const visible = Boolean(result && (turned || revealed));
  return <div className="oath-scene" data-oath-outcome={outcome ?? 'waiting'} data-turned={visible}>
    <div className="oath-radiance" aria-hidden="true" /><OathStone result={visible ? result : undefined} active={oath?.state === 'open'} />
    <div className="oath-hands">{(['mine', 'partner'] as const).map(side => {
      const choice = visible ? result?.[side] : side === 'mine' ? oath?.mine : null;
      return <div key={side} className="oath-hand" data-choice={choice ?? 'secret'}>
        <div className="oath-hand-turn" data-flipped={visible}>
          <div className="oath-hand-back"><svg viewBox="-2 -3 28 30" aria-hidden="true"><path d={PALM} /></svg></div>
          <div className="oath-hand-front"><svg viewBox="-2 -3 28 30" aria-hidden="true"><path d={result?.[side] === 'take' ? FIST : PALM} /></svg></div>
        </div>
        <strong>{choice ? copy[choice] : copy.secret}</strong>
        <span>{side === 'mine' ? copy.you : partner?.name ?? copy.partner}</span>
      </div>;
    })}</div>
    <p className="oath-caption" role="status">{visible && outcome ? copy[outcome] : oath?.state === 'silent' ? copy.silent : oath?.state === 'spent' ? copy.spent : copy.waiting}</p>
    <div className="trust-portraits"><TrustPortrait person={hero} label={copy.you} /><TrustPortrait person={partner} label={copy.partner} /></div>
  </div>;
}
