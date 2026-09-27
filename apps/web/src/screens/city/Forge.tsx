import { useState } from 'react';
import type { ForgeCost, HeroView, ItemView, UpgradeResult } from '@dark/shared';
import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { ItemDetails, useText } from '../../components/items/ItemChip';
import { ItemPicker } from '../../components/ItemPicker';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { NeedHero } from './NeedHero';

/** What an Upgrade sounds like once the hammer lands. */
const UPGRADE_SOUND: Record<UpgradeResult['outcome'], () => void> = {
  success: () => play('chips', { delay: 180 }),
  failed: () => play('miss', { delay: 180 }),
  saved: () => play('page', { delay: 180 }),
  dropped: () => play('creak', { delay: 180 }),
  destroyed: () => play('grave', { delay: 180 }),
};

const MATERIALS = ['scrap', 'essence', 'soulstone'];

export function Forge() {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  const { data, failed, reload } = useLoad(api.forge);
  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { hero } = data;
  const gear = [...hero.worn.map((w) => w.item), ...hero.bag, ...hero.storage].filter((i) => i.kind === 'gear');
  const worn = new Set(hero.worn.map((w) => w.item.id));
  const materials = [...hero.bag, ...hero.storage].filter((i) => MATERIALS.includes(i.base));
  const count = (base: string) => materials.filter((m) => m.base === base).reduce((s, m) => s + m.quantity, 0);

  return (
    <Building title={t('city.forge')} blurb={t('forge.blurb')} hero={hero}>
      <div className="flex flex-wrap gap-1.5">
        {MATERIALS.map((m) => {
          const item = materials.find((i) => i.base === m);
          return (
            <span key={m} className="chip">
              {item ? text(item.name) : t(`forge.material.${m as 'scrap'}`)} · {count(m)}
            </span>
          );
        })}
      </div>

      <ItemPicker
        title={t('forge.pick')}
        items={gear}
        note={(item) => (worn.has(item.id) ? t('forge.worn') : item.upgrade > 0 ? `+${item.upgrade}` : null)}
        onPick={(item) => openSheet({ title: text(item.name), body: <ForgeSheet item={item} worn={worn.has(item.id)} onChanged={() => void reload()} /> })}
      />

      <section className="grid gap-2">
        <span className="sub-heading">{t('forge.craft')}</span>
        {data.recipes.map((recipe) => (
          <CraftRow key={recipe.id} recipe={recipe} hero={hero} onDone={() => void reload()} />
        ))}
      </section>
    </Building>
  );
}

function Cost({ cost, gold }: { cost: ForgeCost; gold: number }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
      {cost.gold > 0 && <span className={gold < cost.gold ? 'text-tier-mythic' : 'text-[#f1c75b]'}>{t('hero.gold', { n: cost.gold.toLocaleString() })}</span>}
      {cost.materials.map((m) => (
        <span key={m.base} className={m.have < m.quantity ? 'text-tier-mythic' : ''}>
          {text(m.name)} {m.have}/{m.quantity}
        </span>
      ))}
    </span>
  );
}

const affordable = (cost: ForgeCost, gold: number) => gold >= cost.gold && cost.materials.every((m) => m.have >= m.quantity);

