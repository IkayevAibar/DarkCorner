import { type Backend, type SoloResult, browserStorage, createBackend } from '@dark/solo';

/**
 * The solo build's backend (docs/plan-solo-offline.md, section 5): the game's
 * rules and the save run here, in the browser or the app, and api.ts asks them
 * instead of a server. Only the solo build loads this module.
 */
let backend: Promise<Backend> | null = null;

export function soloRequest(method: string, url: string, body?: unknown): Promise<SoloResult> {
  backend ??= createBackend({ storage: browserStorage() });
  return backend.then((b) => b.handle(method, url, body));
}
