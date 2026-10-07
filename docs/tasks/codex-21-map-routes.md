# Codex task 21: Routes and marks on the Map

**Branch:** `codex/map-routes`, based on `main` once `claude/map-route` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)); the Map is yours from task 04.

## Goal

Players asked for two things on the Floor map: to see which Rooms are done for today, and a "navigator" that draws the way to a Room they pick. Both work now (docs/design.md → Doors, clues and the map: Done for now, Routes), drawn plainly in `apps/web/src/components/map/MapDrawing.tsx`. Make them feel like ink on the same old map: a Route that reads at a glance on a phone, marks that don't clutter, and a walk you can watch.

## Contract (already in `packages/shared`)

- `MapView.rooms[]` gained `free` (walking in costs no Stamina: stood in, nothing new there now) and `back` (for a `cleared` Room, when what it holds comes back, ISO). `cleared` now lasts as long as the Room stays done: a day, a week for a hoard, the Twin Wardens and an Oathstone.
- `MapView.doors[]` gained `passable` (this Hero, or the Duo together, gets through) and `key` (going through takes an Iron key).
- `findRoute(map, from, to)` in `components/map/route.ts` gives `{ rooms, stamina, keys, waits }`: the Rooms after the current one, the goal last.
- `MapProps` gained `route` (those Rooms), `picked` (the goal, reachable or not) and `onPick` (given, a tap on any Room picks it, instead of walking next door). `FloorMap` takes `children` (the Route panel, `screens/labyrinth/RoutePanel.tsx`, mine) between the map and the Doors.
- `POST /api/labyrinth/walk { route }` walks it Door by Door; the result is an ordinary `LabyrinthResult` whose view may stand several Rooms on (or short of the goal, when something happened on the way).
- Today: done Rooms carry a small green check (`.map-done`), Rooms where something waits again an amber "!" (`.map-waits`); the Route is a dotted gold line drawn over the Rooms (`.map-route` on `.map-route-edge`) with a dashed ring on the goal (`.map-goal`); the next Door on the Room's stage glows (`.route-next`, `DoorMarker`).

## What to build

1. **The Route as ink:** a line that follows the passages (corners at the Doors, not across Room glyphs), with a small arrowhead or flag at the goal. Keep the dark rim so it reads on light and dark parchment.
2. **The walk on the mini-map:** after a walk the view lands several Rooms on; slide the token along the Rooms walked (the Route that was drawn before the walk, cut where the new current Room is) instead of fading it in.
3. **Marks:** keep "done" and "something waits" distinct by shape as well as color; consider hiding the check on Rooms whose glyph is already dimmed if that reads better.
4. **Bigger Floors on a phone:** the whole-Floor frame makes Rooms small at 375 px wide; consider a pinch or a zoom toggle in the popup so a Room is easy to tap (each Room's tap target is its own cell).

## Done when

- On a phone held upright, a Room can be picked with one tap, its Route reads at a glance, and the walk can be followed on the mini-map.
- With reduced motion the Route still shows, without the marching dots or the slide.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording (kept out of the branch).
