import type { ArmorType, OffHandType, WeaponType } from './classes.js';
import { type Text, text } from './text.js';

export const SLOTS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring1', 'ring2'] as const;
export type Slot = (typeof SLOTS)[number];

/** What kind of Item a base makes. Only gear rolls Tiers, Quality and Bonus stats. */
export type ItemKind = 'gear' | 'potion' | 'scroll' | 'bomb' | 'key' | 'chest' | 'material';

interface BaseCommon {
  id: string;
  name: Text;
  /** Icon key for the web: a game-icons.net silhouette, shown until the base is painted. */
  icon: string;
  /** Painted art under apps/web/public/art/gear (docs/art/gear-prompts.md); a unique's own painting wins over it. */
  art?: string;
}

export interface GearBase extends BaseCommon {
  kind: 'gear';
  /** Where it is worn. Rings fit either ring slot. */
  slot: 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'amulet' | 'ring';
  /** Proficiency type for weapons, off-hands and body armor; absent = anyone. */
  weapon?: WeaponType;
  offHand?: OffHandType;
  armor?: ArmorType;
  /** Weapon damage: [dice, sides]. */
  damage?: [number, number];
  /** How a weapon wounds: some monsters shrug off one kind and break under another. */
  hits?: 'slash' | 'pierce' | 'bludgeon';
  /** Armor Class this piece gives (body armor: its base AC). */
  ac?: number;
  /** Body armor: how much DEX modifier still counts (Infinity = all of it). */
  maxDex?: number;
  /** Made only in pairs, never dropped or sold at random: Bond rings, from the Twin Wardens. */
  paired?: true;
  /** Held in both hands: nothing goes in the off-hand beside it, and its Bonus stats count twice (items.ts). */
  hands?: 2;
  /** Light enough for either hand: one in the off-hand strikes once more each turn (combat.ts). */
  light?: true;
}

export interface StackBase extends BaseCommon {
  kind: Exclude<ItemKind, 'gear'>;
  maxStack: number;
}

export type ItemBase = GearBase | StackBase;

const gear = (b: Omit<GearBase, 'kind'>): GearBase => ({ kind: 'gear', ...b });
const stack = (b: StackBase): StackBase => b;

