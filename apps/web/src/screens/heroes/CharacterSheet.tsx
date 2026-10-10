import { useState } from 'react';
import { ABILITY_IDS, type ClassId, type CreationOptions, type HeroView, type ItemView, type SlotId } from '@dark/shared';
import type { CompanionView } from '@dark/solo';
import { api } from '../../api';
import { ItemTile } from '../../components/items/ItemTile';
import { ItemCard } from '../../components/items/ItemCard';
import { useText } from '../../components/items/text';
import { type InfoId, PERCENT_STATS, critRange, useStatInfo } from '../../components/items/StatInfo';
import { LevelUp } from './LevelUp';
import { Meter } from '../../components/Meter';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { describeError } from '../../errors';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { IdentifyReveal } from '../../components/loot/IdentifyReveal';
import { DeedsPanel } from './Deeds';
import { Growth } from './Growth';

type Place = 'worn' | 'bag' | 'storage';

/** Solo: the Companion, to hand gear to (docs/design.md → The solo game → The Companion); online there is none. */
const loadCompanion = __SOLO__ ? () => api.companion() : async (): Promise<CompanionView | null> => null;
type Beside = NonNullable<CompanionView['companion']>;

const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : String(m);
};

/** Diablo-style layout: slots around the portrait (docs/design.md → Look and feel). */
const EQUIP_AREAS: { slot: SlotId; area: string }[] = [
  { slot: 'head', area: 'head' },
  { slot: 'amulet', area: 'amulet' },
  { slot: 'main', area: 'main' },
  { slot: 'off', area: 'off' },
  { slot: 'body', area: 'body' },
  { slot: 'ring1', area: 'ring1' },
  { slot: 'hands', area: 'hands' },
  { slot: 'feet', area: 'feet' },
  { slot: 'ring2', area: 'ring2' },
];

