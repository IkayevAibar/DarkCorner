# Codex task 04: the Floor map

**Branch:** `codex/floor-map`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Each Hero draws its own Map of every Floor as it explores: Rooms it has stood in, the unknown Rooms next to them, and the Doors between. Everything else is fog. Make the Map feel like an inked dungeon map in look B · Crypt, readable at a glance on a phone.

## Contract

The data is `LabyrinthView['map']` from `@dark/shared` (`packages/shared/src/labyrinth.ts`):

- `rooms[]`: `id`, grid `x`/`y`, `type` (null until the Hero has stood there), `visited`, and `cleared` (the Hero beat that Room's monsters or took its treasure in the last 24 hours).
- `doors[]`: `a`–`b` Room ids and `kind`: `open`, `locked` (needs a Rogue or an Iron key), or `cracked` (a wall only Fighters can break; other Classes never receive these).
- The Floor's `width` × `height` (10 × 10, and 6 × 6 for the Dragon's lair on Floor 10).

Keep the props of Claude's stand-in, `apps/web/src/screens/labyrinth/FloorMap.tsx`:

```tsx
export function FloorMap(props: {
  width: number; height: number; map: MapView; current: number; banner: string;
  exits: Exit[]; disabled: boolean; onMove: (to: number) => void;
}): JSX.Element
```

- `current` is the Room the Hero stands in; mark it with a small token ring in the `banner` color.
- `exits` are the Doors out of the current Room. Tapping a Room behind a `passable` exit calls `onMove`. Make those Rooms look tappable, and give them a finger-sized hit area.
- Room types need small marks: `landing`, `stairs`, `waypoint`, `camp`, `fight` (dim once `cleared`), `empty`, `event`, `treasure`, `vault`, `miniboss`, `boss`. Unknown Rooms show only as a dark outline at the edge of the fog.
- Show only the explored part of the Floor plus a margin, as the stand-in's `frame()` does, so the Map stays readable early on.

## Look

- The same ink style as the Room maps and the City: heavy black lines, muted colors, torn fog at the edges.
- Everything stays muted except the current Room and the exits, so the eye goes to where the Hero can go next.
- SVG or Canvas is fine. PixiJS is not needed here.

## Where it goes

- Replace the stand-in in place (same file, same props), or create `apps/web/src/components/map/FloorMap.tsx` and update the one import in `Labyrinth.tsx`.
- Add sandbox fixtures in `apps/web/src/screens/sandbox/`: a fresh Floor (the landing and its neighbours), a half-explored Floor with locked and cracked Doors, and the 6 × 6 lair. Showcase them on `/sandbox`.

## Done when

- Every fixture reads well at 375 px wide and on a desktop, with no horizontal scrolling.
- Tapping an exit Room in the real Labyrinth tab moves the Hero.
- `npm run typecheck` and `npm run build` pass.
- The pull request has screenshots of each fixture.
