import type { Item, Prisma } from '@prisma/client';
import type { ItemView, LocalizedText, Tier } from '@dark/shared';
import {
  type GearRoll, STACK_TIER_HINT, baseById, bonusLines, buybackPrice, gearFacts, isGear, itemAbout, itemName, sellValue, uniqueById,
} from '@dark/engine';

type BonusStats = GearRoll['bonusStats'];

/** A Bond ring's power: which pair it is half of, and what joining the halves does. */
const bondPower = (other: string | null): LocalizedText => ({
  en: `One of a pair: the other half went to ${other ?? '?'}. Worn by the two Heroes of a Duo, the halves count their Bonus stats twice in fights.`,
  ru: `Одно из пары: второе кольцо досталось герою ${other ?? '?'}. Если оба кольца носят герои одного дуэта, их бонусы в бою считаются дважды.`,
});

/** An Item as the web renders it. Fields that identifying reveals stay null until then. */
export function toItemView(item: Item): ItemView {
  const base = baseById(item.base);
  if (!isGear(base)) {
    return {
      id: item.id,
      kind: base.kind,
      quantity: item.quantity,
      tier: STACK_TIER_HINT[item.base] ?? 'common',
      base: item.base,
      icon: base.icon,
      name: base.name,
      itemLevel: 1,
      identified: true,
      quality: null,
      bonusStats: null,
      bonusStatIds: null,
      power: null,
      radiant: null,
      upgrade: 0,
      serial: null,
      owners: null,
      art: null,
      worth: sellValue({ ...item, tier: 'common' }),
      gear: null,
      about: itemAbout(item.base),
    };
  }

  const tier = item.tier as Tier;
  const roll = {
    base: item.base,
    suffix: item.suffix,
    uniqueId: item.uniqueId,
    bonusStats: item.bonusStats as unknown as BonusStats,
    radiant: item.radiant,
    upgrade: item.upgrade,
    tier,
    itemLevel: item.itemLevel,
  };
  const unique = item.uniqueId ? uniqueById(item.uniqueId) : null;
  const known = item.identified;
  const serialOf = unique?.copies;

  return {
    id: item.id,
    kind: 'gear',
    quantity: 1,
    tier,
    base: item.base,
    icon: base.icon,
    // Unidentified uniques keep their secret: only the base shows.
    name: known ? itemName(roll) : base.name,
    itemLevel: item.itemLevel,
    identified: known,
    quality: known ? item.quality : null,
    bonusStats: known ? bonusLines(roll) : null,
    bonusStatIds: known ? roll.bonusStats.map((b) => b.stat) : null,
    power: known && unique ? unique.power : item.bond ? bondPower(item.bondWith) : null,
    radiant: known ? item.radiant : null,
    upgrade: item.upgrade,
    serial: known && item.serial && serialOf ? { number: item.serial, of: serialOf } : null,
    owners: known && Array.isArray(item.owners) ? (item.owners as string[]) : null,
    art: known ? (unique?.art ?? null) : null,
    worth: buybackPrice(roll),
    // Unidentified: the base type at an average Quality, so Quality and Radiant stay secret.
    gear: gearFacts(base, known ? item : { quality: null, upgrade: item.upgrade, radiant: false }),
    about: null,
  };
}

/** A view of Items that don't exist yet: Shop goods, merchant wares, Chest odds. */
export function rollView(roll: GearRoll, id: string): ItemView {
  return toItemView({
    ...gearData(roll, ''), id, seasonId: '', heroId: null, place: 'BAG', slot: null, quantity: 1, upgrade: 0, serial: null,
    owners: null, bond: null, bondWith: null, graveId: null, createdAt: new Date(0), updatedAt: new Date(0),
  } as Item);
}

export function stackView(base: string, quantity: number, id = base): ItemView {
  return toItemView({
    id, seasonId: '', heroId: null, place: 'BAG', slot: null, base, tier: 'common', quantity, itemLevel: 1, quality: null,
    bonusStats: [], suffix: null, uniqueId: null, radiant: false, identified: true, upgrade: 0, serial: null, owners: null,
    bond: null, bondWith: null, seed: null, graveId: null, createdAt: new Date(0), updatedAt: new Date(0),
  });
}

/** Columns for a new gear Item from an engine roll. */
export function gearData(roll: GearRoll, seed: string): Pick<
  Prisma.ItemUncheckedCreateInput,
  'base' | 'tier' | 'itemLevel' | 'quality' | 'bonusStats' | 'suffix' | 'uniqueId' | 'radiant' | 'identified' | 'seed'
> {
  return {
    base: roll.base,
    tier: roll.tier,
    itemLevel: roll.itemLevel,
    quality: roll.quality,
    bonusStats: roll.bonusStats as unknown as Prisma.InputJsonValue,
    suffix: roll.suffix,
    uniqueId: roll.uniqueId,
    radiant: roll.radiant,
    identified: roll.identified,
    seed,
  };
}
