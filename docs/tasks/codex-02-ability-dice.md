# Codex task 02: the ability-roll dice animation

**Branch:** `codex/ability-dice`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Rolling ability scores is the first luck moment a Player gets. Today `CreateHero` shows each new set straight away. Build a self-contained animation that plays when a set arrives: dice tumble, settle, and the lowest die of each score gets struck out.

## Contract

- The input is an `AbilitySetView` from `@dark/shared`: for each ability, four d6 faces, the index of the dropped die, and the total. The server has already rolled, so the animation only reveals the result it is given.
- Component: `apps/web/src/components/dice/AbilityRoll.tsx`

  ```tsx
  export function AbilityRoll(props: { set: AbilitySetView; onDone?: () => void }): JSX.Element
  ```

- The scores reveal one by one, STR → CHA, in about 3 seconds in total:
  - For each score, 4 dice show random faces, then land on the real ones.
  - The dropped die fades and is struck out.
  - The total pops up.
- `prefers-reduced-motion` shows the result immediately.
- Colors come from look B tokens in `apps/web/src/styles.css`. Ability labels come from `t('ability.str')` etc. (both languages).

## Where it goes

- Integration is Claude's side: `apps/web/src/screens/heroes/CreateHero.tsx` will render `AbilityRoll` for the newest set after "Roll" or "Reroll", with `AbilitySetCard` below it. You may add it yourself if the change stays small.
- Showcase it on `/sandbox` with a fixture set and a "Roll again" button that swaps between fixtures.

## Done when

- The animation plays on `/sandbox` and reads well at 375 px wide.
- `npm run typecheck` and `npm run build` pass.
- The pull request includes a short screen recording or GIF.
