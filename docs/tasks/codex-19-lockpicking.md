# Codex task 19: the Lockpicking minigame

**Branch:** `codex/lockpicking`, based on `main` once `claude/lockpicking` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The tricky lock in a Lockpicking Event room is now a minigame (docs/design.md → Event rooms): three pins, each set by tapping while its sweeping marker is in the lit sweet spot. A miss breaks a pick and that pin sweeps again; out of picks, the lock jams. Deeper Floors sweep faster, and Rogues get a wider spot and a spare pick.

It works today with a plain stand-in, `apps/web/src/screens/labyrinth/LockPick.tsx`: a bar, a lit spot and a marker. The `/sandbox` page has it against fake locks (Floor 1, Floor 10, a Rogue's), each tap judged a moment later as the server would. Make it feel like picking a lock: tension while the pin sweeps, a click that lands when a pin sets, a snap when a pick breaks.

## Contract (already in `packages/shared`)

- `EventView` of kind `lockpicking` has `lock: { pins, picks, set, broken } | null` (null once done). `set` pins are set already and `broken` picks broken, so a Player who leaves and comes back picks up where the lock stood.
- Each pin is `{ period, phase, center, width }`. `lockPinAt(pin, ms)` says where its marker is (0–1) `ms` after its sweep began. Draw the marker from it: the server judges taps by the same function, so the marker must not drift from it (no easing on the marker itself).
- `lockPinSets(pin, ms)` says whether a tap at `ms` sets the pin. Use it to react at once; the server's answer is the same.
- `POST /api/labyrinth/event { action: 'pick-lock', tap: ms }` → `LabyrinthResult`: one tap, `ms` from the start of the next pin's sweep. The view comes back with `set` or `broken` one higher; the last pin brings the Chest in `loot`, and the last broken pick the notice that the lock jams.
- The stand-in's props: `{ lock: LockView; busy: boolean; onTap: (ms: number) => void }`. Keep them, so the swap is one file.

## What to build

1. **The lock:** a lock face or cross-section with the three pins, the one in play lit. The sweep reads as the pick feeling for the shear line; the sweet spot is clear but not garish.
2. **Set and miss:** a set pin drops into place with a click (`latch`) and stays down; a miss snaps a pick (`miss`, or a new sound if you find a fitting CC0 one; ask the owner before downloading anything). Picks left show as picks, not a number.
3. **Timing:** time taps from `pointerdown` and `performance.now()`, as the stand-in does; the next sweep starts once the server has answered the last tap (`busy` turns false and `set` or `broken` has changed).
4. **Opening:** when the last pin sets, the lock turns before the result's report and its Chest.

## Done when

- A Player can read the lock and land a tap on a phone held upright, one thumb.
- With reduced motion, the marker still sweeps (it is the game), and everything else is still.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording (kept out of the branch).
