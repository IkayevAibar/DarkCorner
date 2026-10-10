import { type Backend, type SoloResult, browserStorage, createBackend } from '@dark/solo';
import { followGameClock, gameClockMoved } from './time';

/**
 * The solo build's backend (docs/plan-solo-offline.md, section 5): the game's
 * rules and the save run here, in the browser or the app, and api.ts asks them
 * instead of a server. Only the solo build loads this module.
 */
let backend: Promise<Backend> | null = null;

export function soloRequest(method: string, url: string, body?: unknown): Promise<SoloResult> {
  backend ??= createBackend({ storage: browserStorage() }).then((b) => {
    // Countdowns and timers on the screens count in the World's time, not the phone's.
    if (b.world.clock.mode === 'days') followGameClock(() => b.world.clock.now);
    return b;
  });
  return backend.then(async (b) => {
    const before = b.world.clock.now;
    const result = await b.handle(method, url, body);
    if (b.world.clock.now !== before) gameClockMoved();
    return result;
  });
}