export function CharacterSheet({ hero, canRetire, options, onChanged }: {
  hero: HeroView;
  canRetire: boolean;
  options: CreationOptions;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const worn = new Map(hero.worn.map((w) => [w.slot, w.item]));
  const companion = useLoad(loadCompanion);
  const c = companion.data?.companion;
  const beside = c && !c.backAt && !c.waiting ? c : null;
  const showItem = (item: ItemView, place: Place) =>
    openSheet({
      title: text(item.name),
      body: (
        <div className="grid gap-4">
          <ItemActions item={item} place={place} heroClass={hero.class} worn={hero.worn} companion={beside} onIdentified={onChanged}
            onDone={() => { closeSheet(); onChanged(); void companion.reload(); }} />
        </div>
      ),
    });
  const race = options.races.find((r) => r.id === hero.race)!;
  const title = hero.deeds.find((d) => d.id === hero.title)?.title ?? null;
  const cls = options.classes.find((c) => c.id === hero.class)!;

  const confirmRetire = () =>
    openSheet({
      title: t('hero.retireTitle', { name: hero.name }),
      body: <RetireConfirm name={hero.name} onDone={() => { closeSheet(); onChanged(); }} />,
    });

  const explain = useStatInfo(hero);
  const explainSheet = (id: InfoId, title: string) => openSheet({ title, body: <p className="m-0">{explain(id)}</p> });
  return (
    <section className="grid gap-4">
      <article className="panel grid gap-4 p-3.5">
        <div className="flex items-center gap-3.5">
          <div
            className="h-[140px] w-[112px] shrink-0 overflow-hidden rounded-[2px] border-2"
            style={{ borderColor: hero.banner, background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${hero.banner} 45%, #000), #0c0a08 75%)` }}
          >
            <img src={hero.portraitUrl} alt="" className="size-full scale-110 object-cover object-[50%_40%]" />
          </div>
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="m-0 truncate font-head text-[26px] leading-tight font-extrabold">{hero.name}</h1>
            {title && <span className="truncate font-head text-sm font-bold text-gold italic">{text(title)}</span>}
            <span className="text-sm">{text(race.name)} · {text(cls.name)}</span>
            <span className="text-sm text-muted">
              {t('hero.level', { n: hero.level })}
              {hero.xpNext !== null && ` · ${t('hero.xp', { xp: hero.xp, next: hero.xpNext })}`}
            </span>
            <span className="flex flex-wrap gap-1.5">
              <span className="chip w-fit text-[#f1c75b]">{t('hero.gold', { n: hero.gold.toLocaleString() })}</span>
              <span className="chip w-fit">{t('hero.armorClass', { n: hero.armorClass })}</span>
            </span>
          </div>
        </div>
        {hero.levelUp && (
          <button
            type="button"
            className="btn btn-primary shadow-[0_0_18px_rgb(224_184_106/0.45)]"
            onClick={() => openSheet({
              title: t('levelUp.sheet'),
              body: <LevelUp hero={hero} onChanged={onChanged} onClose={closeSheet} />,
            })}
          >
            ✦ {t('levelUp.button', { n: hero.levelUp.level })}
          </button>
        )}
        <div className="grid gap-2">
          <Meter label={t('hero.health')} value={hero.hp} max={hero.maxHp} kind="health" />
          <Meter label={t('hero.stamina')} value={hero.stamina} max={hero.staminaMax} kind="stamina" />
        </div>

        <div className="grid gap-2">
          <span className="sub-heading">{t('hero.abilities')}</span>
          <div className="grid grid-cols-6 gap-1.5">
            {ABILITY_IDS.map((a) => {
              // The score as fights and Checks roll it: the Hero's own plus what its gear adds.
              const gear = hero.gear.abilities[a];
              const total = hero.abilities[a] + gear;
              return (
                <button
                  key={a}
                  type="button"
                  className="grid justify-items-center gap-px rounded-[2px] border border-bone/25 bg-transparent px-0 py-1.5 font-[inherit] text-[inherit]"
                  onClick={() => explainSheet(a, t(`abilityName.${a}`))}
                >
                  <span className="text-[11px] font-bold tracking-wide text-muted">{t(`ability.${a}`)}</span>
                  <span className="font-head text-[22px] leading-none font-extrabold">{total}</span>
                  <span className="text-xs text-muted">{modifier(total)}</span>
                  {gear !== 0 && <span className="text-[10px] leading-none text-tier-uncommon">{t('hero.gearAbility', { n: gear > 0 ? `+${gear}` : `${gear}` })}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <GearTotals hero={hero} onExplain={explainSheet} />

        <div className="grid gap-2">
          <span className="sub-heading">{t('hero.talents')}</span>
          <div className="flex flex-wrap gap-1.5">
            {hero.talents.map((id) => {
              const talent = options.talents.find((x) => x.id === id)!;
              return (
                <button key={id} type="button" className="chip" onClick={() => openSheet({ title: text(talent.name), body: <p className="m-0">{text(talent.description)}</p> })}>
                  {text(talent.name)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="sub-heading">{t('hero.equipment')}</span>
          <div
            className="grid grid-cols-[1fr_1.25fr_1fr] items-center justify-items-center gap-x-2 gap-y-2.5"
            style={{ gridTemplateAreas: '"head portrait amulet" "main portrait off" "body portrait ring1" "hands feet ring2"' }}
          >
            {EQUIP_AREAS.map(({ slot, area }) => {
              const item = worn.get(slot);
              // A two-handed weapon fills the off-hand too: it shows there, dimmed.
              const both = slot === 'off' && !item && worn.get('main')?.gear?.hands === 2 ? worn.get('main')! : null;
              return (
                <div key={slot} className="flex flex-col items-center gap-0.5" style={{ gridArea: area }}>
                  {item ? (
                    <ItemTile item={item} onClick={() => showItem(item, 'worn')} />
                  ) : both ? (
                    <span className="opacity-35 grayscale" title={t('slot.offTaken')}>
                      <ItemTile item={both} onClick={() => showItem(both, 'worn')} />
                    </span>
                  ) : (
                    <span className="block size-[62px] rounded-[2px] border border-dashed border-bone/30" />
                  )}
                  <span className="text-center text-[11px] text-muted">{t(`slot.${slot}`)}</span>
                </div>
              );
            })}
            <div
              className="h-full w-full self-stretch overflow-hidden rounded-[2px] border border-bone/25"
              style={{ gridArea: 'portrait', background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${hero.banner} 40%, #000), #0c0a08 75%)` }}
            >
              <img src={hero.portraitUrl} alt="" className="size-full object-cover" />
            </div>
          </div>
        </div>
      </article>

      <Growth hero={hero} onChanged={onChanged} />

      <DeedsPanel hero={hero} onChanged={onChanged} />

      <ItemGrid title={t('hero.bag', { n: hero.bag.length, m: hero.bagSlots })} items={hero.bag} onPick={(i) => showItem(i, 'bag')} />
      <ItemGrid
        title={t('hero.storage', { n: hero.storage.length, m: hero.storageSlots })}
        items={hero.storage}
        onPick={(i) => showItem(i, 'storage')}
      />

      {canRetire ? (
        <button type="button" className="btn border-[#8a1c1c] text-[#ff9a8a]" onClick={confirmRetire}>
          {t('hero.retire')}
        </button>
      ) : (
        <p className="m-0 text-center text-sm text-muted">{t('hero.retireUsed')}</p>
      )}
    </section>
  );
}

function ItemGrid({ title, items, onPick }: { title: string; items: ItemView[]; onPick: (item: ItemView) => void }) {
  const { t } = useI18n();
  return (
    <section className="grid gap-2">
      <span className="sub-heading">{title}</span>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-muted italic">{t('hero.empty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-2">
          {items.map((item) => (
            <ItemTile key={item.id} item={item} onClick={() => onPick(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemActions({ item, place, heroClass, worn, companion = null, onIdentified, onDone }: {
  item: ItemView; place: Place; heroClass: ClassId; worn: HeroView['worn']; companion?: Beside | null; onIdentified: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dropping is for good: the first tap asks, the second throws it away.
  const [dropping, setDropping] = useState(false);
  const [revealed, setRevealed] = useState<ItemView | null>(null);

  const act = async (action: () => Promise<unknown>, close = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (close) onDone();
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      setBusy(false);
    }
  };

  const wearable = item.kind === 'gear';
  // The card already says why; the server would refuse it anyway.
  const barred = item.gear?.classes != null && !item.gear.classes.includes(heroClass);
  const companionBarred = companion !== null && item.gear?.classes != null && !item.gear.classes.includes(companion.class);
  const text = useText();
  const inHand = (slot: SlotId) => worn.find((w) => w.slot === slot)?.item ?? null;
  // Hands (docs/design.md → Hands): what else comes off, beyond the piece it swaps with.
  const putsAway = (slot: SlotId): ItemView[] => {
    const main = inHand('main');
    const off = inHand('off');
    if (slot === 'main' && item.gear?.hands === 2 && off) return [off];
    if (slot === 'off' && main?.gear?.hands === 2) return [main];
    return [];
  };
  const wear = (slot?: SlotId) => act(async () => {
    play('equip');
    await api.equipItem(item.id, slot);
  });
  const homeSlot: SlotId = item.gear?.slot === 'ring' ? 'ring1' : (item.gear?.slot ?? 'main') as SlotId;
  const away = item.gear?.light ? putsAway('off') : putsAway(homeSlot);
  if (revealed) return <IdentifyReveal before={item} after={revealed} onDone={onDone} />;
  return (
    <div className="grid gap-4">
      <ItemCard item={item} />
      <div className="flex flex-wrap gap-2">
        {place === 'worn' && (
          <button type="button" className="btn flex-1" disabled={busy} onClick={() => void act(async () => {
            play('equip');
            await api.unequipItem(item.id);
          })}>
            {t('item.unequip')}
          </button>
        )}
        {place !== 'worn' && wearable && item.identified && !item.gear?.light && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy || barred} onClick={() => void wear()}>
            {t('item.equip')}
          </button>
        )}
        {place !== 'worn' && wearable && item.identified && item.gear?.light && (
          <>
            <button type="button" className="btn btn-primary flex-1" disabled={busy || barred} onClick={() => void wear('main')}>
              {t('item.equipMain')}
            </button>
            <button type="button" className="btn btn-primary flex-1" disabled={busy || barred} onClick={() => void wear('off')}>
              {t('item.equipOff')}
            </button>
          </>
        )}
        {wearable && !item.identified && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void act(async () => {
            setRevealed((await api.identify(item.id)).item);
            onIdentified();
          }, false)}>
            {t('loot.identifyFree')}
          </button>
        )}
        {item.kind === 'potion' && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void act(() => api.drink(item.id))}>
            {t('item.drink')}
          </button>
        )}
        {companion && place !== 'worn' && wearable && item.identified && (
          <button type="button" className="btn flex-1" disabled={busy || companionBarred} onClick={() => void act(async () => {
            play('equip');
            await api.giveToCompanion(item.id);
          })}>
            {t('companion.give', { name: companion.name })}
          </button>
        )}
        {place === 'bag' && (
          <button type="button" className="btn flex-1" disabled={busy} onClick={() => void act(() => api.moveItem(item.id, 'storage'))}>
            {t('item.toStorage')}
          </button>
        )}
        {place === 'storage' && (
          <button type="button" className="btn flex-1" disabled={busy} onClick={() => void act(() => api.moveItem(item.id, 'bag'))}>
            {t('item.toBag')}
          </button>
        )}
        {place === 'bag' && item.tier !== 'relic' && (
          <button
            type="button"
            className={dropping ? 'btn btn-primary flex-1' : 'btn flex-1'}
            disabled={busy}
            onClick={() => (dropping ? void act(() => api.dropItem(item.id)) : setDropping(true))}
          >
            {dropping ? t('item.dropConfirm') : t('item.drop')}
          </button>
        )}
      </div>
      {companion && place !== 'worn' && wearable && item.identified && companionBarred && (
        <p className="m-0 text-sm text-muted">{t('companion.cannotUse', { name: companion.name })}</p>
      )}
      {place !== 'worn' && wearable && item.identified && !barred && away.length > 0 && (
        <p className="m-0 text-sm text-muted">
          {item.gear?.light && `${t('item.equipOff')}: `}
          {t('item.putsAway', { list: away.map((i) => text(i.name)).join(', ') })}
        </p>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function RetireConfirm({ name, onDone }: { name: string; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <div className="grid gap-4">
      <p className="m-0 text-muted">{t('hero.retireBody', { name })}</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void run(async () => {
          await api.retireHero();
          onDone();
        })}
      >
        {t('hero.retireYes')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

/** What the Hero's worn gear adds up to, by kind: each line explains itself. */
function GearTotals({ hero, onExplain }: { hero: HeroView; onExplain: (id: InfoId, title: string) => void }) {
  const { t } = useI18n();
  const entries = (Object.entries(hero.gear.stats) as [InfoId & keyof HeroView['gear']['stats'], number][]).filter(([, n]) => n !== 0);
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="grid gap-2">
      <span className="sub-heading">{t('hero.fromGear')}</span>
      {entries.length === 0 && hero.gear.charm === 0 ? (
        <p className="m-0 text-sm text-muted">{t('hero.gearNone')}</p>
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0 text-[15px]">
          {entries.map(([id, n]) => (
            <li key={id}>
              <button type="button" className="flex w-full items-baseline gap-1.5 border-0 bg-transparent p-0 text-left font-[inherit] text-[inherit]" onClick={() => onExplain(id, t(`statName.${id}`))}>
                <span className="flex-1">
                  {t(`statName.${id}`)} {signed(n)}{PERCENT_STATS.includes(id) ? '%' : ''}
                  {id === 'crit' && <span className="text-muted"> · {t('gear.critNote', { range: critRange(t, hero.gear.critFrom) })}</span>}
                  {id === 'escape' && <span className="text-muted"> · {t('gear.escapeNote', { m: hero.gear.escape })}</span>}
                </span>
                <span aria-hidden="true" className="text-xs text-muted">ⓘ</span>
              </button>
            </li>
          ))}
          {hero.gear.charm > 0 && (
            <li>
              <button type="button" className="flex w-full items-baseline gap-1.5 border-0 bg-transparent p-0 text-left font-[inherit] text-[inherit]" onClick={() => onExplain('cha', t('abilityName.cha'))}>
                <span className="flex-1">{t('gear.charm', { n: hero.gear.charm })}</span>
                <span aria-hidden="true" className="text-xs text-muted">ⓘ</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
