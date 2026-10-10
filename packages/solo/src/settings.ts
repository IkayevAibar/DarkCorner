import type { WorldSettings } from './world.js';

/**
 * The loaded World's settings (docs/plan-solo-offline.md, decisions 5 and 6):
 * difficulty and Iron mode, chosen when the Save starts. The backend points this
 * at each World it loads, as it does the clock.
 */
let current: WorldSettings = { difficulty: 'normal', iron: false };

export function useSettings(settings: WorldSettings): void {
  current = settings;
}

export const worldSettings = (): WorldSettings => current;
