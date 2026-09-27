# Codex task 01: Item tile and Item card

**Branch:** `codex/item-card`, based on `claude/week-1`, or on `main` once that is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Build the two components every loot screen will use, as React components in `apps/web`, in look B · Crypt:

- **`ItemTile`**: a small square showing the icon or art, a frame in the Tier color, and state marks. Used in the Chest Spin strip, equipment slots, the Market and the Bag.
- **`ItemCard`**: the full card, shown inside the bottom sheet. It has the name in the Tier color, the type line, Quality, Bonus stats, the power, the Relic serial and owners, the Radiant stamp, and the Buyback price.

## Contract

Render `ItemView` from `@dark/shared` (`packages/shared/src/items.ts`). Import it as a type only, and do not change it: a change to `packages/shared` needs the owner's approval.

- **Unidentified items:** while `identified` is false, `quality`, `bonusStats`, `power` and `radiant` are null. Show the mystery state from the look test: a dimmed icon, a "?" mark, and "???" lines.
- **Names and text:** `name`, `bonusStats` and `power` come in both languages. Pick one with `useI18n().locale`.

## Look

The approved look is on the `prototype/look-test` branch:
- `prototypes/look-test/js/items.js`: markup and states
- `prototypes/look-test/style.css`: the `.item-tile` and `.item-card` rules, plus `html[data-variant="B"]` for this look

Match these:
- Tier colors are the `--color-tier-*` tokens in `apps/web/src/styles.css`.
- Legendary and Mythic pulse softly. Relics get the animated gold border (`@property --angle`) and a `#2/3` serial on the tile.
- Radiant shows the shimmer sweep and the rainbow `RADIANT` stamp.
- Items without `art` use the SVG for their `icon` key. Claude already ported the look test's icons to `apps/web/src/components/items/icons.ts` (`iconSvg(icon)`); game-icons.net replaces them in week 4. `art` (Legendary and above) is an image URL.
- Stackables (`kind` other than `gear`) show `quantity` as `×N` and have no Quality or Bonus stats. Their `tier` is only a color hint.
- Tile sizes 62, 76 and 84 px. The card is full width inside the bottom sheet.

Claude's stand-ins `ItemChip` and `ItemDetails` in `apps/web/src/components/items/ItemChip.tsx` are used by the character sheet. Replace their uses with `ItemTile` and `ItemCard`, then delete the stand-ins.

## Where

- Components: `apps/web/src/components/items/`
- Fake data: `apps/web/src/screens/sandbox/itemFixtures.ts`, covering every Tier, a Radiant item, an Unidentified item and a Relic
- Showcase: `apps/web/src/screens/Sandbox.tsx`. Show a tile grid and a card for each fixture. Tapping a tile opens its card with `useSheet()`.
- Any new player-facing text goes in both `apps/web/src/i18n/en.ts` and `ru.ts`.

## Done when

- `/sandbox` (dev only) shows every fixture as a tile and as a card, in English and Russian, at 375 px wide with no horizontal scrolling.
- `npm run typecheck` and `npm run build` pass.
- The pull request has screenshots of the tile grid and of the Relic, Radiant and Unidentified cards.
