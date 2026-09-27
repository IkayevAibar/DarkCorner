import type { ThemeId } from './floors.js';
import { type Text, text } from './text.js';

export type MonsterKin = 'beast' | 'goblinoid' | 'undead' | 'demon' | 'dragonkin' | 'humanoid';

/**
 * What makes a monster more than numbers: its signature in a fight
 * (docs/design.md → Monsters). Save DCs grow by 1 for every two Floors
 * deeper into a theme, as attacks and damage do.
 */
export type MonsterPower =
  /** Advantage on attacks while another monster of the group still stands. */
  | { id: 'pack' }
  /** Strikes early: +5 to initiative. */
  | { id: 'quick' }
  /** A hit snatches carried gold; it runs with it on its next turn unless it falls first. */
  | { id: 'thief' }
  /** Bones: blunt weapons deal half again as much, piercing ones a quarter less. */
  | { id: 'brittle' }
  /** A hit calls for a CON save; failing it, the Hero loses its next turn. */
  | { id: 'paralyze'; dc: number }
  /** The first blow that would drop it (not a critical hit) leaves it at 1 health half the time. */
  | { id: 'undying' }
  /** Heals itself for half the damage it deals. */
  | { id: 'drain' }
  /** Once per fight, instead of attacking, heals an ally below half health. */
  | { id: 'mend'; dice: [number, number] }
  /** A hit sets the Hero burning: `dice` damage at the start of its next `turns` turns. */
  | { id: 'burn'; turns: number; dice: [number, number] }
  /** Ready at the start and again on a 5–6 on a d6 each turn: a DEX save halves it. */
  | { id: 'breath'; dice: [number, number]; dc: number }
  /** Several attacks each turn. */
  | { id: 'multiattack'; attacks: number }
  /** As the fight starts: a WIS save, or disadvantage on attacks for `rounds` rounds. */
  | { id: 'frighten'; dc: number; rounds: number }
  /** Below half health, once: +2 AC, +1 to hit, and its breath (if any) is ready again. */
  | { id: 'enrage' };

export type MonsterPowerId = MonsterPower['id'];

export interface MonsterDef {
  id: string;
  name: Text;
  theme: ThemeId;
  kin: MonsterKin;
  /** Token art under apps/web/public/art/tokens; null until painted. */
  art: string | null;
  role: 'minion' | 'brute' | 'miniboss' | 'boss';
  hp: number;
  ac: number;
  /** Attack bonus added to the d20. */
  attack: number;
  /** [dice, sides, bonus]. */
  damage: [number, number, number];
  dex: number;
  xp: number;
  /** How often it shows up in a fight Room of its theme. */
  weight: number;
  powers?: MonsterPower[];
  /** Mini-bosses: who fights at their side. */
  escort?: string[];
  /** Shows up on any Floor (a trap, not a Room's own monsters): it grows as if it lived there. */
  anywhere?: boolean;
}

const m = (d: MonsterDef) => d;

