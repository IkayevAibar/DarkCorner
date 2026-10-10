import type { ItemView } from '@dark/shared';
import { useI18n } from '../i18n';
import { ItemTile } from './items/ItemTile';

/** A titled grid of Items to pick one from, with an optional line under each (a price, a count). */
export function ItemPicker({ title, items, onPick, note, empty }: {
  title: string;
  items: ItemView[];
  onPick: (item: ItemView) => void;
  note?: (item: ItemView) => string | null;
  empty?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="grid gap-2">
      <span className="sub-heading">{title}</span>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-muted italic">{empty ?? t('hero.empty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-x-2 gap-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="grid justify-items-center gap-0.5">
              <ItemTile item={item} onClick={() => onPick(item)} />
              {note && note(item) && <span className="text-center text-[11px] leading-tight text-muted">{note(item)}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
