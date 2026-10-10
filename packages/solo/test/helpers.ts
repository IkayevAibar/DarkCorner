import type { SoloApp } from '../src/app.js';
import { bindWorld } from '../src/backend.js';
import { upsertPlayer } from '../src/services/players.js';
import { emptyWorld } from '../src/world.js';

// apps/api/test/helpers.ts for the solo backend: the scenarios ported from the
// server run on an empty in-memory World on the device's clock, as the server's
// tests run on an empty database.

/** A fresh, empty World: no Player, no Season. */
export async function resetDatabase(): Promise<void> {
  bindWorld(emptyWorld({ clock: 'real' }));
}

/** Solo has no cookies; the scenarios pass this along anyway. */
export function cookiesFrom(): string {
  return '';
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');

/**
 * The server's dev login: makes the Player, and returns the cookie that plays as
 * it (solo otherwise plays as the World's first Player).
 */
export async function devLogin(_app: SoloApp, name: string, admin = false): Promise<string> {
  const player = await upsertPlayer({ discordId: `dev-${slug(name)}`, username: name, globalName: null, avatar: null }, { admin });
  return `solo_player=${encodeURIComponent(player.id)}`;
}
