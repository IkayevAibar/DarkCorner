# Season 0 monster token sources

50 monster illustrations generated with the **built-in image_gen tool**: 17 for [Codex task 10](../../docs/tasks/codex-10-monster-tokens.md), six for [Codex task 12](../../docs/tasks/codex-12-new-monster-tokens.md), five for [Codex task 13](../../docs/tasks/codex-13-deep-monster-tokens.md), plus 22 for [Codex task 22](https://github.com/IkayevAibar/DarkCorner/blob/90ef613/docs/tasks/codex-22-bestiary-tokens.md), using [the monster prompt brief](../../docs/art/monster-token-prompts.md).

All source PNGs are square **1254 × 1254** with alpha transparency, preserved as generated. The selected sources total approximately **125.7 MiB**. Batches 1 and 2 have no discarded variants; Batch 3 includes two targeted image_gen revisions described below.

- [Exact submitted prompts](generation-prompts.json), including the shared style and circular-crop requirements.
- [File validation](validation.json): dimensions, pixel format, corner and sampled alpha, bytes, SHA-256.
- [Browser crop review](token-review.html): open locally at 100% zoom for 48, 64 and 96 px tokens, alongside the four existing references.
- [Crop review screenshot](review/token-crops.png): the same sheet rendered in Chrome at device scale 1.

## Batch 4: 22 Bestiary portraits

Generated from the Batch 4 subjects in the task 22 brief, with one built-in image_gen call per source and no revisions. All 22 PNGs retain their generated pixels and alpha (1254 × 1254, 56.9 MiB together). Exact submitted prompts are appended to the manifest; dimensions, alpha, visible bounds and SHA-256 are appended to validation.

| Monster | Floors | Source |
|---|---|---|
| Shell beetle · Панцирный жук | 1–3 | [<img src="shell-beetle.png" width="128" alt="Shell beetle · Панцирный жук">](shell-beetle.png) |
| Hobgoblin · Хобгоблин | 2–3 | [<img src="hobgoblin.png" width="128" alt="Hobgoblin · Хобгоблин">](hobgoblin.png) |
| Worg · Варг | 2–3 | [<img src="worg.png" width="128" alt="Worg · Варг">](worg.png) |
| Broodmother · Паучья матка | Floor 2, Mini-boss | [<img src="broodmother.png" width="128" alt="Broodmother · Паучья матка">](broodmother.png) |
| Bugbear · Багбир | Floor 3, Mini-boss | [<img src="bugbear.png" width="128" alt="Bugbear · Багбир">](bugbear.png) |
| Ghost · Привидение | 4–6 | [<img src="ghost.png" width="128" alt="Ghost · Привидение">](ghost.png) |
| Vampire spawn · Вампирское отродье | 4–6 | [<img src="vampire-spawn.png" width="128" alt="Vampire spawn · Вампирское отродье">](vampire-spawn.png) |
| Skeleton archer · Скелет-лучник | 4–6 | [<img src="skeleton-archer.png" width="128" alt="Skeleton archer · Скелет-лучник">](skeleton-archer.png) |
| Gargoyle · Горгулья | 4–6 | [<img src="gargoyle.png" width="128" alt="Gargoyle · Горгулья">](gargoyle.png) |
| Necromancer · Некромант | Floor 5, Mini-boss | [<img src="necromancer.png" width="128" alt="Necromancer · Некромант">](necromancer.png) |
| Vampire lord · Вампир-владыка | Floor 6, Mini-boss | [<img src="vampire-lord.png" width="128" alt="Vampire lord · Вампир-владыка">](vampire-lord.png) |
| Temptress · Искусительница | 7–9 | [<img src="temptress.png" width="128" alt="Temptress · Искусительница">](temptress.png) |
| Bone devil · Костяной дьявол | 8–9 | [<img src="bone-devil.png" width="128" alt="Bone devil · Костяной дьявол">](bone-devil.png) |
| Ember fiend · Огненный изверг | 7–9 | [<img src="ember-fiend.png" width="128" alt="Ember fiend · Огненный изверг">](ember-fiend.png) |
| Shadow · Тень | 7–9 | [<img src="shadow.png" width="128" alt="Shadow · Тень">](shadow.png) |
| Hierophant · Иерофант | Floor 7, Mini-boss | [<img src="hierophant.png" width="128" alt="Hierophant · Иерофант">](hierophant.png) |
| Pit fiend · Исчадие бездны | Floor 9, Mini-boss | [<img src="pit-fiend.png" width="128" alt="Pit fiend · Исчадие бездны">](pit-fiend.png) |
| Kobold shieldbearer · Кобольд-щитоносец | 10 | [<img src="kobold-shieldbearer.png" width="128" alt="Kobold shieldbearer · Кобольд-щитоносец">](kobold-shieldbearer.png) |
| Wyrmling · Дракончик | 10 | [<img src="wyrmling.png" width="128" alt="Wyrmling · Дракончик">](wyrmling.png) |
| Scale-sworn · Чешуйчатый латник | 10 | [<img src="scale-sworn.png" width="128" alt="Scale-sworn · Чешуйчатый латник">](scale-sworn.png) |
| Wyvern · Виверна | 10 | [<img src="wyvern.png" width="128" alt="Wyvern · Виверна">](wyvern.png) |
| Salamander · Саламандра | 10 | [<img src="salamander.png" width="128" alt="Salamander · Саламандра">](salamander.png) |

[Interactive crop review](token-review-batch-4.html) · [Phone-width capture](review/token-crops-batch-4-phone.png) · [Browser validation](review/batch-4-browser-validation.json)

![22 portraits with six existing references at 48, 64 and 96 px](review/token-crops-batch-4.png)

The centered circular crop uses the Token.tsx iron ring and 1.08× zoom. Faces, shield silhouettes, pale undead and burning creatures remain distinct at 48 px. The Shadow is intentionally nearly black: its pale eyes and reaching claw carry its silhouette. The Ember Fiend and Salamander are deliberately brighter, with orange fire. Outer wing and horn tips crop at the ring; faces stay inside. Fine wounds, webs and chains become texture at the smallest size. No required second pass was identified.

Chrome decoded every image and checked all 66 new crop frames at 1280 and 375 px, with no page errors or horizontal overflow. Source filenames match all 22 brief subjects. Application tests were not run: only source art, metadata and review files change, so the first-load bundle is unchanged.

Claude: create the 256 px WebP delivery copies under apps/web/public/art/tokens/, set each matching monster's art in the content, and check the compressed portraits in encounters. The new monster content and briefs were read from claude/armory (55e2bb1, including Bestiary commit 90ef613); the art branch starts from main. No contract, gameplay or application changes are included.

## Batch 3: five monsters for the crypts and the depths

Five sources for [Codex task 13](../../docs/tasks/codex-13-deep-monster-tokens.md), using [Batch 3 of the prompt brief](../../docs/art/monster-token-prompts.md#batch-3-five-monsters-for-the-crypts-and-the-depths) and the original shared style block. Exact generation and revision prompts are in `generation-prompts.json`; dimensions, sampled alpha, bytes and SHA-256 are in `validation.json`.

| Monster | Floors | Source |
|---|---|---|
| Mummy | 4–6 | [<img src="mummy.png" width="128" alt="Mummy">](mummy.png) |
| Rot Grubs | 4–6 | [<img src="rot-grubs.png" width="128" alt="Rot Grubs">](rot-grubs.png) |
| Flame Skull | 7–9 | [<img src="flame-skull.png" width="128" alt="Flame Skull">](flame-skull.png) |
| Night Hag | 7–9 | [<img src="night-hag.png" width="128" alt="Night Hag">](night-hag.png) |
| Chain Devil | 7–9 | [<img src="chain-devil.png" width="128" alt="Chain Devil">](chain-devil.png) |

[Interactive crop review](token-review-batch-3.html) · [Phone-width capture](review/token-crops-batch-3-phone.png) · [Browser validation](review/batch-3-browser-validation.json)

![Five new tokens beside six existing references, at 48, 64 and 96 px](review/token-crops-batch-3.png)

The browser review matches `Token.tsx`: centered circular crop, full bleed, 1.08× zoom, and the iron ring `#4a4038`. At 48 px, the Mummy's diagonal wrappings and green eye, the Rot Grubs' pale segmented mound, the Flame Skull's orange fire silhouette, the Night Hag's dark hair and yellow eyes, and the Chain Devil's bright face between two hooked links remain distinct. Fine grub mouths, scars and jewelry become texture. Outer flame and horn tips crop at the ring, while the faces and identifying features remain inside it.

Two first passes were replaced through image_gen: the Flame Skull initially had an unwanted torso and cloak; its revision isolates a floating skull. The Chain Devil's first pass was too dark at 48 px; its revision enlarges and brightens the face and brings the hooks closer. Only the selected final sources are checked in. They are unchanged copies of the generated PNGs, including their alpha, totaling approximately **11.9 MiB**. No further required second pass was identified. The Flame Skull is deliberately the warmest token; check its fire beside Tier colors when Claude makes the compressed delivery copies.

All five PNGs decode at 1254 × 1254. Browser validation decoded all 33 displayed images, checked 15 new-token crop frames, and found no page errors or horizontal overflow at 375 px. Application tests were not run because this task changes source art and its review files only.

Claude: make the 256 px WebP delivery copies for `mummy`, `rot-grubs`, `flame-skull`, `night-hag` and `chain-devil`, then set their `art` in `packages/engine/src/content/monsters.ts`. This task changes only `art/monsters/`.

## Batch 2: six new monsters

Six sources for [Codex task 12](../../docs/tasks/codex-12-new-monster-tokens.md), generated with the built-in image_gen tool using [Batch 2 of the prompt brief](../../docs/art/monster-token-prompts.md#batch-2-six-new-monsters). The exact expanded prompts are appended to `generation-prompts.json`; dimensions, alpha samples, byte sizes and hashes are appended to `validation.json`. The sources retain their generated pixels and alpha, with no discarded variants or edits in this batch.

| Monster | Floors | Source |
|---|---|---|
| Goblin Sapper | 1–3 | [<img src="goblin-sapper.png" width="128" alt="Goblin Sapper">](goblin-sapper.png) |
| Goblin Shaman | 1–3 | [<img src="goblin-shaman.png" width="128" alt="Goblin Shaman">](goblin-shaman.png) |
| Bat Swarm | 1–3 | [<img src="bat-swarm.png" width="128" alt="Bat Swarm">](bat-swarm.png) |
| Giant Spider | 1–3 | [<img src="giant-spider.png" width="128" alt="Giant Spider">](giant-spider.png) |
| Grave Robber | 4–6 | [<img src="grave-robber.png" width="128" alt="Grave Robber">](grave-robber.png) |
| Banshee | 4–6 | [<img src="banshee.png" width="128" alt="Banshee">](banshee.png) |

[Interactive crop review](token-review-batch-2.html) · [Phone-width capture](review/token-crops-batch-2-phone.png) · [Browser validation](review/batch-2-browser-validation.json)

![Six new tokens beside six existing references, at 48, 64 and 96 px](review/token-crops-batch-2.png)

The crop review follows `Token.tsx`: centered circular crop, 1.08× image zoom, and the iron ring `#4a4038`. All six are recognizable at 48 px. The sapper's fuse, shaman's white face stripes and green hand glow, swarm's repeated wing outlines, spider's eyes and fangs, robber's gold locket and banshee's open screaming mouth survive the crop. At 48 px, individual bats and the locket engraving become texture; 64 and 96 px retain more detail. The banshee is deliberately paler than the other tokens.

All six sources decode at 1254 × 1254 with alpha transparency and total approximately 15.5 MiB. Browser validation decoded all 36 displayed images, checked the 18 new-token crop frames, and found no page errors or horizontal overflow at 375 px. No required second pass was identified; review the final compressed delivery copies in actual encounters.

Claude: make 256 px WebP delivery copies for `goblin-sapper`, `goblin-shaman`, `bat-swarm`, `giant-spider`, `grave-robber` and `banshee`, then set their `art` in `packages/engine/src/content/monsters.ts`. This source-art task changes only `art/monsters/`.


## Batch 1 crop review

The review uses the current `Token.tsx` framing: a centered circular crop, full-bleed image, 1.08× zoom, and the existing iron/gold ring colors. All 17 heads or faces remain centered and recognizable at 48 px. The Chieftain's tooth crown, Bone Knight's plate and helm, and Tyrant's horn crown distinguish the three Mini-bosses at larger sizes.

No required second pass was identified. Fine stitches, rings and individual chain links become texture at 48 px; the main faces, equipment shapes and color cues remain distinguishable. Outer ears, horn tips and weapon ends are partly cropped, as in the existing Goblin and Imp tokens. The generated sources preserve those details for larger views.

The Doppelganger interprets the shifting face as a central face with two partial profiles. The source gallery makes that interpretation easy to review before integration.

![All token crops at 48, 64 and 96 pixels](review/token-crops.png)

## Batch 1 source gallery

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

## Batch 1 validation and handoff

All 17 expected filenames match the brief and the monsters with missing art in the base branch. PNG decoding, square dimensions, and sampled transparent/visible pixel checks passed. Some nearly transparent edge pixels have alpha 1/255; the original alpha is retained.

Claude: make the 256 px WebP delivery copies under `apps/web/public/art/tokens/`, set each matching monster's `art`, and check the compressed result in the fight and Encounter views. This branch adds only `art/monsters/`; it makes no changes under `apps/` or `packages/`.
