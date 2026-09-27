# Codex task 11: Room maps

**Branch:** `codex/room-maps`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Every Room and every fight shows a battle map, and each Floor theme has only one, so the Labyrinth looks the same Room after Room. Paint 27 more: 7 each for the goblin warrens, the undead crypts and the demon-touched depths, and 6 for the Dragon's lair, which has none of its own yet. Together with the turning and mirroring the web already does, each theme then has dozens of looks.

## Contract

- The prompts, the style block and the framing block are in [docs/art/room-map-prompts.md](../art/room-map-prompts.md), one file name per map.
- Sources: `art/rooms/<name>.png`, square, as generated. Keep drafts out of the way in `art/rooms/drafts/` if you keep any.
- Alongside them, as in `art/monsters/`: `README.md` with a gallery, `generation-prompts.json` with the exact prompts, and `validation.json` (dimensions and size per file).
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the web copies under `apps/web/public/art/rooms/` and adds the names to each theme's `maps` in `packages/engine/src/content/floors.ts`, as it did for the tokens.

## Where

- The three maps to match: `apps/web/public/art/rooms/goblins-1.jpg`, `crypt-1.jpg` and `demons-1.jpg` (sources: `art/look-test/room-*.png`).
- How they show: a square, darkened (to 62% in fights, 78% in the Room view), with monster tokens across the top and the Hero's token near the bottom. Each Room turns and mirrors its map its own way (`apps/web/src/screens/labyrinth/roomArt.ts`), so a map must read the same at any rotation.

## Done when

- All 27 files are in `art/rooms/` under the names in the brief, with the README gallery, prompts and validation.
- Every map has a doorway in the middle of each wall and a clear middle, reads as its theme at 375 px wide, and sits with the three existing maps in style and palette.
- The pull request shows the gallery and names anything that needs a second pass.
