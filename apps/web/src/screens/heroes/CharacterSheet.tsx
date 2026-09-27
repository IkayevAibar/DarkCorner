import { useState } from 'react';
import { ABILITY_IDS, type CreationOptions, type HeroView, type ItemView, type SlotId } from '@dark/shared';
import { api } from '../../api';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { Meter } from '../../components/Meter';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { describeError } from '../../errors';
import { useI18n } from '../../i18n';
import { play, playTier } from '../../sound';
import { Growth } from './Growth';

type Place = 'worn' | 'bag' | 'storage';

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
  const showItem = (item: ItemView, place: Place) =>
    openSheet({
      title: text(item.name),
      body: (
        <div className="grid gap-4">
          <ItemDetails item={item} />
          <ItemActions item={item} place={place} onDone={() => { closeSheet(); onChanged(); }} />
        </div>
      ),
    });
  const race = options.races.find((r) => r.id === hero.race)!;
  const cls = options.classes.find((c) => c.id === hero.class)!;

  const confirmRetire = () =>
    openSheet({
      title: t('hero.retireTitle', { name: hero.name }),
      body: <RetireConfirm name={hero.name} onDone={() => { closeSheet(); onChanged(); }} />,
    });

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
            <span className="text-sm">{text(race.name)} · {text(cls.name)}</span>
            <span className="text-sm text-muted">{t('hero.level', { n: hero.level })}</span>
            <span className="flex flex-wrap gap-1.5">
              <span className="chip w-fit text-[#f1c75b]">{t('hero.gold', { n: hero.gold.toLocaleString() })}</span>
              <span className="chip w-fit">{t('hero.armorClass', { n: hero.armorClass })}</span>
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <Meter label={t('hero.health')} value={hero.hp} max={hero.maxHp} kind="health" />
          <Meter label={t('hero.stamina')} value={hero.stamina} max={hero.staminaMax} kind="stamina" />
        </div>

        <div className="grid gap-2">
          <span className="sub-heading">{t('hero.abilities')}</span>
          <div className="grid grid-cols-6 gap-1.5">
            {ABILITY_IDS.map((a) => (
              <div key={a} className="grid justify-items-center gap-px rounded-[2px] border border-bone/25 py-1.5">
                <span className="text-[11px] font-bold tracking-wide text-muted">{t(`ability.${a}`)}</span>
                <span className="font-head text-[22px] leading-none font-extrabold">{hero.abilities[a]}</span>
                <span className="text-xs text-muted">{modifier(hero.abilities[a])}</span>
              </div>
            ))}
          </div>
        </div>

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
              return (
                <div key={slot} className="flex flex-col items-center gap-0.5" style={{ gridArea: area }}>
                  {item ? (
                    <ItemChip item={item} onClick={() => showItem(item, 'worn')} />
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
            <ItemChip key={item.id} item={item} onClick={() => onPick(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemActions({ item, place, onDone }: { item: ItemView; place: Place; onDone: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dropping is for good: the first tap asks, the second throws it away.
  const [dropping, setDropping] = useState(false);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      setBusy(false);
    }
  };

  const wearable = item.kind === 'gear';
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {place === 'worn' && (
          <button type="button" className="btn flex-1" disabled={busy} onClick={() => void act(async () => {
            play('equip');
            await api.unequipItem(item.id);
          })}>
            {t('item.unequip')}
          </button>
        )}
        {place !== 'worn' && wearable && item.identified && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void act(async () => {
            play('equip');
            await api.equipItem(item.id);
          })}>
            {t('item.equip')}
          </button>
        )}
        {wearable && !item.identified && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void act(async () => playTier((await api.identify(item.id)).item.tier))}>
            {t('loot.identifyFree')}
          </button>
        )}
        {item.kind === 'potion' && (
          <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void act(() => api.drink(item.id))}>
            {t('item.drink')}
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
