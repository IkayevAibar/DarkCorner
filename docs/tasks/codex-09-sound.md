# Codex task 09: sound effects

**Branch:** `codex/sound`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).
**Waits for:** the owner's OK on the sound packs in [art/icons-and-sounds.md](../art/icons-and-sounds.md). Claude then puts the chosen files in `apps/web/public/sfx/` and lists them there.

## Goal

"Luck you can see" — and hear ([design.md → Look and feel](../design.md#look-and-feel)): dice, hits, Doors, and reveals that get bigger with each Tier. One small sound module, and calls to it from the moments that matter.

## Contract

```ts
// apps/web/src/sound.ts
export type Sound =
  | 'door' | 'step' | 'hit' | 'crit' | 'miss' | 'death' | 'victory'
  | 'd20' | 'coins' | 'anvil' | 'shatter' | 'chest-open'
  | 'reveal-common' | 'reveal-rare' | 'reveal-epic' | 'reveal-legendary' | 'reveal-mythic' | 'reveal-relic';
export function play(sound: Sound): void;
export function useSoundSetting(): [on: boolean, set: (on: boolean) => void];
```

- Howler.js (add to `apps/web` only), sprites or small files, loaded after the first user tap (browsers block audio before that).
- A sound on/off switch in the account sheet (`AccountSheet` in `apps/web/src/components/Shell.tsx`), remembered in `localStorage` (wrap it in try/catch). Default on.
- Android phones vibrate (`navigator.vibrate`) on Mythic-or-better drops and on natural 20s; iPhones can't, so just skip it there.

## Where it plays

| Moment | Where the code is |
|---|---|
| Moving through a Door | `api.moveTo` calls in `apps/web/src/screens/labyrinth/Labyrinth.tsx` |
| Hits, crits, misses, death saves, victory, death | the fight scene (Codex task 03) or the stand-in `FightPlayback.tsx` |
| Checks and the goblin's dice | `CheckLine` and the duel line in `Labyrinth.tsx` |
| Chests and reveals by Tier | the Spin and identify reveal (Codex task 05) or the stand-ins in `screens/loot/` |
| The Forge strike, a destroyed Item | the Forge strike (Codex task 06) or `Forge.tsx` |
| Gold from the Shops and the Market | `Shop.tsx`, `Market.tsx` |

## Done when

- `/sandbox` has a button per `Sound`, and the switch mutes everything.
- Every moment in the table plays its sound on a phone.
- `npm run typecheck` and `npm run build` pass.
