import type { Player } from '@prisma/client';
import type { AdminPlayer, Locale, PlayerStatus, PlayerView } from '@dark/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';

export interface DiscordIdentity {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

const isConfiguredAdmin = (discordId: string) => env.ADMIN_DISCORD_IDS.includes(discordId);

/**
 * Creates the Player on first sight and refreshes their Discord details after.
 * Admins from ADMIN_DISCORD_IDS are approved on the spot; everyone else waits
 * for an admin. Admin rights are only ever added here, never removed, so a
 * dev-login admin survives an API restart.
 */
export async function upsertPlayer(identity: DiscordIdentity, opts: { admin?: boolean } = {}): Promise<Player> {
  const admin = opts.admin === true || isConfiguredAdmin(identity.discordId);
  const now = new Date();
  const player = await prisma.player.upsert({
    where: { discordId: identity.discordId },
    create: {
      discordId: identity.discordId,
      username: identity.username,
      globalName: identity.globalName,
      avatar: identity.avatar,
      isAdmin: admin,
      approvedAt: admin ? now : null,
    },
    update: {
      username: identity.username,
      globalName: identity.globalName,
      avatar: identity.avatar,
      ...(admin ? { isAdmin: true } : {}),
    },
  });
  if (player.isAdmin && !player.approvedAt) {
    return prisma.player.update({ where: { id: player.id }, data: { approvedAt: now } });
  }
  return player;
}

export function playerStatus(player: Pick<Player, 'approvedAt' | 'bannedAt'>): PlayerStatus {
  if (player.bannedAt) return 'banned';
  return player.approvedAt ? 'approved' : 'pending';
}

/** Discord CDN link. Dev-login Players have no real snowflake and no avatar. */
function avatarUrl(player: Player): string | null {
  if (!/^\d+$/.test(player.discordId)) return null;
  if (player.avatar) return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png?size=128`;
  const index = Number((BigInt(player.discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

const asLocale = (value: string | null): Locale | null => (value === 'ru' || value === 'en' ? value : null);

export function toPlayerView(player: Player): PlayerView {
  return {
    id: player.id,
    name: player.globalName ?? player.username,
    avatarUrl: avatarUrl(player),
    locale: asLocale(player.locale),
    isAdmin: player.isAdmin,
    status: playerStatus(player),
  };
}

export function toAdminPlayer(player: Player): AdminPlayer {
  return { ...toPlayerView(player), discordId: player.discordId, createdAt: player.createdAt.toISOString() };
}
