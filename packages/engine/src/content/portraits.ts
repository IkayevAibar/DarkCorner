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

/**
 * Season 0 aims for two portraits per Race and Class (32). Until they are
 * painted, the four from the look test plus a hooded silhouette stand in.
 */
export const PORTRAITS: PortraitDef[] = [
  { id: 'human-fighter-1', race: 'human', class: 'fighter', url: '/art/portraits/human-fighter-1.png' },
  { id: 'elf-wizard-1', race: 'elf', class: 'wizard', url: '/art/portraits/elf-wizard-1.png' },
  { id: 'halfling-rogue-1', race: 'halfling', class: 'rogue', url: '/art/portraits/halfling-rogue-1.png' },
  { id: 'dwarf-cleric-1', race: 'dwarf', class: 'cleric', url: '/art/portraits/dwarf-cleric-1.png' },
  { id: 'hooded', race: null, class: null, url: '/art/portraits/hooded.svg' },
];

export function portraitById(id: string): PortraitDef | undefined {
  return PORTRAITS.find((p) => p.id === id);
}

/** Portraits offered for a Race and Class: the exact matches first, then the ones for anyone. */
export function portraitsFor(race: RaceId, cls: ClassId): PortraitDef[] {
  const exact = PORTRAITS.filter((p) => p.race === race && p.class === cls);
  const anyone = PORTRAITS.filter((p) => p.race === null && p.class === null);
  return [...exact, ...anyone];
}
