import type { GearFactsView, HeroView, ItemView, LocalizedText } from '@dark/shared';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { useLoad } from '../useLoad';
import { ICON_VIEWBOX, iconPath } from './icons';

/** Comparison colors: muted, so Tier colors stay the brightest thing on screen. */
const BETTER = '#9cc48a';
const WORSE = '#d98a74';

/** Picks the current language out of engine content. */
export function useText() {
  const { locale } = useI18n();
  return (text: LocalizedText) => text[locale];
}

/**
 * A small square for one Item, framed in its Tier color.
 *
 * Stand-in until Codex's ItemTile lands (docs/tasks/codex-01-item-card.md): same
 * props shape, so swapping it is a one-line change where it is used.
 */
export function ItemChip({ item, size = 62, onClick }: { item: ItemView; size?: number; onClick?: () => void }) {
  const color = `var(--color-tier-${item.tier})`;
  const text = useText();
  return (
    <button
      type="button"
      aria-label={text(item.name)}
      onClick={onClick}
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[2px] border-2 p-0"
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${color} 42%, #000) 0%, color-mix(in srgb, ${color} 14%, #0b0a09) 72%)`,
        color: '#efe3cf',
      }}
    >
      {item.art ? (
        <img src={item.art} alt="" className="size-[96%] object-contain" draggable={false} />
      ) : (
        <svg
          viewBox={ICON_VIEWBOX}
          fill="currentColor"
          className={`size-[62%] drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)] ${item.identified ? '' : 'opacity-50'}`}
          aria-hidden="true"
        >
          <path d={iconPath(item.icon)} />
        </svg>
      )}
      {!item.identified && (
        <span className="absolute top-0.5 right-1.5 font-head text-base font-extrabold text-white [text-shadow:0_1px_2px_#000]">?</span>
      )}
      {item.quantity > 1 && (
        <span className="absolute right-1 bottom-0.5 font-head text-xs font-extrabold text-bone [text-shadow:0_1px_2px_#000]">
          ×{item.quantity}
        </span>
      )}
    </button>
  );
}

/** The full Item: stand-in for Codex's ItemCard, shown in the bottom sheet. */
export function ItemDetails({ item, revealStep = Infinity }: { item: ItemView; revealStep?: number }) {
  const { t } = useI18n();
  const text = useText();
  const color = `var(--color-tier-${item.tier})`;
  // The Hero's Class decides what gear numbers mean for it, and its worn gear is the comparison.
  const mine = useLoad(api.myHero);
  const hero = mine.data?.hero ?? null;
  // Gear this Hero can't wear gets a warning instead of a comparison that would read like an upgrade.
  const barred = hero !== null && item.gear?.classes != null && !item.gear.classes.includes(hero.class);
  const finalStep = 3 + (item.bonusStats?.length ?? 0) + Number(item.power !== null);
  const reveal = (step: number) => ({ className: 'reveal-line', 'data-hidden': revealStep < step || undefined, 'aria-hidden': revealStep < step || undefined });
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <ItemChip item={item} size={84} />
        <div className="grid min-w-0 gap-0.5">
          <span className="font-head text-xl leading-tight font-extrabold" style={{ color }}>
            {text(item.name)}
            {item.upgrade > 0 && ` +${item.upgrade}`}
          </span>
          <span className="text-sm text-muted">
            {item.kind === 'gear' ? `${t(`tier.${item.tier}`)} · ${t('item.level', { n: item.itemLevel })}` : t('item.quantity', { n: item.quantity })}
          </span>
          {item.radiant && <span {...reveal(finalStep)}><span className="text-sm font-bold text-gold">{t('item.radiant')}</span></span>}
        </div>
      </div>
      {item.kind === 'gear' && !item.identified && (
        <p className="m-0 text-sm text-muted italic">
          <strong className="text-bone not-italic">{t('item.unidentified')}.</strong> {t('item.unidentifiedHint')}
        </p>
      )}
      {item.gear && <div {...reveal(finalStep)}><GearFacts gear={item.gear} hero={hero} barred={barred} /></div>}
      {item.about && <div {...reveal(finalStep)}><p className="m-0 text-[15px]">{text(item.about)}</p></div>}
      {item.quality !== null && <div {...reveal(2)}><span className="text-sm">{t('item.quality', { n: item.quality })}</span></div>}
      {item.serial && <div {...reveal(finalStep)}><span className="font-head text-sm font-bold text-gold">{t('item.serial', { n: item.serial.number, m: item.serial.of })}</span></div>}
      <BonusLines item={item} visible={revealStep - 2} />
      {item.power && <div {...reveal(3 + (item.bonusStats?.length ?? 0))}><p className="m-0 italic" style={{ color }}>{text(item.power)}</p></div>}
      {item.gear && hero && !barred && <div {...reveal(finalStep)}><Compare item={item} gear={item.gear} hero={hero} /></div>}
      {item.owners && <div {...reveal(finalStep)}><span className="text-sm text-muted">{t('item.owners', { list: item.owners.join(' → ') })}</span></div>}
      {item.worth > 0 && <div {...reveal(finalStep)}><span className="text-xs text-muted">{t('item.worth', { n: item.worth.toLocaleString() })}</span></div>}
    </div>
  );
}

function BonusLines({ item, muted = false, visible = Infinity }: { item: ItemView; muted?: boolean; visible?: number }) {
  const text = useText();
  if (!item.bonusStats || item.bonusStats.length === 0) return null;
  return (
    <ul className={`m-0 grid list-none gap-1 p-0 ${muted ? 'text-sm text-muted' : 'text-[15px]'}`}>
      {item.bonusStats.map((line, i) => (
        <li key={i} className="reveal-line" data-hidden={i >= visible || undefined} aria-hidden={i >= visible || undefined}>
          <span style={{ color: `var(--color-tier-${item.tier})` }}>◆ </span>
          {text(line)}
        </li>
      ))}
    </ul>
  );
}

