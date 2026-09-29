import type { FeatureView, KitItemView, LabyrinthView } from '@dark/shared';
import { useText } from '../../components/items/ItemChip';
import { useI18n } from '../../i18n';

/** Stroke icons for the belt, drawn at 24 px. */
const ICONS: Record<FeatureView['icon'] | KitItemView['base'] | 'lock' | 'rest', string> = {
  flame: 'M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-3 1.5-4.5 2.5-6.5.5 1.5 1.3 2.5 2.5 3.5 0-2.5-.4-5 0-7.5z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  heart: 'M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5 21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2',
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2',
  dodge: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  escape: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.5 1.2-1.4 2.6-2.7 3.9M6.1 6.1C4 7.5 2.6 9.5 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.7-1.3',
  skull: 'M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8zM9 11h.01M15 11h.01',
  path: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  rage: 'M6 4c2.5 5 2.5 11 0 16M12 3c2.5 6 2.5 12 0 18M18 4c2.5 5 2.5 11 0 16',
  target: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 1v4M12 19v4M1 12h4M19 12h4',
  arrow: 'M4 20 20 4M20 4h-6M20 4v6M4 20l1.5-4.5M4 20l4.5-1.5',
  potion: 'M9 3h6M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3M7 15h10',
  'bomb-fire': 'M11 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 9l3-3M18 4l1-1M20 6l1-1',
  'bomb-smoke': 'M5 16a4 4 0 0 1 1-7.9A5 5 0 0 1 15.5 7 4 4 0 0 1 19 15H5zM8 20h8',
  'scroll-portal': 'M8 3h11a2 2 0 0 1 2 2v2h-4M17 7v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2h12M8 3a2 2 0 0 0-2 2v12',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  rest: 'M4 21l16-4M4 17l16 4M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3.5 2-5 .4 1.4 1 2.3 2 3 0-2-.5-4 0-6z',
};

export function BeltIcon({ name, className = 'size-6' }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export type BeltPick = { feature: FeatureView } | { kit: KitItemView } | { rest: true };

/** Diamonds for uses: filled while left. */
function Pips({ left, of }: { left: number; of: number }) {
  return (
    <span className="absolute inset-x-0 bottom-1 flex justify-center gap-[3px]">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`size-[6px] rotate-45 border border-gold ${i < left ? 'bg-gold' : ''}`} />
      ))}
    </span>
  );
}

/**
 * The belt along the bottom of the Room (layout B, D1): the Hero's class features
 * on the left; on the right its short rests, then the Bag items it carries for a
 * Run. Diamonds are uses left, a dashed frame is always on, a number is how many
 * are carried.
 */
export function Belt({ hero, onPick }: { hero: LabyrinthView['hero']; onPick: (pick: BeltPick) => void }) {
  const { t } = useI18n();
  const text = useText();
  const label = (f: FeatureView) => `${text(f.name)}: ${f.uses ? t('belt.kind.rest', { left: f.uses.left, of: f.uses.of }) : t(`belt.kind.${f.kind}`)}`;
  const rests = hero.shortRests;
  const restLabel = `${t('rest.title')}: ${t('rest.left', { left: rests.left, of: rests.of })}`;
  return (
    <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2 overflow-x-auto [scrollbar-width:none]">
      <div className="flex shrink-0 gap-1.5">
        {hero.features.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-label={label(f)}
            title={label(f)}
            onClick={() => onPick({ feature: f })}
            className={`relative grid size-11 shrink-0 place-items-center rounded-[2px] border bg-[rgb(21_18_15/0.92)] p-0 shadow-[0_0_0_1px_#000,0_4px_10px_rgb(0_0_0/0.6)] ${
              f.kind === 'locked' ? 'border-line text-brass-dim' : f.kind === 'passive' ? 'border-dashed border-brass text-gold' : 'border-gold text-gold'
            }`}
          >
            <BeltIcon name={f.icon} />
            {f.kind === 'locked' && <span className="absolute -top-1.5 -right-1.5 text-brass"><BeltIcon name="lock" className="size-3.5" /></span>}
            {f.uses && f.uses.of > 0 && <Pips left={f.uses.left} of={f.uses.of} />}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          aria-label={restLabel}
          title={restLabel}
          onClick={() => onPick({ rest: true })}
          className={`relative grid size-11 shrink-0 place-items-center rounded-[2px] border bg-[rgb(21_18_15/0.92)] p-0 shadow-[0_0_0_1px_#000,0_4px_10px_rgb(0_0_0/0.6)] ${
            rests.left > 0 ? 'border-gold text-gold' : 'border-line text-brass-dim'
          }`}
        >
          <BeltIcon name="rest" />
          <Pips left={rests.left} of={rests.of} />
        </button>
        {hero.kit.map((k) => (
          <button
            key={k.base}
            type="button"
            aria-label={`${text(k.name)} ×${k.count}`}
            title={`${text(k.name)} ×${k.count}`}
            onClick={() => onPick({ kit: k })}
            className="relative grid size-11 shrink-0 place-items-center rounded-[2px] border border-gold bg-[rgb(21_18_15/0.92)] p-0 text-gold shadow-[0_0_0_1px_#000,0_4px_10px_rgb(0_0_0/0.6)]"
          >
            <BeltIcon name={k.base} />
            <span className="absolute -right-1.5 -bottom-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border border-brass bg-page px-1 font-head text-[11px] leading-none font-extrabold text-bone">
              {k.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
