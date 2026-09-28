# Codex task 03: the fight scene

**Branch:** `codex/fight-scene`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Fights are the moment players watch most often. Every Move into a monster Room returns a finished fight as a replay, and the web plays it back. Build the fight scene in PixiJS that plays a replay on the Room's battle map: tokens slide, strike, shake and flash, damage numbers fly, and the d20 shows at the moments that matter ([design.md → Look and feel](../design.md#look-and-feel)).

## Contract

The input is a `FightReplay` from `@dark/shared` (`packages/shared/src/labyrinth.ts`). The server has already fought; the scene only shows what the events say, in order.

```tsx
// apps/web/src/components/fight/FightScene.tsx
export function FightScene(props: { replay: FightReplay; room?: { floor: number; room: number }; onDone: () => void }): JSX.Element
```

- `map`: the Room's battle map. Get its image with `roomArt(replay.map, room)` from `apps/web/src/screens/labyrinth/roomArt.ts`: it returns the WebP `src` and a `style` that turns and mirrors the map the way that Room always is, so the fight happens on the same map the Player was just looking at. The maps are square, with four Door openings in the middle of the edges and open floor in the centre.
- `hero`, `monsters`: `Combatant`s with the starting `hp` and `maxHp`. `art` is the token image (a portrait for the Hero); keep a fallback for a monster not painted yet: the name's initial on the ring. The ring is `banner` for Heroes, dark iron for monsters, gold when `boss` is true. The Dragon (a lone `boss`) is much bigger than anything else. A monster's `elite` (gilded, frenzied, armored, vampiric, swift) deserves a glow in its own color, gold for gilded; `powers` lists what it can do (a bat swarm's `swarm`, for instance, could flutter).
- `events`:

| Event | Show |
|---|---|
| `initiative` | Turn order. A short beat, or tiny numbers over the tokens. |
| `surprise` | `side` was caught off guard (a failed Sneak, a mimic, a spider dropping from its web) and loses the first round: a flash of "Ambush!". |
| `attack` | `actor` strikes `target`: `natural` is the d20, `total` the roll with bonuses. Show the d20 when `natural` is 20 or 1, and on crits. A hit shakes the target and shows `damage`; `crit` is bigger and gold. A miss shows a whiff. `targetHp` is the target's health afterwards. `kind: 'spell'` is a bolt from the caster's hands, not a sword swing. |
| `blocked` | A blow turned aside: `by: 'aegis'` is the Ashen Aegis, `by: 'shield'` a Wizard's Shield spell. A shield flash on the Hero. |
| `burst` | `source: 'spell'`: the Wizard's burst. `source: 'bomb'`: the Hero's Fire bomb, thrown before the first round. One blast either way, then each `targets[]` entry's damage and new `hp` (a swarm takes double: the number already says so). |
| `heal` | `amount` of health back, `hp` afterwards. `ability` is `second-wind`, `cure-wounds`, `potion` or `life-steal`; give each its own small effect. |
| `feature` | A Hero's Path at work. `survivor`: heals `amount` to `hp`. `indomitable`: would have fallen, stays up at `hp` 1. `ward` (Abjurer): a ward is raised (`left`), or soaks `amount` of a blow (`left` after). |
| `power` | A monster's power: `actor` does it, `target` takes it. `thief`: snatches `amount` gold from the Hero (coins fly). `mend`: heals `target` by `amount` to `hp`. `drain`: the actor heals `amount` to `hp`. `breath`: a cone of fire on the Hero for `amount` damage, `hp` after (the Dragon's is the biggest moment of the fight). `undying`: the actor was about to fall and stays up at `hp` 1. `enrage`: the actor rages (red glow from now on). `frighten`: a roar before the first blow. `explode`: a goblin sapper's bomb goes off as it falls: a blast from the fallen token for `amount` damage to the Hero, `hp` after. `wail`: a banshee's scream before the first blow, `amount` damage to the Hero, `hp` after. |
| `save` | The Hero's saving throw against a power: `ability`, the d20 `natural`, `total` against `dc`, `success`. Show the die, like a death save but quicker. |
| `status` | `target` starts `burning`, is `paralyzed`, `frightened` or `poisoned` for `turns`: a lasting mark on the token until it wears off. |
| `tick` | Damage at the start of `target`'s turn, `hp` after: burning, or poison when `status` is `poisoned` (make the two look different: fire and green). |
| `held` | Paralyzed: `target` loses this turn. |
| `fled` | A monster runs off the map (a thief with the gold). It isn't defeated. |
| `defeated` | That monster falls: fade it and grey it out. |
| `down` | The Hero drops to 0 health. Death saves follow. |
| `death-save` | One d20 roll (`natural`), with the running `successes` and `failures` (3 of either ends it; a natural 1 counts twice). This is the tensest moment in the game: roll the die big and slow. |
| `reroll` | A Lucky charm or the Luckstone rolls a failed death save's die (`natural`) again; the next `death-save` has the better one. |
| `rise` | A natural 20 on a death save: the Hero stands up with `hp`. |
| `escape` | The Hero's Stance made it try to get away: a d20 (`natural`, `total` against `dc`). `success` ends the fight. |
| `end` | Show `outcome`: `victory`, `survived` (stable at 0, dragged back to the last safe Room), `escaped` (ran for it) or `dead`. |

