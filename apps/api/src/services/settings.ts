import type { Tx } from './ledger.js';

// Server-wide switches an admin flips on the admin page.

/** Whether everyone who signs in is let in at once, or new Players wait for an admin (docs/design.md → Who can play). */
export async function gateOpen(tx: Tx): Promise<boolean> {
  const row = await tx.setting.findUnique({ where: { key: 'gate' } });
  return (row?.value as { open?: boolean } | undefined)?.open === true;
}

export async function setGate(tx: Tx, open: boolean): Promise<void> {
  await tx.setting.upsert({ where: { key: 'gate' }, create: { key: 'gate', value: { open } }, update: { value: { open } } });
}
