# Codex task 23: paint every gear type, and the 13 new uniques

**Branch:** `codex/armory-art`, based on `main` once `claude/armory` is merged. Big; several pull requests are fine (say, weapons and off-hands, then armor and jewelry, then the uniques, then the stackables).
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The owner chose to paint every gear type (2026-10-10). Today every ordinary Item is a flat game-icons.net silhouette in its Tier frame, and only the 17 named uniques have paintings. Paint all 44 gear types in the ink style of the uniques and the monster tokens, plainer than any unique, so the Bag, the Shops, the Market and the loot screens become pictures. Then the 13 uniques of the second wave, and last the 15 stackables (potions, scrolls, bombs, Keys, Chests, Materials).

## Contract

- **Gear types:** prompts in [docs/art/gear-prompts.md](../art/gear-prompts.md), one file name per base id in `packages/engine/src/content/bases.ts`. Sources in `art/gear/<id>.png`, with `README.md`, `generation-prompts.json` and `validation.json` as for the monster tokens.
- **Uniques:** prompts in [docs/art/unique-prompts.md → Batch 2](../art/unique-prompts.md#batch-2-the-second-wave-13-uniques), sources in `art/items/<id>.png` beside the first 17.
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP delivery copies (`apps/web/public/art/gear/`, `apps/web/public/art/items/`) and sets `art` on each base (`BASES`) and unique (`UNIQUES`).
- How they show: `ItemView.art` is now a unique's own painting once identified, otherwise its base's. `ItemChip` (`apps/web/src/components/items/ItemChip.tsx`) draws `art` at 96% of the tile, `object-contain`, inside the Tier frame, and falls back to the icon while `art` is null.

## What to check

- A row of Bag tiles at phone width (62 px each) reads evenly: same angle and scale within a slot, weapons on the same diagonal.
- Ordinary gear stays plainer than any unique: no glow, no shining gems. The Tier frame carries the color.
- The Item card's larger view (the sheet) still looks right with a painting instead of an icon. The Tier frames may need a touch more contrast behind a painted Item; that's yours to judge.

## Done when

- The 44 gear sources and 13 unique sources are in place with their README galleries, prompts and validation; the 15 stackables can follow in their own pull request.
- The pull request shows a Bag of mixed Tiers at 375 px with the new paintings (a mockup on `/sandbox` with fake `art` paths is fine) and names anything that needs a second pass.
