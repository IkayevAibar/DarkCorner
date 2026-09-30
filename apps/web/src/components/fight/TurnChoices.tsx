import { useEffect, useRef, useState } from 'react';
import type { HeroActionKind, HeroActionView } from '@dark/shared';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { BeltIcon } from '../../screens/labyrinth/Belt';
import type { BoardFight } from './live';

type Icon = Parameters<typeof BeltIcon>[0]['name'];
const ICON: Record<HeroActionKind, Icon> = {
  attack: 'sword', burst: 'flame', cure: 'heart', 'second-wind': 'wind', potion: 'potion', escape: 'escape', dodge: 'dodge', help: 'path', guard: 'shield',
  revive: 'bolt',
};
/** The order the choices are offered in, attacks first. */
const ORDER: HeroActionKind[] = ['attack', 'burst', 'cure', 'second-wind', 'potion', 'dodge', 'help', 'guard', 'revive', 'escape'];
export function TurnChoices({ fight, busy, ready, names, onChoose, children }: {
  fight: BoardFight; busy: boolean; ready: boolean; names: Record<string, string>;
  onChoose: (action: HeroActionView) => void;
  children: (tap: (key: string) => void, marking: boolean, mark: string | null) => React.ReactNode;
}) {
  const { t } = useI18n();
  const [rage, setRage] = useState(false), [mark, setMark] = useState<string | null>(null);
  const [marking, setMarking] = useState(false), [curing, setCuring] = useState(false);
  const sent = useRef(false), turn = fight.turn;
  const turnKey = `${turn?.hero}:${turn?.round}:${turn?.continuing}:${fight.events.length}`;
  useEffect(() => { setRage(false); setMark(null); setMarking(false); setCuring(false); }, [turnKey]);
  useEffect(() => { if (!busy) sent.current = false; }, [busy, turnKey]);
  const partnerName = names.ally ?? names.hero!;
  const can = (k: HeroActionKind) => ready && (turn?.actions.includes(k) ?? false);
  const choose = (action: HeroActionView) => {
    if (!ready || sent.current || (action.kind !== 'auto' && !can(action.kind))) return;
    sent.current = true;
    onChoose({ ...action, ...(rage ? { rage: true } : {}), ...(mark ? { mark } : {}) });
  };
  const tapMonster = (key: string) => {
    if (!ready || !turn?.targets.includes(key)) return;
    if (marking) { setMark(key); setMarking(false); }
    else choose({ kind: 'attack', target: key });
  };
  const count: Partial<Record<HeroActionKind, number>> = turn ? { burst: turn.spells, cure: turn.heals, potion: turn.potions } : {};
  const label = (k: HeroActionKind): string => {
    const n = count[k], base = t(`live.act.${k}` as MessageKey, { name: partnerName });
    return n !== undefined ? `${base} · ${n}` : base;
  };
  return <>
    {children(tapMonster, marking, mark)}
      {turn && fight.mine && (
        <section className="turn-choices" aria-label={t('live.title')}>
          {(turn.rage || turn.mark) && (
            <div className="flex flex-wrap gap-2">
              {turn.rage && (
                <button type="button" aria-pressed={rage} className={`btn btn-small flex items-center gap-1.5 ${rage ? 'btn-primary' : ''}`} disabled={!ready} onClick={() => setRage(!rage)}>
                  <BeltIcon name="rage" className="size-4" />{t('live.rage')}
                </button>
              )}
              {turn.mark && (
                <button type="button" aria-pressed={marking || mark !== null} className={`btn btn-small flex items-center gap-1.5 ${marking || mark ? 'btn-primary' : ''}`} disabled={!ready}
                  onClick={() => { setMark(null); setMarking(!marking); }}>
                  <BeltIcon name="target" className="size-4" />{mark ? t('live.marked', { name: names[mark]! }) : t('live.mark')}
                </button>
              )}
            </div>
          )}
          {curing ? (
            <div className="grid gap-2">
              <span className="sub-heading">{t('live.cureWho')}</span>
              <div className="grid grid-cols-2 gap-2">
                {turn.cure.map((k) => (
                  <button key={k} type="button" className="btn btn-primary" disabled={!ready} onClick={() => choose({ kind: 'cure', target: k })}>
                    {k === 'hero' ? t('live.you') : partnerName}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-small justify-self-start" disabled={!ready} onClick={() => setCuring(false)}>{t('close')}</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ORDER.filter((k) => turn.actions.includes(k)).map((k) => (
                <button key={k} type="button" className={`btn grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0 text-left ${k === 'attack' ? 'btn-primary' : ''}`}
                  disabled={!can(k)}
                  onClick={() => {
                    if (k === 'cure' && turn.cure.length > 1) setCuring(true);
                    else choose({ kind: k, ...(k === 'cure' ? { target: turn.cure[0] } : {}) });
                  }}>
                  <BeltIcon name={ICON[k]} className="row-span-2 size-5" />
                  <span className="text-[14px] leading-tight">{label(k)}</span>
                  <span className="text-[11px] leading-tight font-normal opacity-75">{t(`live.hint.${k}` as MessageKey, { name: partnerName, n: turn.attacks })}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-small grid gap-0.5" disabled={!ready} onClick={() => choose({ kind: 'auto' })}>
            <span className="flex items-center justify-center gap-1.5"><BeltIcon name="swords" className="size-4" />{t('live.auto')}</span>
            <span className="text-[11px] font-normal opacity-75">{t('live.autoHint')}</span>
          </button>
        </section>
      )}
  </>;
}
