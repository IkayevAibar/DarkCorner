import type { Season, VaultOpening } from '@prisma/client';
import {
  DEEP_FLOOR, RELIC_CHANCE, VAULT, chestBase, createRng, dropOdds,
} from '@dark/engine';
import { env } from '../env.js';
import { newSeed } from '../lib/seed.js';
import { feed } from './feed.js';
import { type Outcome, t } from './fights.js';
import type { HeroWithItems, Tx } from './ledger.js';
import { dropGear, dropStack, withGoldFind } from './loot.js';
import { grantRelic, lockSeason } from './relics.js';

export type VaultState = { state: 'open' | 'sealed' | 'claimed'; opensAt: Date | null; opening: VaultOpening | null };

/**
 * A Vault is open until someone claims it. An announcement seals it again until
 * its opening time, refilled, for the first Hero in after that (docs/design.md →
 * Special rooms and announced vaults).
 */
export async function vaultState(tx: Tx, seasonId: string, floor: number, room: number, now: Date): Promise<VaultState> {
  const opening = await tx.vaultOpening.findFirst({ where: { seasonId, floor, room }, orderBy: { opensAt: 'desc' } });
  if (opening && opening.opensAt > now) return { state: 'sealed', opensAt: opening.opensAt, opening };
  const claim = await tx.specialClaim.findUnique({ where: { seasonId_floor_room: { seasonId, floor, room } } });
  if (!claim) return { state: 'open', opensAt: null, opening };
  if (opening && !opening.claimedAt && claim.claimedAt < opening.opensAt) return { state: 'open', opensAt: null, opening };
  return { state: 'claimed', opensAt: null, opening: null };
}

const clock = (at: Date) => at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: env.SERVER_TIMEZONE });

/** Walking into a Vault: the first Hero in takes everything. */
export async function enterVault(tx: Tx, hero: HeroWithItems, season: Season, floor: number, room: number, now: Date, out: Outcome): Promise<void> {
  await lockSeason(tx, season.id);
  const vault = await vaultState(tx, season.id, floor, room, now);
  if (vault.state === 'sealed') {
    const at = clock(vault.opensAt!);
    out.notices.push(t(`A sealed Vault. Its seals break at ${at} (game time).`, `Запечатанная сокровищница. Печати спадут в ${at} (время игры).`));
    return;
  }
  if (vault.state === 'claimed') {
    out.notices.push(t('The Vault stands open and empty. Someone got here first.', 'Сокровищница открыта и пуста. Кто-то успел раньше.'));
    return;
  }

  await tx.specialClaim.upsert({
    where: { seasonId_floor_room: { seasonId: season.id, floor, room } },
    create: { seasonId: season.id, floor, room, heroId: hero.id, claimedAt: now },
    update: { heroId: hero.id, claimedAt: now },
  });
  if (vault.opening) await tx.vaultOpening.update({ where: { id: vault.opening.id }, data: { claimedAt: now, heroId: hero.id } });

  out.notices.push(t('The Vault is yours!', 'Сокровищница ваша!'));
  await dropGear(tx, hero, season, { floor, count: VAULT.items, odds: dropOdds(Math.min(10, floor + VAULT.floorBonus)), source: 'vault' }, out);
  await dropStack(tx, hero, season, chestBase(floor >= DEEP_FLOOR ? VAULT.deepChest : VAULT.chest), 1, out);
  const rng = createRng(newSeed());
  const gold = withGoldFind(hero, rng.int(VAULT.gold[0], VAULT.gold[1]) * (floor + 1));
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
  hero.carriedGold += gold;
  out.gold += gold;

  const relicChance = vault.opening ? RELIC_CHANCE.announcedVault : floor >= DEEP_FLOOR ? RELIC_CHANCE.deepVault : 0;
  if (relicChance > 0 && rng.chance(relicChance)) await grantRelic(tx, hero, season, floor, vault.opening ? 'announced-vault' : 'vault', out);
  await feed(tx, season, hero, 'vault', { floor, announced: Boolean(vault.opening) });
}
