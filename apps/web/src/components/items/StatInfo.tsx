import { useId, useState, type ReactNode } from 'react';
import type { AbilityId, BonusStatId, HeroView } from '@dark/shared';
import { useI18n } from '../../i18n';

/** What a line on an Item card or the Character sheet can explain. */
export type InfoId = BonusStatId | 'quality' | 'level' | 'upgrade' | 'radiant' | 'weapon' | 'armorPiece' | 'bodyArmor';

const ABILITY_IDS: readonly string[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const isAbility = (id: InfoId): id is AbilityId => ABILITY_IDS.includes(id);
/** Bonus stats read as a percentage; the rest are flat points. */
export const PERCENT_STATS: readonly BonusStatId[] = ['damage', 'crit', 'spellPower', 'healing', 'escape', 'goldFind', 'magicFind', 'lifeSteal'];
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
const modifier = (score: number) => Math.floor((score - 10) / 2);

/** The explanation of a line, in the Player's language, with what the Hero's own gear adds up to where that matters. */
export function useStatInfo(hero: HeroView | null) {
  const { t } = useI18n();
  return (id: InfoId): string => {
    const lines = [t(`stat.${id}.about`)];
    if (!hero) return lines.join(' ');
    if (isAbility(id)) {
      lines.push(t('stat.ability.rule'));
      const total = hero.abilities[id] + hero.gear.abilities[id];
      lines.push(t('stat.ability.yours', { ability: t(`abilityName.${id}`), total, mod: signed(modifier(total)), gear: signed(hero.gear.abilities[id]) }));
      if (id === 'cha') lines.push(t('stat.cha.yours', { n: hero.gear.charm }));
    } else if (id === 'crit') {
      lines.push(t('stat.crit.yours', { n: hero.gear.stats.crit ?? 0, range: critRange(t, hero.gear.critFrom) }));
    } else if (id === 'escape') {
      lines.push(t('stat.escape.yours', { n: hero.gear.stats.escape ?? 0, m: hero.gear.escape }));
    } else {
      // Any other Bonus stat: what everything worn adds up to.
      const total = hero.gear.stats[id as BonusStatId] ?? 0;
      if (total !== 0) lines.push(t('stat.total', { n: `${signed(total)}${PERCENT_STATS.includes(id as BonusStatId) ? '%' : ''}` }));
    }
    return lines.join(' ');
  };
}

/** The d20 faces that crit: "a natural 20", or "19–20". */
export function critRange(t: ReturnType<typeof useI18n>['t'], from: number): string {
  return from >= 20 ? t('crit.range.20') : t('crit.range', { from });
}

/**
 * A line that explains itself when tapped: the explanation opens under it. `open` and
 * `onToggle` let a card keep one explanation open at a time.
 */
export function InfoLine({ info, open, onToggle, children, className = '' }: {
  info: string; open: boolean; onToggle: () => void; children: ReactNode; className?: string;
}) {
  const id = useId();
  return (
    <div className="grid">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={`flex w-full items-baseline gap-1.5 border-0 bg-transparent p-0 text-left font-[inherit] text-[inherit] ${className}`}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <span aria-hidden="true" className={`shrink-0 text-xs leading-none ${open ? 'text-gold' : 'text-muted'}`}>ⓘ</span>
      </button>
      {open && <p id={id} className="m-0 mt-1 mb-1 border-l-2 border-gold/50 pl-2 text-sm leading-snug text-muted">{info}</p>}
    </div>
  );
}

/** One explanation open at a time, by key. */
export function useOpenLine() {
  const [open, setOpen] = useState<string | null>(null);
  return { isOpen: (key: string) => open === key, toggle: (key: string) => setOpen((now) => (now === key ? null : key)) };
}
