import type { LocalizedText } from '@dark/shared';
import { env } from '../env.js';
import type { Tx } from './ledger.js';
import { onJob, schedule } from './scheduler.js';
import { gameNow } from '../gameClock.js';

/**
 * A Broadcast to the friends' Discord channel (docs/design.md → Feed and
 * broadcasts). It is queued as a job inside the caller's transaction, so it only
 * goes out if the thing it announces really happened, and Discord being down
 * never fails a Player's action.
 *
 * Solo: there is no webhook (env.ts), so the job ends at once. The texts stay in
 * the Job table, the raw material for the Chronicle (docs/plan-solo-offline.md).
 */
export async function broadcast(tx: Tx, text: LocalizedText, at = gameNow()): Promise<void> {
  await schedule(tx, 'broadcast', at, { text });
}

onJob('broadcast', async (payload) => {
  if (!env.DISCORD_WEBHOOK_URL) return;
  const text = payload.text as LocalizedText;
  // Both languages: the friends' channel reads Russian and English.
  const content = `${text.ru}\n${text.en}`.slice(0, 1900);
  const response = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) throw new Error(`Discord webhook answered ${response.status}`);
});
