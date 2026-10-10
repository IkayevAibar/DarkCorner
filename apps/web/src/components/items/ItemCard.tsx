import type { CSSProperties, ReactNode } from 'react';
import type { GearFactsView, HeroView, ItemView } from '@dark/shared';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { useLoad } from '../useLoad';
import { ItemArt } from './ItemTile';
import { useText } from './text';
import { useItemStyles } from './itemStyles';
import { type InfoId, InfoLine, useOpenLine, useStatInfo } from './StatInfo';

/** Makes a line explain itself when tapped (one at a time on a card); `null` leaves lines plain. */
type Explain = ((key: string, info: InfoId, line: ReactNode) => ReactNode) | null;

/** Comparison colors: muted, so Tier colors stay the brightest thing on screen. */
const BETTER = '#9cc48a';
const WORSE = '#d98a74';

/** The full Item, with reveal steps and the live worn-gear comparison preserved. */
export function ItemCard({ item, revealStep = Infinity }: { item: ItemView; revealStep?: number }) {
  useItemStyles();
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
  const lines = useOpenLine();
  const about = useStatInfo(hero);
  const known = item.kind === 'gear' && item.identified;
  const mystery = item.kind === 'gear' && !item.identified;
  const radiant = known && item.radiant && revealStep >= finalStep;
  const explain: Explain = (key, info, line) => (
    <InfoLine info={about(info)} open={lines.isOpen(key)} onToggle={() => lines.toggle(key)}>{line}</InfoLine>
  );
  return (
    <article className={`item-card tier-${item.tier}${mystery ? ' unidentified' : ''}${radiant ? ' radiant' : ''}`} data-item-card data-item-id={item.id} style={{ '--tier': color } as CSSProperties}>
      <div className="item-card-top">
        <ItemArt item={item}/>
        {mystery && <span className="card-mystery" aria-hidden="true">?</span>}
        {radiant && <span className="radiant-stamp" aria-hidden="true">{t('item.radiant')}</span>}
        {known && item.serial && <span className="card-copy" aria-hidden="true">#{item.serial.number}/{item.serial.of}</span>}
      </div>
      <div className="item-card-body">
        <div className="grid min-w-0 gap-1">
          <h3 className="item-card-name">
            {text(item.name)}
            {item.upgrade > 0 && ` +${item.upgrade}`}
          </h3>
          {item.kind === 'gear'
            ? explain('level', 'level', <span className="text-sm text-muted">{`${t(`tier.${item.tier}`)} · ${t('item.level', { n: item.itemLevel })}`}</span>)
            : <span className="text-sm text-muted">{t('item.quantity', { n: item.quantity })}</span>}
          {known && item.radiant && <span {...reveal(finalStep)}>{explain('radiant', 'radiant', <span className="text-sm font-bold text-gold">{t('item.radiant')}</span>)}</span>}
        </div>
      {item.kind === 'gear' && !item.identified && (
        <p className="m-0 text-sm text-muted italic">
          <strong className="text-bone not-italic">{t('item.unidentified')}.</strong> {t('item.unidentifiedHint')}
        </p>
      )}
      {item.gear && <div {...reveal(finalStep)}><GearFacts gear={item.gear} hero={hero} barred={barred} explain={explain} /></div>}
      {item.about && <div {...reveal(finalStep)}><p className="m-0 text-[15px]">{text(item.about)}</p></div>}
      {known && item.quality !== null && <div {...reveal(2)}>{explain('quality', 'quality', <span className="item-quality"><span>{t('item.quality', { n: item.quality })}</span><span className="item-quality-track" aria-hidden="true"><i style={{ width: `${item.quality}%` }}/></span></span>)}</div>}
      {known && item.upgrade > 0 && <div {...reveal(2)}>{explain('upgrade', 'upgrade', <span className="text-sm">{t('item.upgradeLine', { n: item.upgrade })}</span>)}</div>}
      {known && item.serial && <div {...reveal(finalStep)}><span className="font-head text-sm font-bold text-gold">{t('item.serial', { n: item.serial.number, m: item.serial.of })}</span></div>}
      {known && <BonusLines item={item} visible={revealStep - 2} explain={explain} />}
      {mystery && <div className="item-mystery-lines" aria-hidden="true"><span>◆ ???</span><span>◆ ???</span></div>}
      {known && item.power && <div {...reveal(3 + (item.bonusStats?.length ?? 0))}><p className="item-card-power">{text(item.power)}</p></div>}
      {known && <div {...reveal(finalStep)}><p className="m-0 text-xs text-muted">{t('info.hint')}</p></div>}
      {item.gear && hero && !barred && <div {...reveal(finalStep)}><Compare item={item} gear={item.gear} hero={hero} /></div>}
      {known && item.owners && <div {...reveal(finalStep)}><span className="text-sm text-muted">{t('item.owners', { list: item.owners.join(' → ') })}</span></div>}
      {item.worth > 0 && <div {...reveal(finalStep)}><span className="text-xs text-muted">{t('item.worth', { n: item.worth.toLocaleString() })}</span></div>}
      </div>
    </article>
  );
}

function BonusLines({ item, muted = false, visible = Infinity, explain = null }: { item: ItemView; muted?: boolean; visible?: number; explain?: Explain }) {
  const text = useText();
  if (!item.bonusStats || item.bonusStats.length === 0) return null;
  return (
    <ul className={`m-0 grid list-none gap-1 p-0 ${muted ? 'text-sm text-muted' : 'text-[15px]'}`}>
      {item.bonusStats.map((line, i) => {
        const shown = (
          <>
            <span style={{ color: `var(--color-tier-${item.tier})` }}>◆ </span>
            {text(line)}
          </>
        );
        const id = item.bonusStatIds?.[i];
        return (
          <li key={i} className="reveal-line" data-hidden={i >= visible || undefined} aria-hidden={i >= visible || undefined}>
            {explain && id ? explain(`bonus-${i}`, id, <span>{shown}</span>) : shown}
          </li>
        );
      })}
    </ul>
  );
}

const casts = (hero: HeroView | null) => hero !== null && ['wizard', 'cleric', 'warlock', 'druid', 'bard', 'sorcerer'].includes(hero.class);
/** The ability a weapon attack adds, as fights pick it: DEX for bows and Rogues, else STR. */
const attackAbility = (gear: GearFactsView, hero: HeroView) => (gear.group === 'bow' || ['rogue', 'ranger', 'monk'].includes(hero.class) ? 'dex' : 'str');
const modifier = (score: number) => Math.floor((score - 10) / 2);
/** What a piece's armor is worth to this Hero: body armor with as much DEX as it lets count. */
const armorFor = (gear: GearFactsView, hero: HeroView) => {
  if (!gear.armor) return null;
  if (!gear.armor.body) return gear.armor.ac;
  return gear.armor.ac + Math.min(modifier(hero.abilities.dex + hero.gear.abilities.dex), gear.armor.maxDex ?? Infinity);
};

/** What a piece of gear does in a fight: its slot, its weapon or armor numbers, and who may wear it. */
function GearFacts({ gear, hero, barred, explain = null }: { gear: GearFactsView; hero: HeroView | null; barred: boolean; explain?: Explain }) {
  const { t } = useI18n();
  const kind = gear.slot === 'main' ? 'weapon' : gear.slot === 'off' ? 'offhand' : gear.slot === 'body' ? 'armor' : null;
  const lines: { line: string; info: InfoId | null }[] = [];
  if (gear.damage) {
    const d = gear.damage;
    const dice = `${d.dice}d${d.sides}${d.percent === 100 ? '' : ` × ${d.percent}%`}`;
    lines.push({ line: `${t('item.damage', { min: d.min, max: d.max })} (${dice}), ${t(`item.hits.${d.hits}`)}`, info: 'weapon' });
    if (hero && !casts(hero)) lines.push({ line: t('item.plus', { ability: t(`ability.${attackAbility(gear, hero)}`) }), info: null });
  }
  if (gear.hands === 2) lines.push({ line: t('item.twoHanded'), info: 'twoHanded' });
  if (gear.light) lines.push({ line: t('item.light'), info: 'offHand' });
  if (gear.armor) {
    const { ac, body, maxDex } = gear.armor;
    lines.push({
      line: !body ? t('item.armorAdd', { ac }) : maxDex === null ? t('item.armorBody', { ac })
        : maxDex === 0 ? t('item.armorBodyNoDex', { ac }) : t('item.armorBodyCap', { ac, n: maxDex }),
      info: body ? 'bodyArmor' : 'armorPiece',
    });
  }
  if (gear.heavy) lines.push({ line: t('item.heavy'), info: null });
  if (!gear.damage && !gear.armor) lines.push({ line: t('item.bonusOnly'), info: null });
  return (
    <div className="grid gap-0.5 text-[15px]">
      <span className="text-sm text-muted">
        {gear.hands === 2 ? t('slot.both') : gear.light ? t('slot.either') : t(`slot.${gear.slot === 'ring' ? 'ring1' : gear.slot}`)}
        {kind && gear.group && ` · ${t(`item.${kind}.${gear.group}` as MessageKey)}`}
      </span>
      {lines.map(({ line, info }) => (explain && info ? <div key={line}>{explain(info, info, <span>{line}</span>)}</div> : <span key={line}>{line}</span>))}
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
