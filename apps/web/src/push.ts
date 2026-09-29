import type { Locale, PushView } from '@dark/shared';
import { api } from './api';

/**
 * Push notifications on this device (docs/design.md → Notifications). The browser
 * keeps the subscription; the server keeps a copy to send to, and which kinds the
 * Player wants. An iPhone only offers them once the game is on the home screen.
 */
export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** unsupported: this browser can't; blocked: the Player said no to the browser's prompt. */
export type DevicePush = 'unsupported' | 'blocked' | 'off' | 'on';

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function deviceSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function devicePush(): Promise<DevicePush> {
  if (!pushSupported) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return (await deviceSubscription()) ? 'on' : 'off';
}

/** The server's key arrives as base64url; subscribe() wants the raw bytes. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const binary = atob((key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function madeWith(sub: PushSubscription, key: string): boolean {
  const used = sub.options.applicationServerKey;
  if (!used) return false;
  const a = new Uint8Array(used);
  const b = keyBytes(key);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

const timeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
};

/** Tells the server about this device's subscription (again): it may have forgotten it, or another Player signed in here. */
async function share(sub: PushSubscription, locale: Locale): Promise<PushView> {
  const json = sub.toJSON();
  return api.pushSubscribe({
    endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }, timeZone: timeZone(), locale,
  });
}

/** Asks the browser, subscribes, and tells the server. 'blocked' if the Player says no. */
export async function turnPushOn(key: string, locale: Locale): Promise<PushView | 'blocked'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'blocked';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // One made with an old server key can never be sent to.
  if (sub && !madeWith(sub, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  return share(sub, locale);
}

export async function turnPushOff(): Promise<PushView | null> {
  const sub = await deviceSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe().catch(() => false);
  return api.pushUnsubscribe(endpoint);
}

/** The server's side for a device that is on, re-shared so both agree. */
export async function syncPush(locale: Locale): Promise<PushView | null> {
  const sub = await deviceSubscription();
  return sub ? share(sub, locale) : null;
}

export async function testPush(): Promise<boolean> {
  const sub = await deviceSubscription();
  if (!sub) return false;
  return (await api.pushTest(sub.endpoint)).sent;
}
