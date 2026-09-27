# Look-test art — first pass

Generated on 2026-09-27 with the built-in image generation tool, following [the source brief](../../docs/art/look-test-prompts.md). These are review candidates, not an approved production asset pack. The interactive look-test page has not been built yet.

## Assets

| Asset | File | Size | Background |
|---|---|---|---|
| City | [city-map.png](city-map.png) | 1024 × 1536 | Opaque |
| Goblin Room | [room-goblins.png](room-goblins.png) | 1254 × 1254 | Opaque |
| Crypt Room | [room-crypt.png](room-crypt.png) | 1254 × 1254 | Opaque |
| Demon Room | [room-demons.png](room-demons.png) | 1254 × 1254 | Opaque |
| Human Fighter | [hero-human-fighter.png](hero-human-fighter.png) | 1254 × 1254 | Transparent |
| Elf Wizard | [hero-elf-wizard.png](hero-elf-wizard.png) | 1254 × 1254 | Transparent |
| Halfling Rogue | [hero-halfling-rogue.png](hero-halfling-rogue.png) | 1254 × 1254 | Transparent |
| Dwarf Cleric | [hero-dwarf-cleric.png](hero-dwarf-cleric.png) | 1254 × 1254 | Transparent |
| Goblin | [monster-goblin.png](monster-goblin.png) | 1254 × 1254 | Transparent |
| Skeleton | [monster-skeleton.png](monster-skeleton.png) | 1254 × 1254 | Transparent |
| Imp | [monster-imp.png](monster-imp.png) | 1254 × 1254 | Transparent |
| Dragonbone Blade | [item-dragonbone-blade.png](item-dragonbone-blade.png) | 1254 × 1254 | Transparent |
| Season 0 Dragon | [boss-dragon.png](boss-dragon.png) | 1254 × 1254 | Transparent |

## Checks and review notes

- Visually inspected each generated image for subject, framing and shared ink style. All three Room maps have four centered Door openings and central space for fight tokens.
- Verified that all PNGs decode, the City uses a 2:3 aspect ratio, and all other assets are square. Portraits, the Item and the Boss have an alpha channel with transparent corner pixels.
- The City was regenerated to bring the camera closer to a vertical roof plan. Small architectural details still show some illustrative perspective; review this before treating it as a strict orthographic production map.
- The Cleric's beard rings appear brass-toned rather than the iron specified in the brief. This is a detail to correct if the portrait is selected for production.
- Magical marks use abstract shapes to reconcile the rune requests with the brief's no-letters rule.
- Circular token crops and readability at actual phone sizes still need checking in the look-test page. Horns, ears, weapons and the Cleric's chest symbol may need per-asset crop adjustments.
- These are source PNGs. Optimize delivery copies when integrating into the web app; retain the originals and alpha.

## Revisions

The exact submitted prompts are in [generation-prompts.json](generation-prompts.json). The shared style block was repeated in each call, and inherited framing was expanded into each prompt. The City correction used the first City image as a reference; the selected City and the remaining assets were separate generation calls in the same conversation.

Two superseded City candidates are in [drafts/](drafts/); they are not part of the 13 selected assets. Original tool outputs also remain in the Codex generated-images directory.

No Git branch or pull request could be created because this project folder is not initialized as a Git repository and has no configured remote.
