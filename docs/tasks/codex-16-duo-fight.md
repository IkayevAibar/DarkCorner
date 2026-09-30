# Codex task 16: a Duo in the fight scene

**Branch:** `codex/duo-fight`, based on `main` once `claude/duos` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Two Players' Heroes can now walk the Labyrinth as a **Duo** and fight side by side (docs/design.md → Duos). The engine plays one fight with both Heroes in it, and each Player gets the same fight from their own side. Your scene doesn't draw a second Hero yet, so for now a Duo fight skips the stage: the Labyrinth shows its report with the Fight log written out. Put the partner on the stage and play Duo fights like any other.

## New in the contract

- `FightReplay.ally` (`packages/shared/src/labyrinth.ts`): the partner as a `Combatant` with the key `'ally'`, or `null` in a fight alone. `hero` is always the Hero of the Player watching.
- Events about the partner say so:
  - `attack`, `burst`, `heal`, `initiative`, `status`, `tick`, `held`, `expire`, `power`: the key `'ally'` appears wherever a Hero key goes (`actor`, `target`, `targets[].key`, `order`).
  - `down`, `death-save`, `rise`, `reroll`, `save`, `feature`, `escape`: these never named a Hero, because there was only one. They now carry an optional `actor`: `'ally'` for the partner, absent for the Hero.
  - `blocked` (the Ashen Aegis, a Shield spell) has an optional `target` (`'ally'`, or absent for the Hero).
  - `heal` has an optional `by`: a Cleric casting Cure wounds on its partner is `{ actor: 'ally', by: 'hero', ability: 'cure-wounds' }` (or the other way round). `actor` is who is healed.
- Nobody escapes in a Duo, and nobody is spared by a Trivial fight, so `escape` never shows up in one.
- A Hero that goes down and stabilizes stays down while its partner fights on. If the partner wins, the fallen Hero's `end` outcome is `victory` too (the server tells that Player "…hauls you back to your feet").
- The partner's side of the same fight is the same events with `hero` and `ally` swapped (`forAlly` in `packages/engine/src/duo.ts`), so drawing it from one side is enough.

## What to build

1. **The partner's token**: next to the Hero's, a little smaller, in its banner color, with its own health bar and status rings. Monsters' blows, breath and wails reach it; its own swings, arrows, spells and heals come from it.
2. **Death saves**: `down`, `death-save` and `rise` for the partner play on the partner's token, while the other Hero keeps fighting. The death-save dice overlay must say whose saves they are (the partner's name).
3. **A Cleric mending its partner**: `heal` with `by` flies the radiant light from the healer to the one healed.
4. **Frames** (`replay.ts`): `initialFrame` includes the ally, and `advance` moves health, `fallen` and statuses for the key an event names (`actor ?? 'hero'`), not always `'hero'`. `ward`, `raging` and `marked` are per Hero now (both could be a raging Barbarian).
5. **Cues** (`choreography.ts`): `feature`, `down` and `rise` target `actor ?? 'hero'`.
6. Then remove the stand-in: in `apps/web/src/screens/labyrinth/Labyrinth.tsx`, `present()` sends a fight with `ally` to the report; let it play in `FightScene` like the rest (the report can go back to its Fight log button).

The fight log already reads Duo fights (`describe()` names the partner, and Claude added `fight.heal.mend` and `fight.deathSaveOf`).

## Fixtures

Two real Duo fights are in `apps/web/src/screens/sandbox/fightFixtures.json` (32 in all; the other 30 are unchanged): `duo-side-by-side` (a Fighter and a Cleric against a Duo's bigger group, the Cleric mending the Fighter) and `duo-hauled-up` (the Wizard watching goes down, stabilizes, and its Barbarian partner wins). Showcase them on `/sandbox`, and add each one's other side with `forAlly(events, outcome)` so the scene is checked from both Players' screens.

## Done when

- Both fixtures, from both sides, play at 1× and 2× on a phone held upright and on a desktop, with the partner's token, its death saves and the mend.
- Solo fights look exactly as before.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording or screenshots (kept out of the branch).
