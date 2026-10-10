import type { Hero, Player } from '@prisma/client';
import type { LodgingView } from '@dark/shared';
import { type ClassId, type PathId, SHORT_RESTS, STAMINA_MAX, currentStamina, lodgingPrice, restUses } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { fullHealth } from './heroes.js';
import { dayNumber, lockHero, requireCity, spendGold } from './ledger.js';
import { currentSeason } from './seasons.js';
import { gameNow, sleepTonight } from '../gameClock.js';

// A night at the Tavern (docs/design.md → The City): City gold for full Stamina and
// the short rests back, one night a day (UTC). Each night costs half again as much
// as the last, all Season.

const DAY_MS = 86_400_000;

/** When the next night can be taken: tomorrow's midnight (UTC) if the Hero slept today, else now (null). */
const availableAt = (hero: Hero, now: Date): Date | null =>
  hero.lodgedAt && dayNumber(hero.lodgedAt) === dayNumber(now) ? new Date((dayNumber(now) + 1) * DAY_MS) : null;

function view(hero: Hero, now: Date): LodgingView {
  return {
    price: lodgingPrice(hero.tavernNights),
    nights: hero.tavernNights,
    gold: hero.gold,
    stamina: currentStamina(hero.stamina, hero.staminaAt, now).stamina,
    staminaMax: STAMINA_MAX,
    shortRests: { left: hero.shortRests, of: SHORT_RESTS },
    inCity: hero.location === 'CITY',
    availableAt: availableAt(hero, now)?.toISOString() ?? null,
  };
}

export async function lodgingView(player: Player): Promise<LodgingView> {
  const season = await currentSeason();
  const hero = await prisma.hero.findFirst({ where: { playerId: player.id, seasonId: season.id, retiredAt: null } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  return view(hero, gameNow());
}

export async function takeLodging(player: Player): Promise<LodgingView> {
  const season = await currentSeason();
  const now = gameNow();
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    if (availableAt(hero, now)) throw ApiError.conflict('lodged_today', 'One night a day at the Tavern');
    // Solo: a night is also how the Day passes, so a fully rested Hero may still
    // take one. A Hero away training must: Training keeps it out of the Labyrinth
    // until its hours are up, and only a night brings them.
    await spendGold(tx, hero, lodgingPrice(hero.tavernNights));
    const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
    const rested = {
      stamina: STAMINA_MAX, staminaAt: now, hp: fullHealth(hero), spellUses: uses.spells, healUses: uses.heals,
      shortRests: SHORT_RESTS, shortRestsAt: now, tavernNights: hero.tavernNights + 1, lodgedAt: now,
    };
    await tx.hero.update({ where: { id: hero.id }, data: rested });
    return hero.id;
  });
  // Solo, in-game days: the night passes, and the Hero wakes the next morning
  // (a stand-in until Phase 3 makes sleeping end the day everywhere).
  sleepTonight();
  return view(await prisma.hero.findUniqueOrThrow({ where: { id: heroId } }), gameNow());
}