export const BASES: ItemBase[] = [
  // Weapons
  gear({ id: 'greatsword', name: text('Greatsword', 'Двуручный меч'), icon: 'sword', slot: 'main', weapon: 'heavy', damage: [2, 6], hits: 'slash', hands: 2 }),
  gear({ id: 'greataxe', name: text('Greataxe', 'Секира'), icon: 'axe', slot: 'main', weapon: 'heavy', damage: [1, 12], hits: 'slash', hands: 2 }),
  gear({ id: 'maul', name: text('Maul', 'Двуручный молот'), icon: 'mace', slot: 'main', weapon: 'heavy', damage: [2, 6], hits: 'bludgeon', hands: 2 }),
  gear({ id: 'longsword', name: text('Longsword', 'Длинный меч'), icon: 'sword', slot: 'main', weapon: 'blade', damage: [1, 8], hits: 'slash' }),
  gear({ id: 'saber', name: text('Saber', 'Сабля'), icon: 'sword', slot: 'main', weapon: 'blade', damage: [1, 8], hits: 'slash' }),
  gear({ id: 'rapier', name: text('Rapier', 'Рапира'), icon: 'sword', slot: 'main', weapon: 'blade', damage: [1, 8], hits: 'pierce' }),
  gear({ id: 'dagger', name: text('Dagger', 'Кинжал'), icon: 'dagger', slot: 'main', weapon: 'dagger', damage: [1, 4], hits: 'pierce', light: true }),
  gear({ id: 'shortbow', name: text('Shortbow', 'Короткий лук'), icon: 'bow', slot: 'main', weapon: 'bow', damage: [1, 8], hits: 'pierce', hands: 2 }),
  gear({ id: 'longbow', name: text('Longbow', 'Длинный лук'), icon: 'bow', slot: 'main', weapon: 'bow', damage: [1, 10], hits: 'pierce', hands: 2 }),
  gear({ id: 'crossbow', name: text('Crossbow', 'Арбалет'), icon: 'bow', slot: 'main', weapon: 'bow', damage: [1, 12], hits: 'pierce', hands: 2 }),
  gear({ id: 'mace', name: text('Mace', 'Булава'), icon: 'mace', slot: 'main', weapon: 'mace', damage: [1, 6], hits: 'bludgeon' }),
  gear({ id: 'warhammer', name: text('Warhammer', 'Боевой молот'), icon: 'mace', slot: 'main', weapon: 'mace', damage: [1, 8], hits: 'bludgeon' }),
  gear({ id: 'staff', name: text('Staff', 'Посох'), icon: 'staff', slot: 'main', weapon: 'staff', damage: [1, 6], hits: 'bludgeon' }),
  gear({ id: 'wand', name: text('Wand', 'Жезл'), icon: 'staff', slot: 'main', weapon: 'staff', damage: [1, 4], hits: 'bludgeon' }),
  // The second wave (2026-10-10): side-grades with their own feel, not straight upgrades.
  gear({ id: 'flail', name: text('Flail', 'Цеп'), icon: 'mace', slot: 'main', weapon: 'mace', damage: [2, 4], hits: 'bludgeon' }),
  gear({ id: 'morningstar', name: text('Morningstar', 'Моргенштерн'), icon: 'mace', slot: 'main', weapon: 'mace', damage: [1, 8], hits: 'pierce' }),
  gear({ id: 'halberd', name: text('Halberd', 'Алебарда'), icon: 'axe', slot: 'main', weapon: 'heavy', damage: [3, 4], hits: 'slash', hands: 2 }),
  // A bow in one hand: smaller, but a shield or a dagger fits beside it.
  gear({ id: 'hand-crossbow', name: text('Hand crossbow', 'Ручной арбалет'), icon: 'bow', slot: 'main', weapon: 'bow', damage: [1, 6], hits: 'pierce' }),

  // Off-hands
  gear({ id: 'shield', name: text('Shield', 'Щит'), icon: 'shield', slot: 'off', offHand: 'shield', ac: 2 }),
  gear({ id: 'orb', name: text('Orb', 'Сфера'), icon: 'orb', slot: 'off', offHand: 'orb' }),
  gear({ id: 'holy-symbol', name: text('Holy symbol', 'Священный символ'), icon: 'holy-symbol', slot: 'off', offHand: 'holy-symbol' }),
  gear({ id: 'tome', name: text('Tome', 'Фолиант'), icon: 'scroll', slot: 'off', offHand: 'orb' }),

  // Body armor: base AC and how much DEX still counts
  gear({ id: 'plate', name: text('Plate armor', 'Латы'), icon: 'armor', slot: 'body', armor: 'heavy', ac: 18, maxDex: 0 }),
  gear({ id: 'chainmail', name: text('Chain mail', 'Кольчуга'), icon: 'armor', slot: 'body', armor: 'heavy', ac: 16, maxDex: 0 }),
  gear({ id: 'breastplate', name: text('Breastplate', 'Кираса'), icon: 'armor', slot: 'body', armor: 'medium', ac: 14, maxDex: 2 }),
  gear({ id: 'scale', name: text('Scale mail', 'Чешуйчатый доспех'), icon: 'armor', slot: 'body', armor: 'medium', ac: 14, maxDex: 2 }),
  gear({ id: 'half-plate', name: text('Half plate', 'Полулаты'), icon: 'armor', slot: 'body', armor: 'medium', ac: 15, maxDex: 1 }),
  gear({ id: 'splint', name: text('Splint mail', 'Наборный доспех'), icon: 'armor', slot: 'body', armor: 'heavy', ac: 17, maxDex: 0 }),
  gear({ id: 'leather', name: text('Leather armor', 'Кожаный доспех'), icon: 'armor', slot: 'body', armor: 'light', ac: 11, maxDex: Infinity }),
  gear({ id: 'studded', name: text('Studded leather', 'Проклёпанная кожа'), icon: 'armor', slot: 'body', armor: 'light', ac: 12, maxDex: Infinity }),
  // Robes are woven with wards (Mage armor): 13 + DEX, so a caster's body armor grows with Quality and Upgrades too.
  gear({ id: 'robes', name: text('Robes', 'Мантия'), icon: 'robes', slot: 'body', armor: 'robes', ac: 13, maxDex: Infinity }),

  // Anyone can wear these
  gear({ id: 'helm', name: text('Helm', 'Шлем'), icon: 'helm', slot: 'head', ac: 1 }),
  gear({ id: 'hood', name: text('Hood', 'Капюшон'), icon: 'hood', slot: 'head' }),
  gear({ id: 'gauntlets', name: text('Gauntlets', 'Латные перчатки'), icon: 'gloves', slot: 'hands' }),
  gear({ id: 'gloves', name: text('Gloves', 'Перчатки'), icon: 'gloves', slot: 'hands' }),
  gear({ id: 'boots', name: text('Boots', 'Сапоги'), icon: 'boots', slot: 'feet' }),
  gear({ id: 'amulet', name: text('Amulet', 'Амулет'), icon: 'amulet', slot: 'amulet' }),
  gear({ id: 'ring', name: text('Ring', 'Кольцо'), icon: 'ring', slot: 'ring' }),
  gear({ id: 'circlet', name: text('Circlet', 'Венец'), icon: 'helm', slot: 'head' }),
  gear({ id: 'bracers', name: text('Bracers', 'Наручи'), icon: 'gloves', slot: 'hands' }),
  gear({ id: 'greaves', name: text('Greaves', 'Поножи'), icon: 'boots', slot: 'feet' }),
  gear({ id: 'talisman', name: text('Talisman', 'Талисман'), icon: 'amulet', slot: 'amulet' }),
  gear({ id: 'signet', name: text('Signet ring', 'Перстень-печатка'), icon: 'ring', slot: 'ring' }),
  gear({ id: 'bond-ring', name: text('Bond ring', 'Кольцо уз'), icon: 'ring', slot: 'ring', paired: true }),

  // Stackables
  stack({ id: 'potion', kind: 'potion', name: text('Healing potion', 'Зелье лечения'), icon: 'potion', maxStack: 10 }),
  stack({ id: 'scroll-identify', kind: 'scroll', name: text('Scroll of Identify', 'Свиток опознания'), icon: 'scroll', maxStack: 20 }),
  stack({ id: 'scroll-portal', kind: 'scroll', name: text('Town Portal scroll', 'Свиток портала в город'), icon: 'scroll', maxStack: 10 }),
  stack({ id: 'scroll-protection', kind: 'scroll', name: text('Protection scroll', 'Свиток защиты'), icon: 'scroll', maxStack: 10 }),
  stack({ id: 'bomb-fire', kind: 'bomb', name: text('Fire bomb', 'Огненная бомба'), icon: 'bomb-fire', maxStack: 10 }),
  stack({ id: 'bomb-smoke', kind: 'bomb', name: text('Smoke bomb', 'Дымовая бомба'), icon: 'bomb-smoke', maxStack: 10 }),
  stack({ id: 'key-iron', kind: 'key', name: text('Iron key', 'Железный ключ'), icon: 'key', maxStack: 20 }),
  stack({ id: 'key-silver', kind: 'key', name: text('Silver key', 'Серебряный ключ'), icon: 'key', maxStack: 20 }),
  stack({ id: 'key-gold', kind: 'key', name: text('Gold key', 'Золотой ключ'), icon: 'key', maxStack: 20 }),
  stack({ id: 'chest-iron', kind: 'chest', name: text('Iron chest', 'Железный сундук'), icon: 'chest', maxStack: 10 }),
  stack({ id: 'chest-silver', kind: 'chest', name: text('Silver chest', 'Серебряный сундук'), icon: 'chest', maxStack: 10 }),
  stack({ id: 'chest-gold', kind: 'chest', name: text('Gold chest', 'Золотой сундук'), icon: 'chest', maxStack: 10 }),
  stack({ id: 'scrap', kind: 'material', name: text('Scrap', 'Лом'), icon: 'scrap', maxStack: 999 }),
  stack({ id: 'essence', kind: 'material', name: text('Essence', 'Эссенция'), icon: 'essence', maxStack: 999 }),
  stack({ id: 'soulstone', kind: 'material', name: text('Soulstone', 'Камень душ'), icon: 'soulstone', maxStack: 999 }),
];

