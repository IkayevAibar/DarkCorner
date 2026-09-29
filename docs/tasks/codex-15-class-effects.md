# Codex task 15: Barbarian and Ranger in the fight scene

**Branch:** `codex/class-effects`, based on `main` (after `codex/floor-map`, or alongside it: they touch different files).
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Two Classes joined mid-Season: the Barbarian and the Ranger (docs/design.md → Classes). Their fights already play in your scene, because every event they use existed except three `feature` kinds, which today fall back to the generic heal glow. Give each Class a look as strong as the Cleric's radiant light and the Wizard's fireball.

## New in the contract

- `Combatant.class` can now be `barbarian` or `ranger`.
- The `feature` fight event (`packages/shared/src/labyrinth.ts`) has three new kinds and an optional `target`:
  - `rage`: the Barbarian flies into a Rage. It lasts to the end of the fight: the Barbarian hits for more, and every blow on it lands lighter (the `attack` events already carry the smaller damage).
  - `mark`, with `target`: the Ranger's Hunter's mark goes on that monster. When the marked monster falls, another `mark` event moves it to the next one; it lasts to the end of the fight.
  - `relentless`, with `hp: 1`: a raging Bear-heart Barbarian refuses to fall (like `indomitable`). A `save` event (CON) comes just before it.
- Rangers shoot: a Ranger with a bow has `strike: 'shoot'`, so your arrow already flies. Barbarians swing greataxes and mauls (`slash`, `blunt`).

## What to build

1. **Rage:** a burst of red-orange fury on the Barbarian's token the moment it starts (a roar: a shockwave ring, a screen shake a little stronger than a crit), then a lasting ember-red aura that pulses with each of its blows until the fight ends. Blows that land on a raging Barbarian flash duller: the damage number is smaller, and the scene should show the hit being shrugged off.
2. **Hunter's mark:** a reticle (a thin ring with four ticks) snaps onto the marked monster and stays there, rotating slowly. Hits on it show a small extra spark. When the mark moves on, it flies from the fallen monster to the next one.
3. **Relentless:** like Indomitable, but furious: the token staggers, then plants its feet with a red flare.
4. Sounds through the existing `play()` hooks: `presentation.ts` already plays a low crit for `rage` and a light equip for `mark`; tune them if they don't fit.
5. Reduced motion: the aura and the reticle stay, still (no pulse, no rotation, no shake).

## Fixtures

Claude added three real fights to `apps/web/src/screens/sandbox/fightFixtures.json` (30 in all; the other 27 are unchanged): `barbarian-rage` (a Rage against a pack), `ranger-mark-moves` (the mark moves on after the first kill) and `bearheart-relentless` (a raging Bear-heart stays up three times against a Mini-boss). Showcase them on `/sandbox`. Barbarians and Rangers wear a Fighter's and a Rogue's portrait until their own are painted.

## Done when

- The three fixtures play with the new effects, at 1× and 2×, on a phone held upright and on a desktop.
- The in-scene Fight log and the report's Fight log read them (Claude added the lines in `describe()`).
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording or screenshots of each effect (kept out of the branch).
