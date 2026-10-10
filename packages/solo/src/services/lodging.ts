import type { Hero, Player } from '@prisma/client';
import type { LodgingView } from '@dark/shared';
import { SHORT_RESTS, STAMINA_MAX, currentStamina } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { dayNumber, lockHero, requireCity } from './ledger.js';
import { currentSeason } from './seasons.js';
import { wokenRested } from './sleep.js';
import { gameNow, nextMorning, sleepTonight } from '../gameClock.js';

// A night at the Tavern. Online (docs/design.md → The City) it is City gold for
// full Stamina and the short rests back, dearer each night. Solo it is how the
// Day passes (docs/plan-solo-offline.md → Days): free, open to a rested Hero
// too, and the Hero wakes the next morning (a Camp is the other place to sleep).

const DAY_MS = 86_400_000;

/** When the next night can be taken: tomorrow's midnight (UTC) if the Hero slept today, else now (null). */
const availableAt = (hero: Hero, now: Date): Date | null =>
  hero.lodgedAt && dayNumber(hero.lodgedAt) === dayNumber(now) ? new Date((dayNumber(now) + 1) * DAY_MS) : null;

function view(hero: Hero, now: Date): LodgingView {
  return {
    price: 0,
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
  const morning = new Date(nextMorning(now.getTime()));
  const heroId = await prisma.$transaction(async (tx) => {
    const hero = await lockHero(tx, player, season.id);
    requireCity(hero);
    if (availableAt(hero, now)) throw ApiError.conflict('lodged_today', 'One night a day at the Tavern');
    // A fully rested Hero may sleep too. A Hero away training must: Training keeps
    // it out of the Labyrinth until its hours are up, and only a night brings them.
    await tx.hero.update({ where: { id: hero.id }, data: { ...wokenRested(hero, morning), tavernNights: hero.tavernNights + 1, lodgedAt: now } });
    return hero.id;
  });
  sleepTonight();
  return view(await prisma.hero.findUniqueOrThrow({ where: { id: heroId } }), gameNow());
}