const BY_ID = new Map(BASES.map((b) => [b.id, b]));

export function baseById(id: string): ItemBase {
  const base = BY_ID.get(id);
  if (!base) throw new Error(`unknown item base "${id}"`);
  return base;
}

/** Gear that drops, sells and is made at random: everything but the paired Bond rings. */
export const GEAR_BASES = BASES.filter((b): b is GearBase => b.kind === 'gear' && !b.paired);

export const isGear = (base: ItemBase): base is GearBase => base.kind === 'gear';

/** Stackables have no Tier; this color hint says what a Chest or Key opens up to. */
export const STACK_TIER_HINT: Record<string, 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'> = {
  'key-iron': 'uncommon', 'chest-iron': 'uncommon', 'bomb-fire': 'uncommon',
  'key-silver': 'rare', 'chest-silver': 'rare',
  'key-gold': 'epic', 'chest-gold': 'epic',
  essence: 'rare', soulstone: 'legendary',
};

/** The worn slots a base can go into: either ring slot, and either hand for a light weapon. */
export function slotsFor(base: GearBase): Slot[] {
  return base.slot === 'ring' ? ['ring1', 'ring2'] : base.light ? ['main', 'off'] : [base.slot];
}

/** A weapon held in both hands (docs/design.md → Hands). */
export const isTwoHanded = (id: string): boolean => {
  const base = BY_ID.get(id);
  return base?.kind === 'gear' && base.hands === 2;
};