const casts = (hero: HeroView | null) => hero?.class === 'wizard' || hero?.class === 'cleric';
/** The ability a weapon attack adds, as fights pick it: DEX for bows and Rogues, else STR. */
const attackAbility = (gear: GearFactsView, hero: HeroView) => (gear.group === 'bow' || hero.class === 'rogue' || hero.class === 'ranger' ? 'dex' : 'str');
const modifier = (score: number) => Math.floor((score - 10) / 2);
/** What a piece's armor is worth to this Hero: body armor with as much DEX as it lets count. */
const armorFor = (gear: GearFactsView, hero: HeroView) => {
  if (!gear.armor) return null;
  if (!gear.armor.body) return gear.armor.ac;
  return gear.armor.ac + Math.min(modifier(hero.abilities.dex), gear.armor.maxDex ?? Infinity);
};

/** What a piece of gear does in a fight: its slot, its weapon or armor numbers, and who may wear it. */
function GearFacts({ gear, hero, barred }: { gear: GearFactsView; hero: HeroView | null; barred: boolean }) {
  const { t } = useI18n();
  const kind = gear.slot === 'main' ? 'weapon' : gear.slot === 'off' ? 'offhand' : gear.slot === 'body' ? 'armor' : null;
  const lines: string[] = [];
  if (gear.damage) {
    const d = gear.damage;
    const dice = `${d.dice}d${d.sides}${d.percent === 100 ? '' : ` × ${d.percent}%`}`;
    lines.push(`${t('item.damage', { min: d.min, max: d.max })} (${dice}), ${t(`item.hits.${d.hits}`)}`);
    if (hero && !casts(hero)) lines.push(t('item.plus', { ability: t(`ability.${attackAbility(gear, hero)}`) }));
  }
  if (gear.armor) {
    const { ac, body, maxDex } = gear.armor;
    lines.push(!body ? t('item.armorAdd', { ac }) : maxDex === null ? t('item.armorBody', { ac })
      : maxDex === 0 ? t('item.armorBodyNoDex', { ac }) : t('item.armorBodyCap', { ac, n: maxDex }));
  }
  if (gear.heavy) lines.push(t('item.heavy'));
  if (!gear.damage && !gear.armor) lines.push(t('item.bonusOnly'));
  return (
    <div className="grid gap-0.5 text-[15px]">
      <span className="text-sm text-muted">
        {t(`slot.${gear.slot === 'ring' ? 'ring1' : gear.slot}`)}
        {kind && gear.group && ` · ${t(`item.${kind}.${gear.group}` as MessageKey)}`}
      </span>
      {lines.map((line) => <span key={line}>{line}</span>)}
      {gear.damage && casts(hero) && !barred && <span className="text-sm text-muted">{t('item.casterWeapon')}</span>}
      {gear.classes && (
        <span className="text-sm text-muted">{t('item.classes', { list: gear.classes.map((c) => t(`class.${c}`)).join(', ') })}</span>
      )}
      {barred && <span className="text-sm font-bold" style={{ color: WORSE }}>{t('item.cantUse')}</span>}
    </div>
  );
}

/** Side by side with what the Hero wears in the same slot: the numbers that change, then the worn piece's Bonus stats. */
function Compare({ item, gear, hero }: { item: ItemView; gear: GearFactsView; hero: HeroView }) {
  const { t } = useI18n();
  const text = useText();
  const slots: string[] = gear.slot === 'ring' ? ['ring1', 'ring2'] : [gear.slot];
  const worn = hero.worn.filter((w) => slots.includes(w.slot));
  if (worn.some((w) => w.item.id === item.id)) return <p className="m-0 text-sm text-muted">{t('item.wearing')}</p>;
  const shift = (label: string, from: string, to: string, better: boolean | null) => (
    <span style={{ color: better === null ? undefined : better ? BETTER : WORSE }}>{t('item.change', { label, from, to })}</span>
  );
  return (
    <section className="grid gap-2 border-t border-line pt-2">
      <span className="sub-heading">{t('item.compare')}</span>
      {worn.length === 0 && <p className="m-0 text-sm text-muted">{t('item.slotEmpty')}</p>}
      {worn.map(({ slot, item: other }) => {
        const was = other.gear;
        const damage = gear.damage && was?.damage && !casts(hero) ? { from: was.damage, to: gear.damage } : null;
        // A Shield swapped for an Orb loses its Armor Class: count what is missing as 0.
        const from = was ? armorFor(was, hero) : null;
        const to = armorFor(gear, hero);
        const armor = from === null && to === null ? { from: null, to: null } : { from: from ?? 0, to: to ?? 0 };
        return (
          <div key={slot} className="grid gap-0.5 text-sm">
            <span>
              {t('item.wornNow')}{' '}
              <b style={{ color: `var(--color-tier-${other.tier})` }}>{text(other.name)}{other.upgrade > 0 && ` +${other.upgrade}`}</b>
            </span>
            {damage && shift(
              t('item.damageLabel'),
              `${damage.from.min}–${damage.from.max}`,
              `${damage.to.min}–${damage.to.max}`,
              damage.to.min + damage.to.max === damage.from.min + damage.from.max ? null : damage.to.min + damage.to.max > damage.from.min + damage.from.max,
            )}
            {armor.from !== null && armor.to !== null && shift(t('item.armorLabel'), String(armor.from), String(armor.to), armor.to === armor.from ? null : armor.to > armor.from)}
            {other.bonusStats?.length ? <BonusLines item={other} muted /> : <span className="text-muted">{t('item.noBonus')}</span>}
          </div>
        );
      })}
    </section>
  );
}
