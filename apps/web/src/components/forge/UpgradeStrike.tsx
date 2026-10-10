import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ItemView, UpgradeResult } from '@dark/shared';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { iconPath, ICON_VIEWBOX } from '../items/icons';
import forgeStyles from './forge.css?inline';

const SOUND = { success: 'chips', failed: 'miss', dropped: 'creak', saved: 'page', destroyed: 'grave' } as const;
const SHARDS = ['0% 0%,50% 0%,45% 48%,0% 42%', '50% 0%,100% 0%,100% 38%,45% 48%', '0% 42%,45% 48%,32% 72%,0% 100%', '45% 48%,100% 38%,100% 72%,65% 66%', '0% 100%,32% 72%,65% 66%,57% 100%', '65% 66%,100% 72%,100% 100%,57% 100%'];

function Art({ item }: { item: ItemView }) {
  return item.art ? <img src={item.art} alt="" draggable={false} /> : <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={iconPath(item.icon)} /></svg>;
}

/** The server's result is already final. This scene only reveals the strike and then returns the sheet. */
export function UpgradeStrike({ item, result, onDone }: { item: ItemView; result: UpgradeResult; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [landed, setLanded] = useState(reduced);
  const [finished, setFinished] = useState(reduced);
  const callback = useRef(onDone), sent = useRef(false);
  callback.current = onDone;
  const crown = result.outcome === 'success' && result.item?.upgrade === 10;
  const finish = () => { setLanded(true); setFinished(true); if (!sent.current) { sent.current = true; callback.current(); } };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reduced) { finish(); return; }
    if (sent.current) return;
    const impact = window.setTimeout(() => { setLanded(true); play('anvil'); play(SOUND[result.outcome], { delay: 160 }); }, 760);
    const end = window.setTimeout(finish, crown ? 3100 : 2350);
    return () => { clearTimeout(impact); clearTimeout(end); };
  }, [reduced, result, crown]);

  const revealed = landed || reduced;
  return <section className="forge-strike panel" data-forge-strike data-outcome={result.outcome} data-landed={revealed} data-finished={finished} data-crown={crown} aria-busy={!finished}>
    <style>{forgeStyles}</style>
    <div className="forge-stage" aria-hidden="true">
      <div className="forge-furnace" />
      <svg className="forge-anvil" viewBox="0 0 360 200">
        <path d="M22 48 89 56 276 43 310 60 276 84 99 87 60 74Z" fill="#928674" stroke="#171310" strokeWidth="4" />
        <path d="M99 87 276 84 250 108 242 147 275 166 83 166 115 145 120 108Z" fill="#393630" stroke="#0b0a09" strokeWidth="5" />
        <path d="m121 100 32 13 59-2 28-20M121 144l61 8 60-5M92 65l177-9M100 78l166-11" fill="none" stroke="#a49372" strokeWidth="2" opacity=".45" />
        <path d="M79 168h200l13 22H66Z" fill="#211a13" stroke="#55422b" strokeWidth="4" />
      </svg>
      <div className="forge-item"><Art item={item} /></div>
      {result.outcome === 'destroyed' && <div className="forge-shards">{SHARDS.map((clip, i) => <span key={i} style={{ clipPath: `polygon(${clip})`, '--shard-x': `${(i % 2 ? 1 : -1) * (30 + i * 13)}px`, '--shard-y': `${10 + i * 12}px`, '--shard-turn': `${(i - 2) * 24}deg` } as CSSProperties}><Art item={item} /></span>)}</div>}
      <svg className="forge-hammer" viewBox="0 0 180 210">
        <path d="m72 61 16-4 51 143-18 6Z" fill="#58412b" stroke="#110e0b" strokeWidth="5" />
        <path d="m32 31 19-17 71 9 15 50-18 20-72-10Z" fill="#575850" stroke="#12120f" strokeWidth="5" />
        <path d="m32 31 73 11 17-19M105 42l14 51M44 47l53 8" fill="none" stroke="#b4a98f" strokeWidth="3" />
      </svg>
      <div className="forge-impact">
        <i className="forge-ring" />{crown && <><i className="forge-ring second" /><i className="forge-ring third" /></>}
        <div className="forge-sparks">{Array.from({ length: crown ? 36 : 18 }, (_, i) => <i key={i} style={{ '--spark-x': `${Math.cos(i * 2.4) * (50 + i % 5 * 23)}px`, '--spark-y': `${-20 - Math.abs(Math.sin(i * 2.4)) * (55 + i % 4 * 27)}px`, '--spark-delay': `${i % 4 * 35}ms` } as CSSProperties} />)}</div>
      </div>
      {(result.outcome === 'dropped' || result.outcome === 'saved') && <svg className="forge-cracks" viewBox="0 0 100 100"><path d="m49 0-9 26 17 9-21 21 21 13-14 31M36 56l-24-5M57 69l25 4" fill="none" stroke="#0b0a09" strokeWidth="7" /><path d="m49 0-9 26 17 9-21 21 21 13-14 31" fill="none" stroke="#d3b795" strokeWidth="1.5" /></svg>}
      {result.outcome === 'saved' && <div className="forge-scroll"><svg viewBox="0 0 75 95"><path d="M9 7h54v71l-9 9-8-7-10 9-9-7-18 6Z" fill="#cfb982" stroke="#352719" strokeWidth="4"/><path d="m37 21 17 8-3 25-14 13-14-13-3-25Z" fill="none" stroke="#67502a" strokeWidth="4" /></svg><i /></div>}
      <strong className="forge-rank">{revealed ? result.item ? `+${result.item.upgrade}` : '×' : `+${item.upgrade}`}</strong>
    </div>
    <div className="forge-result" role="status">
      <span className="forge-item-name">{(result.item ?? item).name[locale]}</span>
      <strong>{revealed ? t(`forge.outcome.${result.outcome}`, { n: result.item?.upgrade ?? 0 }) : t('forge.upgradeGo', { n: item.upgrade + 1 })}</strong>
      <span className="forge-d100">{revealed ? t('forge.roll', { r: result.roll, p: result.chance }) : `d100 · ≤ ${result.chance}`}</span>
    </div>
  </section>;
}
