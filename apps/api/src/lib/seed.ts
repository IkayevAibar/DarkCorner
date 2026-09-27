import { randomBytes } from 'node:crypto';

/** A fresh seed for the engine's Rng: unguessable, and stored so the roll can be replayed. */
export const newSeed = (): string => randomBytes(16).toString('hex');
