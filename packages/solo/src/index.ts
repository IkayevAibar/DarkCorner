// The solo game's local backend (docs/plan-solo-offline.md): the server's
// services on an in-memory World, answering the web's API calls offline.
export { type Backend, type SaveStorage, type SoloResult, bindWorld, createBackend, newWorld } from './backend.js';
export { browserStorage, indexedDbStorage, memoryStorage } from './storage.js';
export { type World, type WorldSettings, parseWorld, serializeWorld } from './world.js';
export { dayOf } from './gameClock.js';
export type { CompanionOffer, CompanionView } from './services/companion.js';
