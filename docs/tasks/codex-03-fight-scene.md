# Codex task 03: the fight scene

**Branch:** `codex/fight-scene`, based on `claude/week-3`, or on `main` once that is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Fights are the moment players watch most often. Every Move into a monster Room returns a finished fight as a replay, and the web plays it back. Build the fight scene in PixiJS that plays a replay on the Room's battle map: tokens slide, strike, shake and flash, damage numbers fly, and the d20 shows at the moments that matter ([design.md → Look and feel](../design.md#look-and-feel)).

## Contract

The input is a `FightReplay` from `@dark/shared` (`packages/shared/src/labyrinth.ts`). The server has already fought; the scene only shows what the events say, in order.

```tsx
// apps/web/src/components/fight/FightScene.tsx
export function FightScene(props: { replay: FightReplay; onDone: () => void }): JSX.Element
```

- `map`: the Room's battle map, `/art/rooms/<map>.jpg`. The art has four Door openings in the middle of each edge and open floor in the centre.
- `hero`, `monsters`: `Combatant`s with the starting `hp` and `maxHp`. `art` is the token image (a portrait for the Hero); it is null for monsters not painted yet, so show the name's initial on the ring. The ring is `banner` for Heroes, dark iron for monsters, gold when `boss` is true. The Dragon (a lone `boss`) is much bigger than anything else. A monster's `elite` (gilded, frenzied, armored, vampiric, swift) deserves a glow in its own color, gold for gilded; `powers` lists what it can do, for a tooltip if you like.
- `events`:

| Event | Show |
|---|---|
| `initiative` | Turn order. A short beat, or tiny numbers over the tokens. |
| `surprise` | `side` was caught off guard (a failed Sneak, or a mimic) and loses the first round: a flash of "Ambush!". |
| `attack` | `actor` strikes `target`: `natural` is the d20, `total` the roll with bonuses. Show the d20 when `natural` is 20 or 1, and on crits. A hit shakes the target and shows `damage`; `crit` is bigger and gold. A miss shows a whiff. `targetHp` is the target's health afterwards. `kind: 'spell'` is a bolt from the Wizard's hands, not a sword swing. |
| `blocked` | The Ashen Aegis turned aside `actor`'s blow: a shield flash on the Hero. |
| `burst` | `source: 'spell'`: the Wizard's burst. `source: 'bomb'`: the Hero's Fire bomb, thrown before the first round. One blast either way, then each `targets[]` entry's damage and new `hp`. |
| `heal` | `amount` of health back, `hp` afterwards. `ability` is `second-wind`, `cure-wounds`, `potion` or `life-steal`; give each its own small effect. |
| `power` | A monster's power: `actor` does it, `target` takes it. `thief`: snatches `amount` gold from the Hero (coins fly). `mend`: heals `target` by `amount` to `hp`. `drain`: the actor heals `amount` to `hp`. `breath`: a cone of fire on the Hero for `amount` damage, `hp` after (the Dragon's is the biggest moment of the fight). `undying`: the actor was about to fall and stays up at `hp` 1. `enrage`: the actor rages (red glow from now on). `frighten`: a roar before the first blow. |
| `save` | The Hero's saving throw against a power: `ability`, the d20 `natural`, `total` against `dc`, `success`. Show the die, like a death save but quicker. |
| `status` | `target` starts `burning`, is `paralyzed` or `frightened` for `turns`: a lasting mark on the token until it wears off. |
| `tick` | Burning hurts `target` for `damage` at the start of its turn, `hp` after. |
| `held` | Paralyzed: `target` loses this turn. |
| `fled` | A monster runs off the map (a thief with the gold). It isn't defeated. |
| `defeated` | That monster falls: fade it and grey it out. |
| `down` | The Hero drops to 0 health. Death saves follow. |
| `death-save` | One d20 roll (`natural`), with the running `successes` and `failures` (3 of either ends it; a natural 1 counts twice). This is the tensest moment in the game: roll the die big and slow. |
| `rise` | A natural 20 on a death save: the Hero stands up with `hp`. |
| `escape` | The Hero's Stance made it try to get away: a d20 (`natural`, `total` against `dc`). `success` ends the fight. |
| `end` | Show `outcome`: `victory`, `survived` (stable at 0, dragged back to the last safe Room), `escaped` (ran for it) or `dead`. |

- **Skip** calls `onDone` at once. When the replay ends, show the outcome and a Continue button that calls `onDone`.
- `prefers-reduced-motion`: no shaking or flying numbers; step through the events at a calm pace.
- Player-facing text comes from `t()`: reuse the `fight.*` keys in `apps/web/src/i18n/en.ts` and `ru.ts` (both languages), and add new keys to both files.

## Where it goes

- Claude's stand-in is `apps/web/src/screens/labyrinth/FightPlayback.tsx`. It already plays every event with plain DOM and shows what each one means, so read it first. `Labyrinth.tsx` renders it with the same props; swap it for `FightScene` there and delete the stand-in.
- **Fixtures:** `apps/web/src/screens/sandbox/fightFixtures.json` holds real replays: a quick crit, a pack of three, a Wizard burst, Cleric and potion heals, death saves that survive, a natural-20 rise, a death, a Mini-boss with its escort, the Dragon's fear and fire, an ambush, a Fire bomb, a Wary escape, a cutpurse running with gold, a ghoul's paralysis and a zombie that won't fall, hellhound fire and burning, and a Gilded elite. `/sandbox` (dev only) already has a button per fixture. Regenerate them with `npm run fixtures:fights -w @dark/api` if the format changes.
- Add `pixi.js` (v8) to `apps/web` only, and load the scene with a dynamic `import()` so it stays out of the first page load. Destroy the Pixi application when the component unmounts.
- Token art sits in `apps/web/public/art/tokens/` (256 px; the Dragon 512 px) and `public/art/portraits/`.

## Done when

- Every fixture plays on `/sandbox` at 375 px wide, at 60 fps on a mid-range phone, in English and Russian.
- A real fight in the Labyrinth tab plays in the new scene.
- `npm run typecheck` and `npm run build` pass, and the first-load bundle doesn't grow (check the `vite build` output).
- The pull request has a short screen recording of the Wizard burst, the death saves and the Dragon.
