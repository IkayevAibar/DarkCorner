# Monster tokens: 17 image prompts

Every monster fights as a round token. Only four have art so far, from the look test: the Goblin, the Skeleton, the Imp and the Dragon (`apps/web/public/art/tokens/`). The other 17 fight as a lettered disc. Each prompt below draws the monster so its power reads at a glance ([design.md → Monsters](../design.md#monsters)).

## How to use

1. Use one chat for the whole batch. Send the **style block** first.
2. Send each prompt below. Every prompt repeats the framing, so none depends on the one before.
3. Save each result as PNG in `art/monsters/` under the file name shown, e.g. `giant-rat.png`.
4. Keep the exact prompts in `art/monsters/generation-prompts.json` and check the files into `art/monsters/validation.json`, as the portrait batch did (`art/portraits/`). Claude shrinks them for phones and adds them to the game.

The three Mini-bosses are drawn a little grander, since they fight on a larger token; the Dragon is done.

## Style block

```
For every image in this chat: a monster portrait for a round game token in a dark fantasy ink illustration with a gothic comic-book feel, matching a set that already has a goblin, a skeleton, an imp and a dragon. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red, tarnished brass and sickly green; fire and magic glow in dull orange or cold blue, never neon. Head and shoulders (or the front of the body for beasts), facing the viewer, the head centered and readable at 48 pixels, with the face and essential silhouette inside a central circle so it can be cropped round. Square 1:1. Genuinely transparent background; if unavailable, solid pure black. No scenery, no frame, no text, letters, numbers or watermarks. Any marks or symbols are abstract shapes, never writing. Reply "Ready" and wait.
```

## Prompts

| File | Floors | Prompt |
|---|---|---|
| `giant-rat.png` | 1–3 | A giant rat: matted grey fur, a scarred snout, long yellowed teeth, small red eyes, whiskers caught in the light. |
| `goblin-archer.png` | 1–3 | A goblin archer: a hood of rat fur, one eye squinting along a nocked arrow, a crude shortbow, crow feathers tied in its hair. |
| `goblin-cutpurse.png` | 1–3 | A goblin cutpurse: a sly, greedy grin, a stolen coin purse clutched to its chest, a hooked little knife, too many mismatched rings. |
| `wolf.png` | 1–3 | A lean grey wolf, head and forequarters: hackles raised, a torn ear, bared fangs, pale hungry eyes, breath steaming in the cold. |
| `goblin-chieftain.png` | 1–3, Mini-boss | A goblin chieftain, grander than a goblin: a scarred brute with a crown of teeth and bent nails over a spiked iron helm, a necklace of trophies, a heavy notched cleaver on the shoulder. |
| `zombie.png` | 4–6 | A shambling zombie: grey rotting skin, a slack jaw, crude stitches across the face, torn burial clothes, clouded empty eyes. |
| `ghoul.png` | 4–6 | A ghoul: emaciated and hunched, grey skin tight over the skull, a long tongue, cracked claws raised, a sickly green glint in its eyes. |
| `wraith.png` | 4–6 | A wraith: a hooded shape of torn black shroud with no face, only two cold blue points of light, wisps of shadow drifting off its edges. |
| `bone-knight.png` | 4–6, Mini-boss | A bone knight, grander than a skeleton: a skeleton in a rusted great helm and cracked plate armor, a tattered crimson tabard, a notched longsword, a dull red glow in its eye sockets. |
| `cultist.png` | 7–9 | A cultist: a hooded robe of faded crimson, a cracked bone mask over the upper face, a curved ritual dagger, drips of candle wax on the knuckles. |
| `hellhound.png` | 7–9 | A hellhound, head and forequarters: a black-furred hound with cracked, ember-lit skin, smoke pouring from its nostrils, glowing orange eyes, burning drool. |
| `demon-brute.png` | 7–9 | A demon brute: a massive horned demon with grey-red hide, a broken tusk, a scarred brow, heavy chains wrapped around two huge fists. |
| `horned-tyrant.png` | 7–9, Mini-boss | A horned tyrant, grander than the other demons: a demon lord with a crown of curling black horns, a scarred face, burning eyes that make you look away, a black iron collar and a torn mantle. |
| `kobold.png` | 10 | A kobold: a small reptilian with rust-red scales, a snout full of little teeth, a crude spear and a shield made from one old dragon scale. |
| `drake.png` | 10 | A drake: a wingless young dragon, head and neck, bronze-black scales, a long toothy snout, smoke curling from its jaws, amber eyes. |
| `doppelganger.png` | any (the false prisoner) | A doppelganger: a pale, half-finished face caught between two people, eyes too wide, grey featureless skin at the edges, a torn prisoner's shirt and a broken shackle at the throat. |
| `mimic.png` | any (the chest that bites) | A mimic: a wooden treasure chest seen from the front, its lid a mouth of jagged teeth, a long purple tongue, rusted iron bands, small yellow eyes along the lid. |

## Batch 2: six new monsters

Added on 2026-09-28 for more variety where every Hero is early in the Season: four in the goblin warrens and two in the crypts. Same style block, same steps; save them in `art/monsters/` as before ([codex-12](../tasks/codex-12-new-monster-tokens.md)).

| File | Floors | Prompt |
|---|---|---|
| `goblin-sapper.png` | 1–3 | A goblin sapper: a soot-blackened face, singed eyebrows and a manic grin, goggles pushed up on its forehead, a round iron bomb with a lit, sparking fuse clutched to its chest. |
| `goblin-shaman.png` | 1–3 | A goblin shaman: small bones and feathers braided into wild hair, white stripes painted across the face, a staff topped with a rat skull, a faint green glow of healing magic in one raised hand. |
| `bat-swarm.png` | 1–3 | A swarm of bats: a dense cloud of dozens of small black bats with tiny red eyes and bared fangs, their wings overlapping into one shape that fills the circle. |
| `giant-spider.png` | 1–3 | A giant spider, head and front legs: a black bristly body, a cluster of eight glinting red eyes, dripping green-tinged fangs, strands of web catching the light. |
| `grave-robber.png` | 4–6 | A grave robber: a gaunt human in a hooded cloak with a scarf over the mouth, a dirt-stained shovel over one shoulder, a stolen gold locket in the other hand, wary eyes. |
| `banshee.png` | 4–6 | A banshee: the pale, translucent spirit of a woman with long drifting white hair and hollow eyes, her mouth wide open in a scream, a tattered grey burial veil trailing into mist. |

## Batch 3: five monsters for the crypts and the depths

Added on 2026-09-29 so the deeper Floors don't repeat themselves: two in the crypts and three in the depths. Same style block, same steps; save them in `art/monsters/` as before ([codex-13](../tasks/codex-13-deep-monster-tokens.md)).

| File | Floors | Prompt |
|---|---|---|
| `mummy.png` | 4–6 | A mummy: a withered face half-wrapped in rotting, yellowed linen bandages, one dead eye glowing faint green through a gap, a tarnished brass burial collar, dust sifting from its wrappings. |
| `rot-grubs.png` | 4–6 | A heap of rot grubs: dozens of fat, pale, segmented maggots writhing together into one mound that fills the circle, tiny dark mouths, a wet sheen, an old bone half buried among them. |
| `flame-skull.png` | 7–9 | A flame skull: a cracked human skull floating in a crown of dull orange fire, flames pouring from its eye sockets and trailing behind it, the jaw hanging open in a grin. |
| `night-hag.png` | 7–9 | A night hag: a hunched crone with blue-black skin, long matted black hair, a hooked nose and broken teeth, yellow eyes that stare straight through you, a clawed hand clutching a small glowing gem. |
| `chain-devil.png` | 7–9 | A chain devil: a tall devil wrapped head to toe in rusted, hooked chains that coil around it like snakes, a scarred grey face between the links, burning eyes, loose chain ends swinging with hooks. |
