# Codex task 18: the Oathstone and the Duo Chest on screen

**Branch:** `codex/trust-greed`, based on `main` once `claude/trust-greed` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Duos now decide things between their two Players (docs/design.md → Duos → Trust and greed):

- **Oathstones:** one quiet Room per Floor 1–9. Each Player of a Duo swears in secret, Share or Take, and the stone answers once both have: both share, a gift each; one takes, both gifts and the Feed tells everyone; both take, the stone cracks and curses them both.
- **Duo Chests:** Treasure a Duo finds together (and the Twin Wardens' hoard) is split by picking in turns, 30 seconds a pick.

Both work today with plain stand-ins in `apps/web/src/screens/labyrinth/Trust.tsx` (`OathPanel`, `ChestPanel`, shown in `CenterModal`s by `Labyrinth.tsx`). Make them the moments they should be.

## Contract (already in `packages/shared`)

- `RoomTypeId` has `'oathstone'`. `LabyrinthView.room.oath: OathView | null`: `state` (`silent` alone, `open` while swearing, `spent` for the week, with `until`), `mine` (this Player's oath or null) and `partnerSwore`.
- `POST /api/labyrinth/oath { choice: 'share' | 'take' }` → `LabyrinthResult`. The second oath settles both: the result's `notices` say what happened, its `loot` holds the gifts, and the partner's side arrives as news on its next look (the web polls every few seconds in a Duo).
- `LabyrinthView.chest: DuoChestView | null`: `items` (`ItemView` and `takenBy`: `me`, `partner` or null), `turn` (`me`, `partner`, or null once neither can carry more), `full` (this Player's Bag is full, so its turns pass) and `deadline`.
- `POST /api/labyrinth/chest { index }` → `LabyrinthResult`. A pick out of turn is `not_your_pick`; a taken Item is `already_taken`.
- `HeroView.luck.blessing.curse`: the Oathbreaker's curse sits in the Blessing's place.
- Feed kinds `oath-kept`, `oath-broken`, `oath-cracked`.

## What to build

1. **The Oathstone on the stage:** a standing stone with two hand-shaped hollows, so the Room reads as special before the card opens. The map glyph (`Glyph.tsx`, `oathstone`) is a placeholder.
2. **The reveal:** when the second oath lands, both hands turn over at once and show what each swore: gold light for a kept oath, a crack across the stone for a taken one, and a dark flare and a falling crack when both take. The result's notices are the words; this is the picture.
3. **The Duo Chest:** a chest that opens on the stage with its Items laid out, a clear "your pick" / "their pick" state with the countdown, and each taken Item flying to its taker's portrait. Reuse what you can from the Chest spin.
4. **The curse:** the Oathbreaker's curse shown where Blessings show (the Loot screen, the Temple), as a curse rather than a Blessing.
5. **The Tavern:** icons for the three `oath-*` Feed lines.

## Done when

- The oath's reveal and a Duo Chest's turns read at a glance on a phone held upright.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording of both (kept out of the branch).
