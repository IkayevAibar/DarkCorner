import { z } from 'zod';

export const LOCALES = ['en', 'ru'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

/** A Player waits for an admin before they can create a Hero. */
export const playerStatusSchema = z.enum(['pending', 'approved', 'banned']);
export type PlayerStatus = z.infer<typeof playerStatusSchema>;

export const playerSchema = z.object({
  id: z.string(),
  /** Display name: the Discord global name, or the username without one. */
  name: z.string(),
  avatarUrl: z.string().nullable(),
  /** Null until the Player picks a language; the browser's language applies until then. */
  locale: localeSchema.nullable(),
  isAdmin: z.boolean(),
  status: playerStatusSchema,
});
export type PlayerView = z.infer<typeof playerSchema>;

/** GET /api/me */
export const meResponseSchema = z.object({ player: playerSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

/** PATCH /api/me */
export const updateMeRequestSchema = z.object({ locale: localeSchema });
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

/** GET /auth/status: how signing in works on this deployment. */
export const authStatusSchema = z.object({
  /** True when sign-in happens at the ugolok.world hub. */
  sso: z.boolean(),
  /** Where the "Sign in" button goes when `sso` is on. */
  loginUrl: z.string().nullable(),
  /** Where signing out goes when `sso` is on. */
  logoutUrl: z.string().nullable(),
  /** Local development only: sign in as anyone, no Discord needed. */
  devLogin: z.boolean(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

/** POST /auth/dev-login */
export const devLoginRequestSchema = z.object({
  name: z.string().trim().min(2).max(32),
  admin: z.boolean().default(false),
});
export type DevLoginRequest = z.input<typeof devLoginRequestSchema>;

/** POST /auth/logout: `redirect` is set when the hub has to finish signing out. */
export const logoutResponseSchema = z.object({ ok: z.literal(true), redirect: z.string().nullable() });
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

/**
 * GET /api/sso/summary, read by the hub's account dashboard. `registered: false`
 * means "signed in to the hub but never opened this game" — not an error.
 */
export const ssoSummarySchema = z.object({
  registered: z.boolean(),
  profile: z
    .object({
      name: z.string(),
      status: playerStatusSchema,
      /** The hub card's details: the Hero this Season, if there is one. */
      hero: z
        .object({
          name: z.string(),
          level: z.number().int(),
          bestFloor: z.number().int(),
          bestItem: z.object({ name: z.object({ en: z.string(), ru: z.string() }), tier: z.string() }).nullable(),
        })
        .nullable()
        .optional(),
    })
    .nullable(),
});
export type SsoSummary = z.infer<typeof ssoSummarySchema>;
