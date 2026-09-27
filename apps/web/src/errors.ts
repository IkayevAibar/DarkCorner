import { ApiRequestError } from './api';
import type { I18n } from './i18n';
import { en, type MessageKey } from './i18n/en';

/** A player-facing line for a failed request: its err.<code> text, or a generic one naming the code. */
export function describeError(t: I18n['t'], error: unknown): string {
  const code = error instanceof ApiRequestError ? (error.body?.error ?? 'error') : 'error';
  const key = `err.${code}`;
  return key in en ? t(key as MessageKey) : t('err.generic', { code });
}
