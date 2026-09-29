import type { ClassId } from './classes.js';
import type { RaceId } from './races.js';

export interface PortraitDef {
  id: string;
  /** Null: suits any Race or Class. */
  race: RaceId | null;
  class: ClassId | null;
  /** Served by the web app from apps/web/public. */
  url: string;
}

const RACES_PAINTED: RaceId[] = ['human', 'elf', 'dwarf', 'halfling'];
const CLASSES_PAINTED: ClassId[] = ['fighter', 'rogue', 'wizard', 'cleric'];

/**
 * Season 0's portraits: two painted for every Race and Class (sources under art/,
 * 256 px WebP copies under apps/web/public), and a hooded silhouette for anyone.
 */
export const PORTRAITS: PortraitDef[] = [
  ...RACES_PAINTED.flatMap((race) => CLASSES_PAINTED.flatMap((cls) => [1, 2].map((n) => ({
    id: `${race}-${cls}-${n}`, race, class: cls, url: `/art/portraits/${race}-${cls}-${n}.webp`,
  })))),
  { id: 'hooded', race: null, class: null, url: '/art/portraits/hooded.svg' },
];

export function portraitById(id: string): PortraitDef | undefined {
  return PORTRAITS.find((p) => p.id === id);
}

/** Classes not painted yet borrow a painted Class's portraits for the same Race until they are. */
const STAND_INS: Partial<Record<ClassId, ClassId>> = { barbarian: 'fighter', ranger: 'rogue' };

/** Portraits offered for a Race and Class: the exact matches (or borrowed ones) first, then the ones for anyone. */
export function portraitsFor(race: RaceId, cls: ClassId): PortraitDef[] {
  const painted = (c: ClassId) => PORTRAITS.filter((p) => p.race === race && p.class === c);
  const exact = painted(cls);
  const stand = STAND_INS[cls];
  const borrowed = exact.length === 0 && stand ? painted(stand) : [];
  const anyone = PORTRAITS.filter((p) => p.race === null && p.class === null);
  return [...exact, ...borrowed, ...anyone];
}
