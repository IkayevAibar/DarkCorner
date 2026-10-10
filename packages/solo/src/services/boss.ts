import type { Prisma, Season } from '@prisma/client';
import { BOSS_LOOT, FINALE_MS, PODIUM, chestBase, createRng, dropOdds } from '@dark/engine';
import { newSeed } from '../lib/seed.js';
import { broadcast } from './broadcast.js';
import { feed } from './feed.js';
import { type Outcome, heroFloor, markCleared, t } from './fights.js';
import { countDeeds } from './deeds.js';
import type { HeroWithItems, Tx } from './ledger.js';
import { dropGear, dropStack, withGoldFind } from './loot.js';
import { lockSeason, playerName } from './relics.js';
import { schedule } from './scheduler.js';
import { gameNow } from '../gameClock.js';

const PLACE_KIND = ['champion', 'second', 'third'] as const;

/**
 * After a won fight against the Boss: the podium (the first win makes the
 * Champion and starts the Finale), the Boss's loot, and a quiet lair for this
 * Hero for a day (docs/design.md → Seasons).
 */
export async function bossVictory(tx: Tx, hero: HeroWithItems, season: Season, floor: number, roomId: number, out: Outcome): Promise<void> {
  const now = gameNow();
  await countDeeds(tx, hero, { dragon: 1 }, out);
  await lockSeason(tx, season.id);
  const fresh = await tx.season.findUniqueOrThrow({ where: { id: season.id } });
  const kills = await tx.bossKill.findMany({ where: { seasonId: season.id } });
  const placed = kills.some((k) => k.playerId === hero.playerId);

  if (!placed && kills.length < PODIUM && fresh.status !== 'ENDED') {
    const place = kills.length + 1;
    await tx.bossKill.create({ data: { seasonId: season.id, playerId: hero.playerId, heroId: hero.id, heroName: hero.name, place } });
    await tx.hallEntry.create({
      data: {
        seasonNumber: season.number, kind: PLACE_KIND[place - 1]!, playerId: hero.playerId,
        playerName: await playerName(tx, hero.playerId), heroName: hero.name, detail: { level: hero.level } as Prisma.InputJsonValue,
      },
    });
    await feed(tx, season, hero, 'boss-kill', { place });
    if (place === 1) {
      const wipeAt = new Date(now.getTime() + FINALE_MS);
      await tx.season.update({ where: { id: season.id }, data: { status: 'FINALE', finaleAt: now } });
      await schedule(tx, 'wipe', wipeAt, { seasonId: season.id });
      await broadcast(tx, {
        en: `🐉 ${hero.name} has slain the Ancient Dragon and is the Champion of Season ${season.number}! The Finale begins: 72 hours to take 2nd and 3rd place before the Wipe.`,
        ru: `🐉 Древний дракон повержен! ${hero.name} — чемпион сезона ${season.number}! Начинается финал: 72 часа, чтобы занять 2-е и 3-е места до вайпа.`,
      });
      out.notices.push(t(
        'The Dragon falls. You are the Champion of this Season! The Finale has begun.',
        'Дракон пал. Вы — чемпион этого сезона! Начался финал.',
      ));
    } else {
      await broadcast(tx, {
        en: `🐉 ${hero.name} has slain the Dragon too and takes ${place === 2 ? '2nd' : '3rd'} place.`,
        ru: `🐉 Ещё одна победа над драконом: ${hero.name} занимает ${place}-е место.`,
      });
      out.notices.push(t(`The Dragon falls. You take ${place === 2 ? '2nd' : '3rd'} place on the podium!`, `Дракон пал. Вы занимаете ${place}-е место!`));
    }
  } else {
    out.notices.push(t('The Dragon falls again. Its hoard is yours.', 'Дракон снова пал. Его сокровища ваши.'));
  }

  // The hoard.
  await dropGear(tx, hero, season, { floor, count: BOSS_LOOT.items, odds: dropOdds(10), source: 'boss' }, out);
  await dropStack(tx, hero, season, chestBase(BOSS_LOOT.chest), 1, out);
  const rng = createRng(newSeed());
  const gold = withGoldFind(hero, rng.int(BOSS_LOOT.gold[0], BOSS_LOOT.gold[1]));
  await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
  hero.carriedGold += gold;
  out.gold += gold;
  // The lair stays quiet for this Hero for a day.
  await markCleared(tx, await heroFloor(tx, hero.id, floor), roomId, now);
}
