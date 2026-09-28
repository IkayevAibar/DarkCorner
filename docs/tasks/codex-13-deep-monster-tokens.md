# Codex task 13: five monster tokens for the crypts and the depths

**Branch:** `codex/monster-tokens-3`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Floors 4–9 have five new monsters: the Mummy and Rot grubs in the crypts, the Flame skull, the Night hag and the Chain devil in the depths. Until they have art they fight as a lettered disc. Paint them in the style of the other 27 tokens, so each one's power reads at a glance: the Mummy's dead stare, the grubs' writhing heap, the skull's fire, the hag's hungry eyes and the devil's hooked chains.

## Contract

- The prompts are in [docs/art/monster-token-prompts.md → Batch 3](../art/monster-token-prompts.md#batch-3-five-monsters-for-the-crypts-and-the-depths), one file name per monster id in `packages/engine/src/content/monsters.ts`. Use the same style block as the first batch.
- Sources: `art/monsters/<id>.png`, square, transparent (or pure black), as generated. Add them to `art/monsters/README.md`'s gallery, `generation-prompts.json` and `validation.json`.
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP delivery copies under `apps/web/public/art/tokens/` and sets each monster's `art`, as it did for the first 23.

## Where

- The tokens to match: `apps/web/public/art/tokens/*.webp` (sources in `art/monsters/`).
- How they show: `apps/web/src/components/Token.tsx` crops a circle, full bleed, zoomed 1.08×, on a ring in the monster's color. Fights show tokens at about 48–64 px; the Labyrinth's stage shows them larger, and tapping one opens its card.

## Done when

- The five files are in `art/monsters/` under the names in the brief, with the README gallery, prompts and validation updated.
- In a 48 px circle each head is centered and recognizable, and the palette sits with the other tokens.
- The pull request shows the five next to a few existing tokens and names anything that needs a second pass.
