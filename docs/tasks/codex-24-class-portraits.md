# Codex task 24: portraits for the eight borrowed Classes

**Branch:** `codex/class-portraits`, based on `main` once `claude/classes-2` is merged. Big; one pull request per two Classes is fine (Barbarian and Ranger first, since they have waited longest).
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Twelve Classes are playable now, but only four have their own portraits. The Barbarian, Ranger, Paladin, Warlock, Monk, Druid, Bard and Sorcerer borrow a painted Class's portraits for the same Race (engine `portraitClass`). Paint two portraits for every Race of each, in the style of the first 32, so every Hero looks like what it is.

## Contract

- **Prompts:** [docs/art/portrait-prompts.md](../art/portrait-prompts.md), Batch 2 (Barbarians and Rangers, 16) and Batch 3 (the six Classes of 2026-10-10, 48), with the style block at the top of that file.
- **Sources:** `art/portraits/<race>-<class>-<n>.png`, beside the first 32, with a `README.md` gallery, `generation-prompts.json` and `validation.json` as for the monster tokens (`art/monsters/`).
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP copies in `apps/web/public/art/portraits/` and adds each Class to `CLASSES_PAINTED` in `packages/engine/src/content/portraits.ts` once its eight are in. Heroes made before then keep the portrait they chose.

## What to check

- Each one reads round at 48 px (the fight token) and at 160 px (Quick start): face centered, nothing important outside the central circle.
- They sit with the first 32: the same ink, palette and light. A Paladin beside a Fighter, a Sorcerer beside a Wizard, a Monk beside a Rogue should look like different callings at a glance.
- Every Race and Class pair has one masculine-leaning and one feminine-leaning portrait, with varied ages.
- No letters or writing anywhere: holy symbols and eldritch marks are abstract shapes.

## Done when

- The 64 sources are in place with their README gallery, prompts and validation, in as many pull requests as suits you.
- Each pull request shows its Classes' portraits as round tokens at 48 px next to the existing ones, and names anything that needs a second pass.
