import type { Player } from '@prisma/client';
import type { AdminPlayer, Locale, PlayerStatus, PlayerView } from '@dark/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { broadcast } from './broadcast.js';
import { gateOpen } from './settings.js';

export interface DiscordIdentity {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

const isConfiguredAdmin = (discordId: string) => env.ADMIN_DISCORD_IDS.includes(discordId);

/** In ADMIN_DISCORD_IDS but not yet an approved admin, say when added after their first visit. */
export const owedAdminRights = (player: Pick<Player, 'discordId' | 'isAdmin' | 'approvedAt'>) =>
  isConfiguredAdmin(player.discordId) && !(player.isAdmin && player.approvedAt);

const nameOf = (p: Pick<Player, 'globalName' | 'username'>) => p.globalName ?? p.username;

/** For the friends' channel: someone new waits at the gate until an admin lets them in. */
const atTheGate = (p: Player) => ({
  en: `🚪 ${nameOf(p)} is waiting at the Labyrinth gate. An admin can let them in: Account → Admin: Players.`,
  ru: `🚪 ${nameOf(p)} ждёт у врат лабиринта. Админ может впустить игрока: Аккаунт → Админ: игроки.`,
});

/** For the friends' channel when an admin lets a Player in, so they know to come back. */
export const letIn = (p: Player) => ({
  en: `⚔️ The gate opens for ${nameOf(p)}. Welcome to the Labyrinth!`,
  ru: `⚔️ Врата открываются для игрока ${nameOf(p)}. Добро пожаловать в лабиринт!`,
});

/** For the friends' channel when an admin opens the gate on everyone who was waiting. */
export const letInAll = (players: Player[]) => {
  if (players.length === 1) return letIn(players[0]!);
  const names = players.map(nameOf);
  const list = (and: string) => `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;
  return {
    en: `⚔️ The gate is open! Welcome to the Labyrinth, ${list('and')}.`,
    ru: `⚔️ Ворота открыты! Добро пожаловать в лабиринт: ${list('и')}.`,
  };
};

/**
 * Creates the Player on first sight and refreshes their Discord details after.
 * Admins from ADMIN_DISCORD_IDS are approved on the spot; everyone else waits
 * for an admin, and the friends' channel hears they are at the gate. Admin
 * rights are only ever added here, never removed, so a dev-login admin
 * survives an API restart.
 */
export async function upsertPlayer(identity: DiscordIdentity, opts: { admin?: boolean } = {}): Promise<Player> {
  const admin = opts.admin === true || isConfiguredAdmin(identity.discordId);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const known = await tx.player.findUnique({ where: { discordId: identity.discordId }, select: { id: true } });
    // An open gate lets someone new straight in; otherwise they wait for an admin.
    const open = !known && !admin && await gateOpen(tx);
    let player = await tx.player.upsert({
      where: { discordId: identity.discordId },
      create: {
        discordId: identity.discordId,
        username: identity.username,
        globalName: identity.globalName,
        avatar: identity.avatar,
        isAdmin: admin,
        approvedAt: admin || open ? now : null,
      },
      update: {
        username: identity.username,
        globalName: identity.globalName,
        avatar: identity.avatar,
        ...(admin ? { isAdmin: true } : {}),
      },
    });
    if (player.isAdmin && !player.approvedAt) {
      player = await tx.player.update({ where: { id: player.id }, data: { approvedAt: now } });
    }
    // Someone new: welcome them if the gate let them in. If it's shut, tell the channel
    // at once, so an admin lets them in while they are still here; people who find it
    // shut rarely come back on their own.
    if (!known && !admin) await broadcast(tx, player.approvedAt ? letIn(player) : atTheGate(player));
    return player;
  });
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
