# Codex task 10: monster token art

**Branch:** `codex/monster-tokens`, based on `claude/codex-integration` (it has the art pipeline your Season 0 art went through), or on `main` once that is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Every fight shows its monsters as round tokens. Only the Goblin, Skeleton, Imp and Dragon have art; the other 17 fight as a lettered disc, and they are most of what a Player meets. Paint the 17, in the style of the four and of your portrait batch, so each monster's power reads at a glance: the cutpurse's stolen purse, the hellhound's smoke, the mimic's teeth.

## Contract

- The prompts and the style block are in [docs/art/monster-token-prompts.md](../art/monster-token-prompts.md): one file name per monster id in `packages/engine/src/content/monsters.ts`.
- Sources: `art/monsters/<id>.png`, square, transparent (or pure black), as generated. Keep drafts out of the way in `art/monsters/drafts/` if you keep any.
- Alongside them, as in `art/portraits/`: `README.md` with a gallery, `generation-prompts.json` with the exact prompts, and `validation.json` (dimensions, alpha, size per file).
- Nothing under `apps/` or `packages/` changes in this task. Claude makes the 256 px WebP delivery copies under `apps/web/public/art/tokens/` and sets each monster's `art`, as it did for the portraits and unique Items.

## Where

- The four existing tokens to match: `apps/web/public/art/tokens/goblin.png`, `skeleton.png`, `imp.png`, `dragon.png`.
- How they show: `apps/web/src/components/Token.tsx` crops a circle, full bleed, zoomed 1.08×, on a ring in the monster's color; fights show tokens at about 48–64 px, Mini-bosses larger. The Encounter panel (`screens/labyrinth/Labyrinth.tsx`, the Facing panel) shows them too.

## Done when

- All 17 files are in `art/monsters/` under the names in the brief, with the README gallery, prompts and validation.
- In a 48 px circle each head is centered and recognizable; the three Mini-bosses look grander than their kin; the palette sits with the four existing tokens.
- The pull request shows the gallery and names anything that needs a second pass.
