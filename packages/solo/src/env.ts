/**
 * The server's settings (apps/api/src/env.ts) as the ported services read them.
 * Solo has no server: no sign-in hub, no Discord, no push keys.
 */
export const env = {
  NODE_ENV: 'production' as 'development' | 'production' | 'test',
  PUBLIC_WEB_URL: 'https://localhost',
  SSO_SECRET: undefined as string | undefined,
  ACCOUNT_ORIGIN: 'https://localhost',
  ADMIN_DISCORD_IDS: [] as string[],
  DISCORD_WEBHOOK_URL: undefined as string | undefined,
  VAPID_PUBLIC_KEY: undefined as string | undefined,
  VAPID_PRIVATE_KEY: undefined as string | undefined,
  /** The game clock's zone: in-game days turn at midnight UTC, as the server's day numbers do. */
  SERVER_TIMEZONE: 'UTC',
};

export const ssoEnabled = false;
export const devLoginEnabled = false;
export const accountOrigin = env.ACCOUNT_ORIGIN;

export function accountLoginUrl(_returnTo: string): string {
  return '';
}
