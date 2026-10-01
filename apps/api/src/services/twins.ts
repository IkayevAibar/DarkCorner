import type { Season } from '@prisma/client';
import { createRng, rollBondRings } from '@dark/engine';
import { newSeed } from '../lib/seed.js';
import { feed } from './feed.js';
import { type Outcome, t } from './fights.js';
import { gearData, toItemView } from './items.js';
import type { HeroWithItems, Tx } from './ledger.js';

// The Twin Wardens (docs/design.md → Twin doors): behind a Twin door on Floors 1–9, a
// fight only a Duo can open. Their fight pays each Hero as a Mini-boss's would, with a
// hoard from two Floors deeper (fights.ts); beating them also makes the pair's Bond rings.

/**
 * The Wardens fall, both Heroes standing: each takes a half of one new pair of Bond rings,
 * into the Bag even when it is full, as a Relic would. The Feed tells everyone.
 */
export async function grantBondRings(tx: Tx, season: Season, floor: number, pair: [[HeroWithItems, Outcome], [HeroWithItems, Outcome]]): Promise<void> {
  const seed = newSeed();
  const halves = rollBondRings(createRng(seed), floor);
  for (const [i, [hero, out]] of pair.entries()) {
    const [other] = pair[1 - i as 0 | 1];
    const item = await tx.item.create({
      data: { ...gearData(halves[i]!, seed), seasonId: season.id, heroId: hero.id, place: 'BAG', bond: seed, bondWith: other.name },
    });
    hero.items.push(item);
    out.loot.push(toItemView(item));
    out.notices.push(t(
      `The Wardens leave a pair of Bond rings: one for you, one for ${other.name}. Worn by you both in a Duo, they count twice.`,
      `Стражи оставляют пару колец уз: одно вам, другое — герою ${other.name}. Если в дуэте носить оба, их бонусы считаются дважды.`,
    ));
  }
  const [[a], [b]] = pair;
  await tx.rollLog.create({ data: { playerId: a.playerId, kind: 'drop', seed, detail: { floor, source: 'twin', tier: halves[0].tier, partner: b.id } } });
  await feed(tx, season, a, 'twin', { partner: b.name, floor });
}
