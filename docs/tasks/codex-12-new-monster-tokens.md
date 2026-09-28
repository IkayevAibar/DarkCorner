# Codex task 12: six new monster tokens

**Branch:** `codex/monster-tokens-2`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Season 0 has six new monsters: four in the goblin warrens (Floors 1–3) and two in the crypts (Floors 4–6). Until they have art they fight as a lettered disc. Paint them in the style of the other 21 tokens, so each one's power reads at a glance: the sapper's lit bomb, the shaman's healing charm, the swarm's many wings, the spider's fangs, the grave robber's stolen locket and the banshee's scream.

## Contract

- The prompts are in [docs/art/monster-token-prompts.md → Batch 2](../art/monster-token-prompts.md#batch-2-six-new-monsters), one file name per monster id in `packages/engine/src/content/monsters.ts`. Use the same style block as the first batch.
- Sources: `art/monsters/<id>.png`, square, transparent (or pure black), as generated. Add them to `art/monsters/README.md`'s gallery, `generation-prompts.json` and `validation.json`.
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP delivery copies under `apps/web/public/art/tokens/` and sets each monster's `art`, as it did for the first 17.

## Where

- The tokens to match: `apps/web/public/art/tokens/*.webp` (sources in `art/monsters/`).
- How they show: `apps/web/src/components/Token.tsx` crops a circle, full bleed, zoomed 1.08×, on a ring in the monster's color. Fights show tokens at about 48–64 px; the Labyrinth's stage shows them larger, and tapping one opens its card.

## Done when

- The six files are in `art/monsters/` under the names in the brief, with the README gallery, prompts and validation updated.
- In a 48 px circle each head is centered and recognizable, and the palette sits with the other 21 tokens.
- The pull request shows the six next to a few existing tokens and names anything that needs a second pass.
