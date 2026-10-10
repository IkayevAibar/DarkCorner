/**
 * The game clock runs in SERVER_TIMEZONE (Astana time by default): "the Vault
 * opens tonight at 21:00" means 21:00 there, whatever zone a Player is in.
 */

function partsIn(zone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** How far the zone is ahead of UTC at a moment, in ms. */
function offsetMs(zone: string, at: Date): number {
  const p = partsIn(zone, at);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The moment it is `hour`:00 in `zone` on the local date of `day`. */
export function atLocalHour(day: Date, hour: number, zone: string): Date {
  const p = partsIn(zone, day);
  const guess = Date.UTC(p.year, p.month - 1, p.day, hour);
  return new Date(guess - offsetMs(zone, new Date(guess)));
}

/** The next time it is `hour`:00 in `zone`, strictly after `now`. */
export function nextLocalHour(now: Date, hour: number, zone: string): Date {
  const today = atLocalHour(now, hour, zone);
  return today > now ? today : atLocalHour(new Date(now.getTime() + 24 * 60 * 60 * 1000), hour, zone);
}
