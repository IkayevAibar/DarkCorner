# Codex task 06: the Forge Upgrade animation and the lockpicking minigame

**Branch:** `codex/forge-lockpick`, based on `claude/week-4`, or on `main` once that is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Part 1: the Upgrade strike

An Upgrade is a gamble with the Item on the anvil ([design.md → The Forge](../design.md#the-forge)). Build the moment between pressing "Strike" and seeing the result: the hammer comes down, sparks fly, and the result lands.

```tsx
// apps/web/src/components/forge/UpgradeStrike.tsx
export function UpgradeStrike(props: { item: ItemView; result: UpgradeResult; onDone: () => void }): JSX.Element
```

- `UpgradeResult` (`packages/shared/src/economy.ts`): `outcome` is `success`, `failed`, `dropped`, `saved` (a Protection scroll burned instead) or `destroyed`; `roll` is the d100 and `chance` the percent needed (success when `roll` ≤ `chance`).
- Show the d100 against the chance. Each outcome needs its own ending: a bright ring for success, a dull clang for failed, cracks for dropped, a burning scroll for saved, and the Item shattering for destroyed. A success to +10 is the biggest moment of all.
- Claude's stand-in is `UpgradeLine` inside `ForgeSheet` in `apps/web/src/screens/city/Forge.tsx`: play `UpgradeStrike` when a result arrives, then show the sheet as now.

## Part 2: the lockpicking minigame

[design.md → Event rooms](../design.md#event-rooms-season-0): "stop the moving pin in the sweet spot. Rogues get a wider sweet spot." Build it as a self-contained component; Claude wires it to the server afterwards (today the Lockpicking room is a DEX Check).

```tsx
// apps/web/src/components/lockpick/Lockpick.tsx
export function Lockpick(props: {
  /** Where the sweet spot starts and how wide it is, both 0–1 along the track. */
  sweetSpot: { start: number; width: number };
  /** Full sweeps of the track per second. */
  speed: number;
  /** Seconds before the pick snaps on its own. */
  timeLimit: number;
  /** Where the pin stopped (0–1), or null when time ran out. */
  onStop: (position: number | null) => void;
}): JSX.Element
```

- One tap (or Space) stops the pin; there is no second try. Keep it readable at 375 px and fair on slow phones: move the pin by elapsed time, not by frame count.
- Suggested difficulty on `/sandbox`: width 0.12 for Rogues and 0.07 for others, speed 0.8–1.4, time limit 10–20 seconds.

## Where

- Components under `apps/web/src/components/forge/` and `apps/web/src/components/lockpick/`.
- `/sandbox`: every Upgrade outcome with fixture results (write them from the schema), and the minigame with sliders for width and speed.
- Text via `t()`, in both `en.ts` and `ru.ts`.

## Done when

- Every outcome and the minigame play on `/sandbox` at 375 px wide, in English and Russian.
- A real Upgrade at the Forge plays the strike.
- `npm run typecheck` and `npm run build` pass.
- The pull request has a short recording of a success, a destruction and a round of lockpicking.