/**
 * Where a piece goes when it is put on, and which worn slots must be emptied for it:
 * the slot itself when taken, the off-hand beside a two-handed weapon, and a two-handed
 * weapon when something goes in the off-hand. Without a wish, a ring takes a free ring
 * slot and a light weapon the main hand, or the off-hand when only that is free.
 */
export function wearPlan(base: GearBase, worn: ReadonlyMap<string, string>, wanted?: Slot): { slot: Slot; vacate: Slot[] } {
  const fits = slotsFor(base);
  const mainTwoHanded = worn.has('main') && isTwoHanded(worn.get('main')!);
  const free = (s: Slot) => !worn.has(s) && !(s === 'off' && mainTwoHanded);
  const slot = wanted ?? fits.find(free) ?? fits[0]!;
  const vacate: Slot[] = worn.has(slot) ? [slot] : [];
  if (slot === 'main' && base.hands === 2 && worn.has('off')) vacate.push('off');
  if (slot === 'off' && mainTwoHanded) vacate.push('main');
  return { slot, vacate };
}

/**
 * Where each piece of a kit goes, in order: worn where it fits beside what is already
 * on (`worn`: slot → base id) without taking anything off; otherwise null, the Bag.
 */
export function kitSlots(kit: readonly string[], worn: ReadonlyMap<string, string> = new Map()): (Slot | null)[] {
  const on = new Map(worn);
  return kit.map((id) => {
    const base = BY_ID.get(id);
    if (!base || base.kind !== 'gear') return null;
    const { slot, vacate } = wearPlan(base, on);
    if (vacate.length > 0) return null;
    on.set(slot, id);
    return slot;
  });
}