- **Skip** calls `onDone` at once. When the replay ends, show the outcome and a Continue button that calls `onDone`.
- `prefers-reduced-motion`: no shaking or flying numbers; step through the events at a calm pace.
- Player-facing text comes from `t()`: reuse the `fight.*` keys in `apps/web/src/i18n/en.ts` and `ru.ts` (both languages), and add new keys to both files.
- Sound: keep what the stand-in plays for each event (`play()` from `apps/web/src/sound.ts`, and `buzz()` on a natural 20).

## Where it goes

- Claude's stand-in is `apps/web/src/screens/labyrinth/FightPlayback.tsx`. It already plays every event with plain DOM, words it, times it and sounds it, so read it first. `Labyrinth.tsx` renders it over the whole screen with the same props (`replay`, `room`, `onDone`); swap it for `FightScene` there and delete the stand-in. The Labyrinth's other overlays (the cards in the middle, the bottom sheet) sit below it.
- **Fixtures:** `apps/web/src/screens/sandbox/fightFixtures.json` holds 23 real replays: a quick crit, a pack of three, a Wizard burst, Cleric and potion heals, death saves that survive, a natural-20 rise, a death, a Mini-boss with its escort, the Dragon's fear and fire, an ambush, a Fire bomb, a Wary escape, a cutpurse running with gold, a ghoul's paralysis and a zombie that won't fall, hellhound fire and burning, an Abjurer's ward, a Champion's Survivor, a Guardian's Indomitable, a Gilded elite, a goblin sapper's blast, a giant spider's poison, a Fire bomb on a bat swarm, and a banshee's wail. `/sandbox` (dev only) already has a button per fixture. Regenerate them with `npm run fixtures:fights -w @dark/api` if the format changes.
- Add `pixi.js` (v8) to `apps/web` only, and load the scene with a dynamic `import()` so it stays out of the first page load. Destroy the Pixi application when the component unmounts.
- Token art sits in `apps/web/public/art/tokens/` (256 px; the Dragon 512 px) and portraits in `public/art/portraits/`; every monster has its token now.

## Done when

- Every fixture plays on `/sandbox` at 375 px wide, at 60 fps on a mid-range phone, in English and Russian.
- A real fight in the Labyrinth tab plays in the new scene, on the Room's turned map.
- `npm run typecheck` and `npm run build` pass, and the first-load bundle doesn't grow (check the `vite build` output).
- The pull request has a short screen recording of the Wizard burst, the death saves, the sapper's blast and the Dragon.
