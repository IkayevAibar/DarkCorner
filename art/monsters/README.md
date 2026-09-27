# Season 0 monster token sources

17 monster illustrations generated with the **built-in image_gen tool** for [Codex task 10](../../docs/tasks/codex-10-monster-tokens.md), using [the monster prompt brief](../../docs/art/monster-token-prompts.md).

All source PNGs are square **1254 × 1254** with alpha transparency, preserved as generated. The selected sources total approximately **41.5 MiB**. There are no discarded variants in this batch.

- [Exact submitted prompts](generation-prompts.json), including the shared style and circular-crop requirements.
- [File validation](validation.json): dimensions, pixel format, corner and sampled alpha, bytes, SHA-256.
- [Browser crop review](token-review.html): open locally at 100% zoom for 48, 64 and 96 px tokens, alongside the four existing references.
- [Crop review screenshot](review/token-crops.png): the same sheet rendered in Chrome at device scale 1.

## Crop review

The review uses the current `Token.tsx` framing: a centered circular crop, full-bleed image, 1.08× zoom, and the existing iron/gold ring colors. All 17 heads or faces remain centered and recognizable at 48 px. The Chieftain's tooth crown, Bone Knight's plate and helm, and Tyrant's horn crown distinguish the three Mini-bosses at larger sizes.

No required second pass was identified. Fine stitches, rings and individual chain links become texture at 48 px; the main faces, equipment shapes and color cues remain distinguishable. Outer ears, horn tips and weapon ends are partly cropped, as in the existing Goblin and Imp tokens. The generated sources preserve those details for larger views.

The Doppelganger interprets the shifting face as a central face with two partial profiles. The source gallery makes that interpretation easy to review before integration.

![All token crops at 48, 64 and 96 pixels](review/token-crops.png)

## Source gallery

Click an image for the unchanged source PNG.

| Monster | Floors | Source |
|---|---|---|
| Giant Rat | 1–3 | [<img src="giant-rat.png" width="128" alt="Giant Rat">](giant-rat.png) |
| Goblin Archer | 1–3 | [<img src="goblin-archer.png" width="128" alt="Goblin Archer">](goblin-archer.png) |
| Goblin Cutpurse | 1–3 | [<img src="goblin-cutpurse.png" width="128" alt="Goblin Cutpurse">](goblin-cutpurse.png) |
| Wolf | 1–3 | [<img src="wolf.png" width="128" alt="Wolf">](wolf.png) |
| Goblin Chieftain | 1–3, Mini-boss | [<img src="goblin-chieftain.png" width="128" alt="Goblin Chieftain">](goblin-chieftain.png) |
| Zombie | 4–6 | [<img src="zombie.png" width="128" alt="Zombie">](zombie.png) |
| Ghoul | 4–6 | [<img src="ghoul.png" width="128" alt="Ghoul">](ghoul.png) |
| Wraith | 4–6 | [<img src="wraith.png" width="128" alt="Wraith">](wraith.png) |
| Bone Knight | 4–6, Mini-boss | [<img src="bone-knight.png" width="128" alt="Bone Knight">](bone-knight.png) |
| Cultist | 7–9 | [<img src="cultist.png" width="128" alt="Cultist">](cultist.png) |
| Hellhound | 7–9 | [<img src="hellhound.png" width="128" alt="Hellhound">](hellhound.png) |
| Demon Brute | 7–9 | [<img src="demon-brute.png" width="128" alt="Demon Brute">](demon-brute.png) |
| Horned Tyrant | 7–9, Mini-boss | [<img src="horned-tyrant.png" width="128" alt="Horned Tyrant">](horned-tyrant.png) |
| Kobold | 10 | [<img src="kobold.png" width="128" alt="Kobold">](kobold.png) |
| Drake | 10 | [<img src="drake.png" width="128" alt="Drake">](drake.png) |
| Doppelganger | any (the false prisoner) | [<img src="doppelganger.png" width="128" alt="Doppelganger">](doppelganger.png) |
| Mimic | any (the chest that bites) | [<img src="mimic.png" width="128" alt="Mimic">](mimic.png) |

## Validation and handoff

All 17 expected filenames match the brief and the monsters with missing art in the base branch. PNG decoding, square dimensions, and sampled transparent/visible pixel checks passed. Some nearly transparent edge pixels have alpha 1/255; the original alpha is retained.

Claude: make the 256 px WebP delivery copies under `apps/web/public/art/tokens/`, set each matching monster's `art`, and check the compressed result in the fight and Encounter views. This branch adds only `art/monsters/`; it makes no changes under `apps/` or `packages/`.
