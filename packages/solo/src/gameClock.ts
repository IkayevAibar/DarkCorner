/**
 * The game's clock (docs/plan-solo-offline.md, decision 1: in-game days).
 *
 * In 'days' mode in-game time stands still while the Hero plays: every service
 * that asks the time gets the same morning. Sleeping moves it to the next
 * morning, so everything the server counts in hours (Stamina, rests, Training,
 * Graves, the Omen at midnight) comes due over nights instead. The phone's own
 * clock never matters, so changing it can't cheat the game.
 *
 * 'real' mode reads the device's clock, as the server does. The ported API
 * scenarios run in it.
 */
export interface WorldClock {
  mode: 'days' | 'real';
  /** In-game time, epoch ms ('days' mode only). */
  now: number;
  /** Day 1's morning, epoch ms. */
  start: number;
}

export const DAY_MS = 86_400_000;
/** In-game days start at 08:00 UTC; midnight UTC turns the day, as the server's day numbers do. */
export const MORNING_HOUR = 8;
const HOUR_MS = 3_600_000;

let current: WorldClock | null = null;

/** The backend points the clock at the loaded World before each request. */
export function useClock(clock: WorldClock | null): void {
  current = clock;
}

export const gameNowMs = (): number => (current && current.mode === 'days' ? current.now : Date.now());
export const gameNow = (): Date => new Date(gameNowMs());

/** A new World's first morning: today's date, at 08:00 UTC. */
export const firstMorning = (realNow: number): number => Math.floor(realNow / DAY_MS) * DAY_MS + MORNING_HOUR * HOUR_MS;

/** The first morning strictly after `at`. */
export function nextMorning(at: number): number {
  const today = Math.floor(at / DAY_MS) * DAY_MS + MORNING_HOUR * HOUR_MS;
  return today > at ? today : today + DAY_MS;
}

/** Day 1, 2, 3… of the World, counted in mornings. */
export const dayOf = (clock: WorldClock, at: number = clock.mode === 'days' ? clock.now : Date.now()): number =>
  Math.floor((at - clock.start) / DAY_MS) + 1;

/** The loaded World's Day number at `at` (Day 1 is its first morning). */
export const worldDay = (at: number = gameNowMs()): number => (current ? dayOf(current, at) : 1);

/** A night's sleep: in 'days' mode the clock moves on to the next morning. */
export function sleepUntilMorning(clock: WorldClock): void {
  if (clock.mode === 'days') clock.now = nextMorning(clock.now);
}

/** The loaded World's Hero sleeps: its clock moves on to the next morning ('days' mode). */
export function sleepTonight(): void {
  if (current) sleepUntilMorning(current);
}