/** Everything the Forge can do to one Item, and what the last Upgrade did. */
function ForgeSheet({ item, worn, onChanged }: { item: ItemView; worn: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  const { closeSheet } = useSheet();
  const quote = useLoad(() => api.forgeQuote(item.id));
  const hero = useLoad(api.forge);
  const { busy, error, run } = useAction();
  const [protect, setProtect] = useState(true);
  const [last, setLast] = useState<UpgradeResult | null>(null);
  const [destroyed, setDestroyed] = useState(false);

  const after = async () => {
    onChanged();
    await Promise.all([quote.reload(), hero.reload()]);
  };

  if (destroyed) {
    return (
      <div className="grid gap-3">
        {last && <UpgradeLine result={last} />}
        <button type="button" className="btn" onClick={closeSheet}>{t('close')}</button>
      </div>
    );
  }
  if (!quote.data || !hero.data) return <p className="m-0 text-muted">{t('loading')}</p>;
  const q = quote.data;
  const gold = hero.data.hero.gold;
  const up = q.upgrade;

  return (
    <div className="grid gap-4">
      <ItemDetails item={q.item} />
      {last && <UpgradeLine result={last} />}
      {q.blocked && <p className="m-0 text-sm text-muted">{t(`err.${q.blocked as 'identify_first'}`)}</p>}

      {up && (
        <div className="grid gap-2">
          <span className="sub-heading">{t('forge.upgrade', { n: up.to, p: up.chance })}</span>
          <Cost cost={up.cost} gold={gold} />
          {up.risky && (
            <p className="m-0 text-sm text-[#ff9a8a]">{t('forge.risky')}</p>
          )}
          {up.risky && up.protectionScrolls > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
              {t('forge.protect', { n: up.protectionScrolls })}
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !affordable(up.cost, gold)}
            onClick={() => void run(async () => {
              play('anvil');
              const r = await api.upgrade(item.id, up.risky && protect && up.protectionScrolls > 0);
              UPGRADE_SOUND[r.outcome]();
              setLast(r);
              if (r.outcome === 'destroyed') {
                setDestroyed(true);
                onChanged();
              } else {
                await after();
              }
            })}
          >
            {t('forge.upgradeGo', { n: up.to })}
          </button>
        </div>
      )}

      {q.reforge && (
        <div className="grid gap-2">
          <span className="sub-heading">{t('forge.reforge')}</span>
          <Cost cost={q.reforge} gold={gold} />
          <button type="button" className="btn" disabled={busy || !affordable(q.reforge, gold)} onClick={() => void run(async () => {
            play('anvil');
            await api.reforge(item.id);
            play('reveal', { delay: 200 });
            await after();
          })}>
            {t('forge.reforgeGo')}
          </button>
        </div>
      )}

      {q.salvage && !worn && (
        <div className="grid gap-2">
          <span className="sub-heading">{t('forge.salvage')}</span>
          <SalvageLine min={q.salvage.min} max={q.salvage.max} name={q.salvage.name} />
          <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => {
            play('anvil', { rate: 1.15 });
            await api.salvage(item.id);
            play('loot', { delay: 150 });
            onChanged();
            closeSheet();
          })}>
            {t('forge.salvageGo')}
          </button>
        </div>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function SalvageLine({ min, max, name }: { min: number; max: number; name: { en: string; ru: string } }) {
  const { t } = useI18n();
  const text = useText();
  return <span className="text-sm">{t('forge.salvageGives', { range: min === max ? String(min) : `${min}–${max}`, name: text(name) })}</span>;
}

function UpgradeLine({ result }: { result: UpgradeResult }) {
  const { t } = useI18n();
  const tone = result.outcome === 'success' ? 'text-gold' : result.outcome === 'destroyed' ? 'text-tier-mythic' : 'text-bone';
  return (
    <div className="panel anim-pop grid gap-0.5 p-3">
      <span className={`font-head text-xl font-extrabold ${tone}`}>{t(`forge.outcome.${result.outcome}`, { n: result.item?.upgrade ?? 0 })}</span>
      <span className="text-sm text-muted">{t('forge.roll', { r: result.roll, p: result.chance })}</span>
    </div>
  );
}

function CraftRow({ recipe, hero, onDone }: { recipe: { id: string; makes: { name: { en: string; ru: string } }; materials: ForgeCost['materials']; canCraft: boolean }; hero: HeroView; onDone: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { busy, error, run } = useAction();
  return (
    <div className="panel grid gap-1.5 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-head font-bold">{text(recipe.makes.name)}</span>
        <button type="button" className="btn btn-small" disabled={busy || !recipe.canCraft || !hero.inCity} onClick={() => void run(async () => {
          play('anvil');
          await api.craft(recipe.id);
          onDone();
        })}>
          {t('forge.craftGo')}
        </button>
      </div>
      <Cost cost={{ gold: 0, materials: recipe.materials }} gold={hero.gold} />
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
