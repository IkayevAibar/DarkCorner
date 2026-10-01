# Codex task 17: Twin doors, the Twin Wardens and Bond rings

**Branch:** `codex/twin-doors`, based on `main` once `claude/twin-doors` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Duos have a place of their own now (docs/design.md → Duos → Twin doors):

- One Room on every Floor from 1 to 9 waits behind a **Twin door**, two stone hands side by side. It opens only for a Duo.
- Inside wait the **Twin Wardens**: the Dawn Warden (it mends its twin once) and the Dusk Warden (it drinks the life it strikes). One felled while its twin stands rises at the end of the round with half its health; only both falling in the same round ends them.
- Beating them gives each Hero a half of a pair of **Bond rings**. Worn by the two Heroes of a Duo, the halves count their Bonus stats twice in fights.

Everything works today with plain stand-ins. Make it look like the special place it is.

## Contract (already in `packages/shared`)

- `RoomTypeId` has `'twin'` (the Wardens' Room); `doorKindSchema` has `'twin'`. An `Exit` of kind `twin` is `passable` for a Duo going in, and for anyone walking out.
- `Facing.kind` can be `'twin'`; each Warden's `Foe.role` is `'warden'`, and its `Combatant.boss` is true. Both carry the power `'twin'` (plus `mend` or `drain`).
- A new power event: `{ type: 'power', power: 'twin', actor, target, hp }` at the end of a round: the Warden `actor` raises its fallen twin `target`, which stands again with `hp`. `replay.ts` already sets the target back to `fallen: false` with that health, so the board is right; it has no effect of its own yet.
- `DuoPartner.bonded`: each of the pair wears a half of one pair of Bond rings.
- Bond rings are gear with `base: 'bond-ring'` (icon `ring`), Rare or Epic, identified. Their `ItemView.power` says whose the other half is and what joining does.
- The Feed has a new kind, `twin`: "{hero} and {partner} broke the Twin Wardens on Floor {n}".

## What to build

1. **The Wardens' tokens:** paint `apps/web/public/art/tokens/dawn-warden.webp` and `dusk-warden.webp`, a pair of stone guardians, one lit like morning, one like its shadow, in the style of the other tokens. Say so in the PR and Claude points the monsters at them (`art` in `packages/engine/src/content/monsters.ts`); until then they draw as letter tokens.
2. **The rise:** in the fight scene, a `power: 'twin'` cue from the standing Warden to its fallen twin: a thread of light between them, the fallen token getting back up, and a sound. The Players must see it was the round's end that did it, so it reads as a rule, not a heal.
3. **The Twin door:**
   - On the Room stage, `DoorMarker` draws it as a gold-ringed arrow like a locked Door; give it a mark of its own (two hands, or a split ring).
   - On the Floor map, `Glyph` (`twin`) and `DoorGlyph` (`twin`) are Claude's placeholders (two figures; two dots on a gold passage). Make them match the map's ink style, and keep the legend entry.
4. **Bond rings:** an icon or painted art for `bond-ring` (two half-rings that fit together) wherever Items show, and the Duo strip's "Bond rings joined" line as something warmer, such as a glow linking the two portraits when `bonded`.
5. **The Tavern:** an icon for the `twin` Feed line (`tavernArt.tsx`).

## Fixtures

`apps/web/src/screens/sandbox/fightFixtures.json` has `duo-twin-wardens` and `duo-twin-wardens-partner`: a Fighter and a Wizard against the Floor 2 Wardens, who rise once before both fall in the same round. Show them on `/sandbox`, and a cut of one at a rise for the live scene.

## Done when

- A Wardens fight reads at a glance on a phone held upright: who rose, and why.
- The Twin door, the Wardens' Room and Bond rings are recognizable on the stage, the map and in the Bag.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording of a Wardens fight with a rise (kept out of the branch).
