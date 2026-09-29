# Codex task 04: the Floor map and the mini-map

**Branch:** `codex/floor-map`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Each Hero draws its own Map of every Floor as it explores: Rooms it has stood in, the unknown Rooms next to them, and the Doors between. Everything else is fog. Players look at it every few Moves, so it is one of the most-seen screens in the game, and today it is a plain grid. Make it feel like an inked dungeon map, readable at a glance on a phone, and put a small live corner of it on the Room itself so the Player rarely has to open the full Map.

Two pieces:

1. **The Floor map**, opened from the Map button in the Labyrinth's top bar (a centered card, up to 520 px wide).
2. **A mini-map** in a corner of the Room's stage: the current Room and a couple of Rooms around it, the exits highlighted. Tapping it opens the full Map.

## Contract

The data is `LabyrinthView['map']` from `@dark/shared` (`packages/shared/src/labyrinth.ts`):

- `rooms[]`: `id`, grid `x`/`y`, `type` (null until the Hero has stood there), `visited`, and `cleared` (the Hero beat that Room's monsters or took its treasure in the last 24 hours).
- `doors[]`: `a`–`b` Room ids and `kind`: `open`; `locked` (needs a Rogue or an Iron key); `cracked` (a wall only Fighters can break; other Classes never receive these); `secret` (a hidden Door this Hero has spotted; the Room behind it is a `hidden` room with a hoard).
- The Floor's `width` × `height` (10 × 10, and 6 × 6 for the Dragon's lair on Floor 10).
- Rooms can also appear on the Map without being walked: the Riddling statue reveals a hidden room, and the lair's Whispering skulls reveal the way to the Dragon's chamber.

Keep the props of Claude's stand-in, `apps/web/src/screens/labyrinth/FloorMap.tsx`:

```tsx
export function FloorMap(props: {
  width: number; height: number; map: MapView; current: number; banner: string;
  exits: Exit[]; disabled: boolean; onMove: (to: number) => void;
}): JSX.Element
```

- `current` is the Room the Hero stands in; mark it with a small token ring in the `banner` color.
- `exits` are the Doors out of the current Room. Tapping a Room behind an exit calls `onMove` (the Labyrinth screen handles the rest, including asking before a Hero walks out of a Camp mid-rest). Make those Rooms look tappable, with a finger-sized hit area. An exit's `free` flag means walking in costs no Stamina; show that quietly.
- Room types need small marks: `landing`, `stairs`, `waypoint`, `camp`, `fight` (dim once `cleared`), `empty`, `event`, `treasure`, `vault`, `miniboss`, `boss`, `hidden`. Unknown Rooms show only as a dark outline at the edge of the fog.
- Show only the explored part of the Floor plus a margin, as the stand-in's `frame()` does, so the Map stays readable early on.

The mini-map is new: `apps/web/src/components/map/MiniMap.tsx`, taking the same `map`, `current`, `banner` and `exits` plus `onOpen: () => void`. Claude adds it to the Room's stage when your PR lands; build it on `/sandbox` against the fixtures.

## Look

- The same ink style as the Room maps and the City: heavy black lines, muted colors, torn fog at the edges.
- Everything stays muted except the current Room and the exits, so the eye goes to where the Hero can go next.
- Doors read by kind: a locked Door shows a lock, a cracked wall its cracks, a secret Door a faint dashed line.
- The mini-map is small (about 88–110 px) and must not hide the Room's monsters or its Door arrows; semi-transparent until touched is fine.
- SVG or Canvas is fine. PixiJS is not needed here.

## Where it goes

- Replace the stand-in in place (same file, same props), or create `apps/web/src/components/map/FloorMap.tsx` and update the one import in `Labyrinth.tsx`.
- Add sandbox fixtures in `apps/web/src/screens/sandbox/`: a fresh Floor (the landing and its neighbours), a half-explored Floor with locked, cracked and secret Doors and a hidden room, a nearly full Floor, and the 6 × 6 lair with the way to the Dragon revealed. Showcase the Map and the mini-map for each on `/sandbox`.
- Text via `t()` in both `en.ts` and `ru.ts`.

## Done when

- Every fixture reads well at 375 px wide and on a desktop, with no horizontal scrolling, in English and Russian.
- Tapping an exit Room on the Map in the real Labyrinth tab moves the Hero.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The pull request has screenshots of each fixture (kept out of the branch), the Map and the mini-map.
