import { z } from 'zod';
import { localeSchema } from './auth.js';

// Push notifications to a Player's phone or browser (docs/design.md → Notifications).

/** What a notification can be about; a Player can turn each kind off. */
export const PUSH_KINDS = ['stamina', 'camp', 'gate', 'market'] as const;
export const pushKindSchema = z.enum(PUSH_KINDS);
export type PushKind = z.infer<typeof pushKindSchema>;

/** GET /api/push: what the Account sheet needs to offer notifications. */
export const pushViewSchema = z.object({
  /** The server's public VAPID key, for PushManager.subscribe(). */
  key: z.string(),
  /** Kinds the Player turned off; the rest are on. */
  off: z.array(pushKindSchema),
  /** How many devices get this Player's notifications. */
  devices: z.number().int(),
});
export type PushView = z.infer<typeof pushViewSchema>;

/** POST /api/push/subscribe: a device's PushSubscription, as its toJSON() gives it. */
export const pushSubscribeRequestSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  /** The device's IANA time zone: notifications wait out its night. */
  timeZone: z.string().max(64).nullable(),
  /** The language on screen, for a Player who never picked one. */
  locale: localeSchema,
});
export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequestSchema>;

/** POST /api/push/unsubscribe, and POST /api/push/test for the device that asks. */
export const pushEndpointRequestSchema = z.object({ endpoint: z.string().url().max(2000) });
export type PushEndpointRequest = z.infer<typeof pushEndpointRequestSchema>;

/** PUT /api/push/prefs */
export const pushPrefsRequestSchema = z.object({ off: z.array(pushKindSchema) });
export type PushPrefsRequest = z.infer<typeof pushPrefsRequestSchema>;
