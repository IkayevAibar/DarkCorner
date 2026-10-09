# Codex task 22: tokens for the bestiary's second wave

**Branch:** `codex/monster-tokens-4`, based on `main` once `claude/bestiary` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The Labyrinth has 22 new monsters (docs/design.md → Monsters): three more in the goblin warrens, four in the crypts, four in the depths and five in the Dragon's lair, plus six new Mini-bosses, so each Floor 1–9 now has its own. Until they have art they fight as a lettered disc. Paint them in the style of the other 30 tokens, so each one's power reads at a glance: the hobgoblin's raised shield (it protects the others), the worg mid-lunge (it pounces), the ghost and the shadow you can half see through (steel passes through them), the vampires' closing wounds (they regenerate), the ember fiend's and the salamander's burning bodies (striking them burns), the temptress's and the vampire lord's holding gaze (they mesmerize), the scale-sworn's and the pit fiend's armor-breaking weapons.

## Contract

- The prompts are in [docs/art/monster-token-prompts.md → Batch 4](../art/monster-token-prompts.md#batch-4-the-bestiarys-second-wave-22-monsters), one file name per monster id in `packages/engine/src/content/monsters.ts`. Use the same style block as the first batch.
- Sources: `art/monsters/<id>.png`, square, transparent (or pure black), as generated. Add them to `art/monsters/README.md`'s gallery, `generation-prompts.json` and `validation.json`, as for Batches 1–3.
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP delivery copies under `apps/web/public/art/tokens/` and sets each monster's `art`, as it did for the first 30.

## The new powers, for the fight scene (optional, a follow-up is fine)

The fight replay now has eight more monster powers (`MonsterPowerView` in `packages/shared`). Five show up as their own `power` event and a Fight log line; a small effect for each would help, but the scene works without:

- `pounce` (no target): the monster springs; its two attacks follow in the same turn.
- `regenerate` (`amount`, `hp`): the monster's wounds close; a green-black knitting on its token.
- `sunder` (`target`, `amount` = Armor Class cracked so far, 1–3): a crack across the Hero's armor ring.
- `thorns` (`target`, `amount`, `hp`): the Hero who struck takes spines or fire back.
- `mesmerize` (`target`): a held gaze; a `status` `paralyzed` event follows when the save fails.

`protect`, `incorporeal` and `hide` have no events of their own. A faint shield link from a protecting monster to the others, a translucent token for the incorporeal, and a stony rim for a hard shell would read well.

## Where

- The tokens to match: `apps/web/public/art/tokens/*.webp` (sources in `art/monsters/`).
- How they show: `apps/web/src/components/Token.tsx` crops a circle, full bleed, zoomed 1.08×, on a ring in the monster's color. Fights show tokens at about 48–64 px; the Labyrinth's stage shows them larger, and tapping one opens its card. Mini-bosses fight on a larger token.

## Done when

- The 22 files are in `art/monsters/` under the names in the brief, with the README gallery, prompts and validation updated.
- In a 48 px circle each head is centered and recognizable, and the palette sits with the other tokens.
- The pull request shows the 22 next to a few existing tokens and names anything that needs a second pass.