/** Season 0 bestiary. Stats are v0 and get tuned by the balance tests. */
export const MONSTERS: MonsterDef[] = [
  // Floors 1–3: goblin warrens and beasts
  m({ id: 'giant-rat', name: text('Giant rat', 'Гигантская крыса'), theme: 'warrens', kin: 'beast', art: '/art/tokens/giant-rat.webp', role: 'minion', hp: 4, ac: 11, attack: 3, damage: [1, 4, 1], dex: 14, xp: 6, weight: 3 }),
  m({ id: 'goblin', name: text('Goblin', 'Гоблин'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin.webp', role: 'minion', hp: 7, ac: 12, attack: 3, damage: [1, 6, 1], dex: 14, xp: 10, weight: 4 }),
  m({ id: 'goblin-archer', name: text('Goblin archer', 'Гоблин-лучник'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-archer.webp', role: 'minion', hp: 6, ac: 12, attack: 3, damage: [1, 6, 1], dex: 16, xp: 10, weight: 2,
    powers: [{ id: 'quick' }] }),
  m({ id: 'goblin-cutpurse', name: text('Goblin cutpurse', 'Гоблин-карманник'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-cutpurse.webp', role: 'minion', hp: 6, ac: 13, attack: 4, damage: [1, 4, 1], dex: 16, xp: 12, weight: 2,
    powers: [{ id: 'thief' }] }),
  m({ id: 'wolf', name: text('Wolf', 'Волк'), theme: 'warrens', kin: 'beast', art: '/art/tokens/wolf.webp', role: 'brute', hp: 11, ac: 12, attack: 3, damage: [2, 4, 0], dex: 15, xp: 18, weight: 2,
    powers: [{ id: 'pack' }] }),
  m({ id: 'goblin-chieftain', name: text('Goblin chieftain', 'Вождь гоблинов'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-chieftain.webp', role: 'miniboss', hp: 34, ac: 15, attack: 5, damage: [2, 6, 3], dex: 14, xp: 90, weight: 0,
    escort: ['goblin-archer'] }),

  // Floors 4–6: undead crypts
  m({ id: 'skeleton', name: text('Skeleton', 'Скелет'), theme: 'crypts', kin: 'undead', art: '/art/tokens/skeleton.webp', role: 'minion', hp: 13, ac: 13, attack: 4, damage: [1, 6, 2], dex: 14, xp: 25, weight: 4,
    powers: [{ id: 'brittle' }] }),
  m({ id: 'zombie', name: text('Zombie', 'Зомби'), theme: 'crypts', kin: 'undead', art: '/art/tokens/zombie.webp', role: 'minion', hp: 20, ac: 8, attack: 3, damage: [1, 6, 1], dex: 6, xp: 25, weight: 3,
    powers: [{ id: 'undying' }] }),
  m({ id: 'ghoul', name: text('Ghoul', 'Упырь'), theme: 'crypts', kin: 'undead', art: '/art/tokens/ghoul.webp', role: 'brute', hp: 22, ac: 12, attack: 4, damage: [2, 6, 1], dex: 15, xp: 45, weight: 2,
    powers: [{ id: 'paralyze', dc: 10 }] }),
  m({ id: 'wraith', name: text('Wraith', 'Призрак'), theme: 'crypts', kin: 'undead', art: '/art/tokens/wraith.webp', role: 'brute', hp: 28, ac: 13, attack: 5, damage: [2, 8, 1], dex: 16, xp: 90, weight: 1,
    powers: [{ id: 'drain' }] }),
  m({ id: 'bone-knight', name: text('Bone knight', 'Костяной рыцарь'), theme: 'crypts', kin: 'undead', art: '/art/tokens/bone-knight.webp', role: 'miniboss', hp: 70, ac: 17, attack: 6, damage: [2, 8, 5], dex: 12, xp: 250, weight: 0,
    powers: [{ id: 'undying' }], escort: ['skeleton'] }),

  // Floors 7–9: demon-touched depths
  m({ id: 'cultist', name: text('Cultist', 'Культист'), theme: 'depths', kin: 'humanoid', art: '/art/tokens/cultist.webp', role: 'minion', hp: 20, ac: 12, attack: 5, damage: [1, 8, 2], dex: 12, xp: 45, weight: 3,
    powers: [{ id: 'mend', dice: [2, 8] }] }),
  m({ id: 'imp', name: text('Imp', 'Бес'), theme: 'depths', kin: 'demon', art: '/art/tokens/imp.webp', role: 'minion', hp: 16, ac: 13, attack: 5, damage: [1, 6, 2], dex: 17, xp: 50, weight: 4,
    powers: [{ id: 'burn', turns: 2, dice: [1, 4] }] }),
  m({ id: 'hellhound', name: text('Hellhound', 'Адская гончая'), theme: 'depths', kin: 'demon', art: '/art/tokens/hellhound.webp', role: 'brute', hp: 42, ac: 15, attack: 6, damage: [1, 8, 3], dex: 14, xp: 100, weight: 2,
    powers: [{ id: 'breath', dice: [3, 6], dc: 13 }] }),
  m({ id: 'demon-brute', name: text('Demon brute', 'Демон-громила'), theme: 'depths', kin: 'demon', art: '/art/tokens/demon-brute.webp', role: 'brute', hp: 60, ac: 14, attack: 7, damage: [1, 8, 3], dex: 10, xp: 160, weight: 1,
    powers: [{ id: 'multiattack', attacks: 2 }] }),
  m({ id: 'horned-tyrant', name: text('Horned tyrant', 'Рогатый тиран'), theme: 'depths', kin: 'demon', art: '/art/tokens/horned-tyrant.webp', role: 'miniboss', hp: 85, ac: 16, attack: 8, damage: [1, 10, 3], dex: 12, xp: 500, weight: 0,
    powers: [{ id: 'multiattack', attacks: 2 }, { id: 'frighten', dc: 14, rounds: 2 }], escort: ['imp'] }),

  // Floor 10: the Dragon's lair
  m({ id: 'kobold', name: text('Kobold', 'Кобольд'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/kobold.webp', role: 'minion', hp: 24, ac: 14, attack: 7, damage: [1, 8, 3], dex: 15, xp: 60, weight: 3,
    powers: [{ id: 'pack' }] }),
  m({ id: 'drake', name: text('Drake', 'Дрейк'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/drake.webp', role: 'brute', hp: 90, ac: 17, attack: 9, damage: [2, 8, 4], dex: 12, xp: 250, weight: 2,
    powers: [{ id: 'breath', dice: [7, 6], dc: 15 }] }),
  m({ id: 'ancient-dragon', name: text('The Ancient Dragon', 'Древний дракон'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/dragon.webp', role: 'boss', hp: 700, ac: 20, attack: 13, damage: [2, 10, 6], dex: 10, xp: 5000, weight: 0,
    powers: [{ id: 'multiattack', attacks: 2 }, { id: 'breath', dice: [12, 6], dc: 17 }, { id: 'frighten', dc: 15, rounds: 2 }, { id: 'enrage' }] }),

  // Anywhere: the prisoner who isn't one (Prisoner).
  m({ id: 'doppelganger', name: text('Doppelganger', 'Двойник'), theme: 'warrens', kin: 'humanoid', art: '/art/tokens/doppelganger.webp', role: 'brute', hp: 20, ac: 13, attack: 5, damage: [1, 8, 2], dex: 16, xp: 45, weight: 0,
    powers: [{ id: 'quick' }], anywhere: true }),

  // Anywhere: the chest that bites (Three chests).
  m({ id: 'mimic', name: text('Mimic', 'Мимик'), theme: 'warrens', kin: 'beast', art: '/art/tokens/mimic.webp', role: 'brute', hp: 16, ac: 12, attack: 4, damage: [1, 8, 2], dex: 12, xp: 40, weight: 0, anywhere: true }),
];

const BY_ID = new Map(MONSTERS.map((d) => [d.id, d]));

export function monsterById(id: string): MonsterDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown monster "${id}"`);
  return def;
}

// ─── Elite packs ──────────────────────────────────────────────────────────

export const ELITES = ['gilded', 'frenzied', 'armored', 'vampiric', 'swift'] as const;
export type EliteId = (typeof ELITES)[number];

/**
 * From Floor 2 down, a group sometimes follows an elite: its strongest monster
 * gets one of these (v0). Every elite has more health and is worth double XP and
 * one more Item. Gilded ones are what Players hope for: triple gold.
 */
export const ELITE_CHANCE: Record<ThemeId, number> = { warrens: 0.1, crypts: 0.15, depths: 0.2, lair: 0.25 };
export const ELITE_HP = 1.25;
export const GILDED_HP = 1.5;
export const GILDED_GOLD = 3;
