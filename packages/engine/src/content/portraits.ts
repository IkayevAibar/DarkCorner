import { CLASSES, type ClassId } from './classes.js';
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
/** Every Class is painted (the last eight on 2026-10-10, Codex task 24). */
const CLASSES_PAINTED: readonly ClassId[] = CLASSES;

/**
 * The portraits: two painted for every Race and Class (sources under art/portraits,
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

/**
 * A Class not painted yet borrows a painted Class's portraits for the same Race until it is
 * (say `bard: 'rogue'`). None does now; Heroes made while theirs were borrowed keep the portrait they chose.
 */
const STAND_INS: Partial<Record<ClassId, ClassId>> = {};

/** The Class whose portraits a Class wears: its own once they're painted, a stand-in's until then. */
export const portraitClass = (cls: ClassId): ClassId =>
  PORTRAITS.some((p) => p.class === cls) ? cls : (STAND_INS[cls] ?? cls);

/** Portraits offered for a Race and Class: the ones it wears first, then the ones for anyone. */
export function portraitsFor(race: RaceId, cls: ClassId): PortraitDef[] {
  const wears = portraitClass(cls);
  const own = PORTRAITS.filter((p) => p.race === race && p.class === wears);
  const anyone = PORTRAITS.filter((p) => p.race === null && p.class === null);
  return [...own, ...anyone];
}
