import type { FightReplay } from '@dark/shared';

export interface TokenPlace { x: number; y: number; diameter: number }
/** Canvas coordinates and accessible tap targets share one layout. Solo positions stay unchanged. */
export function tokenPlaces(fight: Pick<FightReplay, 'hero' | 'ally' | 'monsters'>): Record<string, TokenPlace> {
  const count = fight.monsters.length;
  const places: Record<string, TokenPlace> = {};
  fight.monsters.forEach((who, i) => {
    const columns = count > 4 ? 3 : Math.max(1, count), row = Math.floor(i / columns), inRow = Math.min(columns, count - row * columns);
    places[who.key] = {
      x: 300 + ((i % columns) - (inRow - 1) / 2) * (600 / (columns + .6)),
      y: count === 1 && who.boss ? 166 : 133 + row * 128,
      diameter: who.boss && count === 1 ? 188 : count <= 2 ? 108 : count <= 4 ? 84 : 68,
    };
  });
  places.hero = { x: fight.ally ? 200 : 300, y: 446, diameter: 104 };
  if (fight.ally) places.ally = { x: 400, y: 446, diameter: 94 };
  return places;
}
