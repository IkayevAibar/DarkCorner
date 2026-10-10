import type { Player } from '@prisma/client';
import type { LocalizedText, PushKind, PushView } from '@dark/shared';
import { ApiError } from '../lib/errors.js';
import type { Tx } from './ledger.js';

/**
 * Push notifications need a server, so solo sends none (docs/plan-solo-offline.md,
 * section 3; local notifications may come later). The services still call
 * notify() and notifyAll(), which do nothing here.
 */
export interface PushMessage {
  kind: PushKind;
  title: LocalizedText;
  body: LocalizedText;
  url?: string;
  tag?: string;
}

export async function notify(_tx: Tx, _playerId: string, _message: PushMessage, _at?: Date): Promise<void> {}

export async function notifyAll(_tx: Tx, _message: PushMessage, _at?: Date): Promise<number> {
  return 0;
}

const offline = () => ApiError.notFound('push_offline', 'Notifications come with the online game, not the offline one');

export async function pushView(_player: Player): Promise<PushView> {
  throw offline();
}

export async function subscribe(_player: Player, _body: unknown): Promise<PushView> {
  throw offline();
}

export async function unsubscribe(_player: Player, _endpoint: string): Promise<PushView> {
  throw offline();
}

export async function setPushPrefs(_player: Player, _off: PushKind[]): Promise<PushView> {
  throw offline();
}

export async function testPush(_player: Player, _endpoint: string): Promise<{ sent: boolean }> {
  throw offline();
}
