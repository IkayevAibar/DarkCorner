/** A fresh seed for the engine's Rng, stored so the roll can be replayed (the server's lib/seed.ts, without Node). */
export function newSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
