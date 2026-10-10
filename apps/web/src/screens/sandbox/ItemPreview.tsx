import { ItemTile } from '../../components/items/ItemTile';
import { ItemCard } from '../../components/items/ItemCard';
import { useText } from '../../components/items/text';
import { useSheet } from '../../components/Sheet';
import { useI18n } from '../../i18n';
import { ITEM_FIXTURES } from './itemFixtures';

export function ItemPreview() {
  const { t } = useI18n(), text = useText(), { openSheet } = useSheet();
  return <section className="grid gap-4" data-item-preview>
    <h2 className="sub-heading m-0">{t('hero.bag', { n:Object.keys(ITEM_FIXTURES).length,m:24 })}</h2>
    <div className="flex flex-wrap gap-4" data-item-grid>{Object.entries(ITEM_FIXTURES).map(([key,item]) => <div key={key} data-fixture={key}><ItemTile item={item} size={76} onClick={() => openSheet({title:text(item.name),body:<ItemCard item={item}/>})}/></div>)}</div>
    <div className="flex items-end gap-4" data-item-sizes>{([62,76,84] as const).map(size => <ItemTile key={size} item={ITEM_FIXTURES.relic} size={size}/>)}</div>
    <div className="grid gap-5" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))'}}>{Object.entries(ITEM_FIXTURES).map(([key,item]) => <div key={key} data-card-fixture={key}><ItemCard item={item}/></div>)}</div>
  </section>;
}
