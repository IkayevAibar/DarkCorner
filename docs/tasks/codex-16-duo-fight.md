# Codex task 16: fights played turn by turn in the scene, with a Duo partner

**Branch:** `codex/turn-fights`, based on `main` once `claude/manual-fights` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Two things changed about fights (docs/design.md → Manual fights, Duos):

1. **Fights in Rooms are played turn by turn.** At each of the Hero's turns the fight waits for its Player's choice (tap a monster to attack it, cast, drink, Dodge, Help, Guard, Pull up, Escape, or Auto). Only a fight fought on Auto from the doorway still arrives whole and plays in your scene as before.
2. **A Duo fights side by side:** a second Hero, the partner, is in the fight under the key `'ally'`, and each Player chooses for its own Hero.

Claude's working stand-in is `LiveFightPanel` in `apps/web/src/screens/labyrinth/LiveFight.tsx`: a DOM board, the log and the choice buttons. Replace it with the scene, keeping its props, so the swap in `Labyrinth.tsx` is one line.

## Contract

`packages/shared/src/labyrinth.ts`:

- **`LabyrinthView.fight: LiveFight | null`**: the fight going on, as this Player sees it.
  - `map`, `hero` (this Player's Hero), `ally` (its partner or null), `monsters`, and `events` so far.
  - `turn: TurnOptions`: whose turn (`hero` or `ally`, from this Player's side), `round`, and `continuing` (a second action in the same turn).
    - What it can do: `actions` (`attack`, `burst`, `cure`, `second-wind`, `potion`, `escape`, `dodge`, `help`, `guard`, `revive`), the `targets` it can attack or mark, and `cure` (whom Cure wounds can reach).
    - `rage` and `mark`: it can start a Rage or place a Hunter's mark first, free.
    - `attacks`, `spells`, `heals` and `potions` left.
  - `mine`: it is this Player's turn. `deadline`: in a Duo, when the AI takes the turn. `auto`: this Player's Hero fights on its own.
- **`POST /api/labyrinth/fight { action: HeroActionView }`**: `{ kind, target?, rage?, mark? }`. `target` is a monster key for `attack` (left out: the weakest), or `'hero'`/`'ally'` for `cure`. `kind: 'auto'` hands the rest to the AI. The answer is a `LabyrinthResult`: its `view.fight` has the new events up to the next choice, or `fight` holds the whole finished fight (with the report's loot, XP and notes).
- **Events** (`FightEventView`):
  - `feature` has three new kinds: `dodge`, `help` (with `target`: the partner) and `guard` (with `target`).
  - A new event, `revive`: a Hero (`actor`, absent for the Hero) pulls its fallen partner (`target`) up. It has `natural`, `total`, `dc`, `success` and `hp`.
  - In a Duo, `down`, `death-save`, `rise`, `reroll`, `save`, `feature` and `escape` carry `actor: 'ally'` for the partner (absent means the Hero).
  - A fallen Duo Hero stays down while its partner fights on, and makes one `death-save` on each of its turns. It stands again on a `rise`, a successful `revive`, or a `heal` from a Cleric's Cure wounds (a `heal` with `by`).
  - `blocked` has an optional `target`. `heal` has an optional `by`: the healer when it isn't `actor`.
- `FightReplay.ally`: the partner in a finished fight, or null.

## What to build

1. **Play as it comes:** the scene takes a `LiveFight` and plays only the new events each time it grows (from the last one shown), then waits. The board keeps everyone's health and statuses between turns.
2. **The Hero's turn:**
   - Tap a monster to attack it. A choice bar holds the other actions and Auto; the Rage and Hunter's mark toggles come before the action.
   - Cure wounds asks whom when it can reach both Heroes.
   - Only what `turn.actions` allows is on offer. While a choice is on its way (`busy`), nothing can be tapped.
3. **The partner:**
   - Its token beside the Hero's, a little smaller, in its banner color, with its own health bar, statuses and death saves.
   - Its attacks, the blows it takes, and a Cleric's light flying to whoever it heals.
   - Help (a spark to the partner), Guard (the Guard steps in front, and blows turn to it) and Pull up.
   - On its turn: whose turn it is and the `deadline` countdown.
4. **The end:** when the fight is over (the `BoardFight` has an `outcome`), show its last blows, then call `onDone`: the report comes next. Replay only what the Player hasn't seen.
5. **Frames** (`replay.ts`): `initialFrame` includes the ally, and `advance` moves health, `fallen` and statuses for the key an event names (`actor ?? 'hero'`), not always `'hero'`. `ward`, `raging` and `marked` belong to each Hero, since both could be a raging Barbarian. **Cues** (`choreography.ts`): `feature`, `down`, `rise` and `revive` point at their actor and target.
6. A fight fought on Auto from the doorway still plays whole in the scene, as now.

`describe()` already reads every new line (Claude added `fight.feature.dodge`, `help`, `guard`, `fight.revive.*`, `fight.heal.mend` and `fight.deathSaveOf`).

## Fixtures

`apps/web/src/screens/sandbox/fightFixtures.json` has 36 real fights (the 30 solo ones unchanged). The Duo ones each come with the same fight from the other Player's screen (`-partner`):

- `duo-side-by-side`: a Fighter and a Cleric against a Duo's bigger group, the Cleric mending the Fighter.
- `duo-pulled-up`: the Wizard falls, rolls death saves, and its Barbarian partner pulls it up.
- `duo-teamwork`: played by hand, with the Fighter Guarding then Helping and the Wizard Dodging.

For turns on `/sandbox`, cut any fixture's events at a Hero's `attack` and add a `TurnOptions`. Show solo and Duo turns, the partner's turn with a deadline, and a fight's end.

## Done when

- A fight played turn by turn feels like a fight in the scene, on a phone held upright and on a desktop: new blows play as they arrive, the choices are one tap, and a Duo shows both Heroes from both Players' screens.
- Solo fights on Auto look exactly as before.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording of a solo fight played turn by turn and of a Duo fight (kept out of the branch).
