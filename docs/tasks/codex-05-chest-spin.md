# Codex task 05: the Chest Spin, the identify reveal and Tier effects

**Branch:** `codex/chest-spin`, based on `claude/week-4`, or on `main` once that is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Loot is the game's big emotion ([design.md → Chests and keys](../design.md#chests-and-keys), [Look and feel](../design.md#look-and-feel)). Build the three moments, ported from the look test on the `prototype/look-test` branch (`prototypes/look-test/js/`), in PixiJS or CSS as fits:

- **The Spin:** opening a Chest. A strip of Items scrolls past and slows to a stop on the prize, with light and sound that grow with the Tier.
- **The identify reveal:** an Unidentified Item's `?` gives way to its name, Quality, Bonus stats and power, line by line. Radiant shows its shimmer.
- **Tier drop effects:** when Items arrive (the Labyrinth report, the Spin, the reveal): beams of light and particles that grow with the Tier, and a screen shake for Mythic and above. Android phones vibrate on Mythic or better (`navigator.vibrate`); iPhones can't.

## Contract

All types come from `@dark/shared` (`packages/shared/src/economy.ts`, `items.ts`).

```tsx
// apps/web/src/components/loot/ChestSpin.tsx
export function ChestSpin(props: { result: OpenChestResult; onDone: () => void }): JSX.Element
// apps/web/src/components/loot/IdentifyReveal.tsx
export function IdentifyReveal(props: { before: ItemView; after: ItemView; onDone: () => void }): JSX.Element
// apps/web/src/components/loot/TierBurst.tsx
export function TierBurst(props: { tier: Tier; children: ReactNode }): JSX.Element
```

- `OpenChestResult.prize` is the Item won and `odds` what the Chest could hold. Build the strip's decoys from `odds`, so an Iron Chest's strip looks like an Iron Chest's. The prize can be Unidentified: then the Spin ends on its `?` and the reveal can follow.
- `IdentifyResult` gives `after`; `before` is the Item as it was.
- `TierBurst` wraps an Item tile or card where it appears: nothing for Common, rising to the full show for Mythic and Relic.
- Skip and `prefers-reduced-motion`: show the result at once.
- Text via `t()`, both `en.ts` and `ru.ts`.

## Where it goes

Claude's stand-ins, to replace:
- `apps/web/src/screens/loot/ChestSpin.tsx` (the Spin, used by `Loot.tsx`). Same props: move or replace it.
- `IdentifySheet` in `apps/web/src/screens/loot/Loot.tsx` shows the revealed Item with a plain pop. Use `IdentifyReveal` there, and in the Heroes tab's Item actions (`CharacterSheet.tsx`).
- Loot in the Labyrinth report (`Report` in `apps/web/src/screens/labyrinth/Labyrinth.tsx`) and the Spin: wrap tiles in `TierBurst`.

Sound (Howler.js) comes with the sound pack the owner approves; leave a hook such as `onTier(tier)` so it can be added in one place.

On `/sandbox`: a button per Chest grade that plays the Spin on a fixture `OpenChestResult` (write fixtures by hand from the schema, including an Unidentified prize), a reveal for a Rare, a Radiant Legendary and a Relic, and a row of `TierBurst` tiles for every Tier.

## Done when

- The Spin, the reveal and every Tier's burst play on `/sandbox` at 375 px wide, in English and Russian, smoothly on a mid-range phone.
- Opening a real Chest in the Loot tab and identifying a real Item use them.
- `npm run typecheck` and `npm run build` pass.
- The pull request has a screen recording of an Iron Chest, a Gold Chest landing on a Mythic, and a Relic reveal.
