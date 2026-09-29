import { z } from 'zod';

// Blank counts as absent: compose writes `NAME=` for variables nobody set, and a
// plain .default() never fires against an empty string.
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().default(4100)),
  /** 0.0.0.0 inside Docker; the default keeps a dev API off the local network. */
  API_HOST: z.preprocess(blankToUndefined, z.string().default('127.0.0.1')),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  PUBLIC_WEB_URL: z.preprocess(blankToUndefined, z.string().url().default('http://localhost:5180')),

  /**
   * Must equal SSO_SECRET in the ugolok.world hub's .env: it is the only thing
   * that makes the hub's cookie trustworthy here. Unset = no SSO, dev login on.
   */
  SSO_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(32, 'SSO_SECRET must be at least 32 characters').optional(),
  ),
  ACCOUNT_ORIGIN: z.preprocess(blankToUndefined, z.string().url().default('http://localhost:5175')),

  ADMIN_DISCORD_IDS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),

  DISCORD_WEBHOOK_URL: z.preprocess(blankToUndefined, z.string().url().optional()),

  /**
   * Push notifications' key pair (web-push generate-vapid-keys). Optional: without
   * them the API makes a pair once and keeps it in the database.
   */
  VAPID_PUBLIC_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  VAPID_PRIVATE_KEY: z.preprocess(blankToUndefined, z.string().optional()),

  /** The game clock: Boss gates, Vault openings and "tonight at 21:00" use this zone. */
  SERVER_TIMEZONE: z
    .preprocess(blankToUndefined, z.string().default('Asia/Almaty'))
    .refine(isValidTimeZone, 'SERVER_TIMEZONE must be an IANA time zone name'),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();

/** True once sign-in is delegated to the ugolok.world hub. */
export const ssoEnabled = Boolean(env.SSO_SECRET);

/** The dev login exists only outside production and only without SSO. */
export const devLoginEnabled = !ssoEnabled && env.NODE_ENV !== 'production';

export const accountOrigin = env.ACCOUNT_ORIGIN.replace(/\/+$/, '');

export function accountLoginUrl(returnTo: string): string {
  return `${accountOrigin}/sso/login?next=${encodeURIComponent(returnTo)}`;
}
