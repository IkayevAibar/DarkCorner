import type { ItemView, LocalizedText } from '@dark/shared';
import { useI18n } from '../../i18n';
import { iconSvg } from './icons';

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
  return (
    <button
      type="button"
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
          viewBox="0 0 64 64"
          fill="currentColor"
          className={`size-[56%] drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)] ${item.identified ? '' : 'opacity-50'}`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: iconSvg(item.icon) }}
        />
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
export function ItemDetails({ item }: { item: ItemView }) {
  const { t } = useI18n();
  const text = useText();
  const color = `var(--color-tier-${item.tier})`;
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
          {item.radiant && <span className="text-sm font-bold text-gold">{t('item.radiant')}</span>}
        </div>
      </div>
      {item.kind === 'gear' && !item.identified && (
        <p className="m-0 text-sm text-muted italic">
          <strong className="text-bone not-italic">{t('item.unidentified')}.</strong> {t('item.unidentifiedHint')}
        </p>
      )}
      {item.quality !== null && <span className="text-sm">{t('item.quality', { n: item.quality })}</span>}
      {item.serial && <span className="font-head text-sm font-bold text-gold">{t('item.serial', { n: item.serial.number, m: item.serial.of })}</span>}
      {item.bonusStats && item.bonusStats.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {item.bonusStats.map((line, i) => (
            <li key={i} className="text-[15px]">
              <span style={{ color }}>◆ </span>
              {text(line)}
            </li>
          ))}
        </ul>
      )}
      {item.power && <p className="m-0 italic" style={{ color }}>{text(item.power)}</p>}
      {item.owners && <span className="text-sm text-muted">{t('item.owners', { list: item.owners.join(' → ') })}</span>}
      {item.worth > 0 && <span className="text-xs text-muted">{t('item.worth', { n: item.worth.toLocaleString() })}</span>}
    </div>
  );
}
