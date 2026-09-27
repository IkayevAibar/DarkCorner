# Codex task 07: the City map with pins

**Branch:** `codex/city-map`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The City is an inked town map seen from above, with Buildings you tap ([design.md → The City](../design.md#the-city)). Today `City.tsx` shows the map as a picture with Building cards under it. Port the look test's City (`prototypes/look-test/` on the `prototype/look-test` branch): pins on the Buildings, flickering torches, drifting fog, and a pin that says when something needs you.

## Contract

- The map is `apps/web/public/art/city-map.jpg` (1024 × 1536, portrait). Place pins in map coordinates (0–1 of width and height) so they stay put at every screen size. Find the Buildings on the art: the Tavern, Shops, Forge, Market, Temple and the Labyrinth gate.
- Each pin goes where the card goes today: `/city/tavern`, `/city/shop`, `/city/forge`, `/city/market`, `/city/temple`, `/labyrinth`. Names come from `t('city.tavern')` and so on (both languages); keep the cards below the map as a list for people who'd rather read.
- Badges on pins, from data the web already loads:
  - Tavern: the Season (`GET /api/tavern` → `season`): a flame while the Boss gate is open, a crown during the Finale.
  - Labyrinth gate: shut while `season.status` is `planned`.
  - Loot is not a Building, but if you want a hint on the tab bar for Chests you can open, `GET /api/heroes/me` has the Bag.
- `prefers-reduced-motion`: no fog drift or torch flicker.

## Where

- `apps/web/src/screens/city/City.tsx` (Claude's version: map plus cards). Components under `apps/web/src/components/city/`.
- Pin icons: `BUILDING_ICONS` in `components/buildingIcons.ts` (game-icons.net path data on `ICON_VIEWBOX`), as `City.tsx` uses them.

## Done when

- The map fills the screen at 375 px wide and on a desktop, every pin is tappable with a thumb, and the labels read in English and Russian.
- `npm run typecheck` and `npm run build` pass.
- The pull request has screenshots on a phone and a desktop.
