/**
 * The contract between the API and the web app: every payload that crosses the
 * wire is defined here once, with zod, and both sides import it.
 *
 * Changing anything in this package needs the owner's approval in the pull
 * request (AGENTS.md) — Claude and Codex both build against it.
 */
export * from './auth.js';
export * from './admin.js';
export * from './errors.js';
export * from './items.js';
export * from './heroes.js';
export * from './labyrinth.js';
export * from './economy.js';
export * from './season.js';
export * from './push.js';
export * from './delve.js';
