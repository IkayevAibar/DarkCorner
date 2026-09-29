# Codex task 14: the fight scene, second pass

**Branch:** `codex/fight-juice`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The owner's verdict on the live fight scene (task 03): "very simple". It shows every event correctly, but it reads as circles, lines and numbers. Fights are what Players watch most, so this pass is about feel: every blow should look like the thing that dealt it, land with weight, and every fighter should look alive. Keep what works: the events stay the single source of truth, Skip stays instant, reduced motion stays calm.

## New in the contract

`Combatant` (`packages/shared/src/labyrinth.ts`) now carries:

- `strike`: how it lands its blows. `slash`, `pierce`, `blunt`, `shoot` (bows and the goblin archer), `bite`, `claw`, `touch` (wraiths, banshees). The Hero's comes from its main weapon; a spell attack is still the attack's `kind: 'spell'`.
- `kin`: a monster's kin (`beast`, `goblinoid`, `undead`, `demon`, `dragonkin`, `humanoid`); null for the Hero.
- `class`: the Hero's Class (`fighter`, `rogue`, `wizard`, `cleric`), so spells can look like the one who cast them; null for monsters.

The 27 fixtures carry both. Every strike and kin appears in them except a Hero's `shoot`; make a hand-written example for a bow.

## What to build, most important first

1. **Blows that look like their weapon** (`strike`): a slash leaves a curved arc across the target; a pierce is a fast straight thrust streak; a blunt blow lands an impact ring with dust; `shoot` flies an arrow (a bolt for the Wizard's spells is separate) from shooter to target with a trail; a bite snaps jaws; claws rake three scratch lines; a touch is a cold wisp. A miss shows the swing going wide.
2. **Weight on every hit:** hit-stop (a 50–80 ms freeze on contact), the target knocked back a few pixels and flashing white then red, particles by what was hit (bone chips for undead, embers for demons, sparks on armor, dark splashes for flesh), and a screen shake that grows with the share of health the blow took. Crits add a short slow-motion, a gold spark ring and a slight zoom.
3. **Spells by Class:** a Wizard's bolt is a projectile with a trail and an impact burst; the Wizard's burst is a fireball that flies, then blooms with a shockwave; a Fire bomb arcs through the air before it goes off; a Cleric's spells come down as radiant light; healing rises as sparkles in the heal's own color.
4. **Deaths by kin:** undead crumble to dust, demons burst into embers, beasts slump over, goblins and humanoids topple; the token falls (a slight turn and sink) before it fades. A thief that flees keeps its dash off the map.
5. **Whose turn it is:** the acting token lifts and glows; the target gets a mark. A new Player should be able to follow the fight without reading the log.
6. **Lasting effects that move:** flames licking a burning token, green bubbles rising off a poisoned one, frost or chains on the paralyzed, dark wisps around the frightened. They go when the `expire` event says so.
7. **The Hero at the edge:** below a quarter of health, a slow heartbeat pulse and a red vignette; going `down` drains the color from the scene until a `rise` (a burst of golden light) or the end.
8. **Life in the room:** tokens breathe slightly while idle; the air drifts with the theme's dust (smoke in the warrens, dust in the crypts, embers in the depths, ash in the lair); a soft vignette.
9. **Speed:** a 1× / 2× toggle next to Skip, remembered on the device.
10. **The log during the fight:** a Log button that opens every line so far in a scrollable panel (the playback pauses while it's open). After the fight the report already has a **Fight log** button (`apps/web/src/screens/labyrinth/FightLog.tsx`, using your `describe()`), so the two should read the same.

## Constraints

- 60 fps on a mid-range phone: pool particles, cap them, and stop the ticker when nothing moves (as the scene does now).
- The first page load must not grow; the stage stays behind its dynamic `import()`. Keep any art small (WebP, a sprite sheet if you draw particles as images).
- `prefers-reduced-motion`: no shake, hit-stop, slow motion or drifting air; effects become short fades.
- Text via `t()` in both `en.ts` and `ru.ts`.

## Done when

- Every fixture plays on `/sandbox` at 375 px wide in English and Russian at 60 fps on a mid-range phone, and reads clearly without the log.
- A real Labyrinth fight plays with the new effects.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The pull request links short recordings (kept out of the branch) of: a Fighter's slashes and a crit, the goblin archer's arrows, a Wizard's bolt and burst, a Cleric healing, undead crumbling and a demon bursting into embers, the Hero going down and rising, and the Dragon.
