# Season 0 unique Item gallery

29 source Item images across two batches, generated with the built-in image_gen tool from [the unique Item brief](../../docs/art/unique-prompts.md): 15 Legendary, nine Mythic and five Relic images. Dragonbone Blade already has look-test art and is outside this batch.

All selected files are 1254 × 1254 PNGs with alpha transparency. [Exact generation and refinement prompts](generation-prompts.json) and [file validation results](validation.json) are retained. Ember Fang was reframed to preserve its full silhouette; the earlier tight composition is preserved in [drafts](drafts/ember-fang-tight.png) and is not a delivery asset.

## Batch 2: 13 new uniques

Seven Legendary, four Mythic and two Relic Items from the second wave, generated individually with the built-in image_gen tool. Exact prompts and file validation are appended to the existing records. These source PNGs retain their generated pixels and transparent alpha, totaling **21.8 MiB**.

[Interactive review](unique-review-batch-2.html) · [375 px Bag](review/uniques-batch-2-phone.png) · [Large source inspection](review/uniques-batch-2-detail-phone.png) · [Browser validation](review/uniques-batch-2-browser-validation.json)

![The second wave at Bag and Item-sheet size](review/uniques-batch-2-gallery.png)

All 13 paintings were reviewed at 62 px Bag and 84 px Item-sheet size beside four existing uniques, with the actual ItemChip Tier colors and 96% object-contain sizing. Chrome decoded every image, checked frame dimensions, found no horizontal overflow at 375 px, and opened and closed a larger source inspection. This standalone HTML review is a source-art mockup, not an application screen.

Titanfall and The Unwritten Page each received one framing revision so their complete silhouette and glow fit within the canvas. Their exact edit prompts are recorded; the selected outputs are unchanged. No required second pass remains. Quickdraw's second bolt and fine engraving become texture at 62 px; The Unwritten Page's bright, blank glow is intentional for a Relic. Ordinary gear stays visibly plainer beside these Items.

| Item | Source |
|---|---|
| The Quickdraw · Скорострел | [<img src="quickdraw.png" width="128" alt="The Quickdraw · Скорострел">](quickdraw.png) |
| Gravechain · Цепь могильщика | [<img src="gravechain.png" width="128" alt="Gravechain · Цепь могильщика">](gravechain.png) |
| Dawnbringer · Несущий рассвет | [<img src="dawnbringer.png" width="128" alt="Dawnbringer · Несущий рассвет">](dawnbringer.png) |
| The Ember Codex · Кодекс углей | [<img src="ember-codex.png" width="128" alt="The Ember Codex · Кодекс углей">](ember-codex.png) |
| Circlet of Calm · Венец спокойствия | [<img src="circlet-of-calm.png" width="128" alt="Circlet of Calm · Венец спокойствия">](circlet-of-calm.png) |
| Bracers of the Bulwark · Наручи оплота | [<img src="bulwark-bracers.png" width="128" alt="Bracers of the Bulwark · Наручи оплота">](bulwark-bracers.png) |
| Bastion of the Fallen · Оплот павших | [<img src="bastion-plate.png" width="128" alt="Bastion of the Fallen · Оплот павших">](bastion-plate.png) |
| Titanfall · Погибель титанов | [<img src="titanfall.png" width="128" alt="Titanfall · Погибель титанов">](titanfall.png) |
| Greaves of the Long Road · Поножи дальней дороги | [<img src="long-road-greaves.png" width="128" alt="Greaves of the Long Road · Поножи дальней дороги">](long-road-greaves.png) |
| Trollheart · Сердце тролля | [<img src="trollheart.png" width="128" alt="Trollheart · Сердце тролля">](trollheart.png) |
| The Usurper’s Signet · Печать узурпатора | [<img src="usurpers-signet.png" width="128" alt="The Usurper’s Signet · Печать узурпатора">](usurpers-signet.png) |
| Worldbreaker · Сокрушитель миров | [<img src="worldbreaker.png" width="128" alt="Worldbreaker · Сокрушитель миров">](worldbreaker.png) |
| The Unwritten Page · Ненаписанная страница | [<img src="unwritten-page.png" width="128" alt="The Unwritten Page · Ненаписанная страница">](unwritten-page.png) |

Claude: make 256 px WebP delivery copies under apps/web/public/art/items/ and set each matching unique's art in UNIQUES. These are source assets only, so application tests were not run and the first-load bundle is unchanged.

## Integration handoff

Claude: create optimized 256 px delivery assets under `apps/web/public` and set each unique Item's `art` in `packages/engine/src/content/loot.ts`. Keep these source PNGs unchanged. Review readability and glow against the Item card background at actual display size.

## Gallery

Click a preview to open its source. Validation checks cover manifest count, PNG decoding, dimensions, and sampled alpha values. Some generated edge pixels have alpha 1/255; preserve originals and assess those edges during delivery optimization.

### Legendary

| Preview | File |
|---|---|
| [<img src="ember-fang.png" width="128" alt="Ember Fang">](ember-fang.png) | [ember-fang.png](ember-fang.png) |
| [<img src="gravewhisper.png" width="128" alt="Gravewhisper">](gravewhisper.png) | [gravewhisper.png](gravewhisper.png) |
| [<img src="oathbreaker.png" width="128" alt="Oathbreaker">](oathbreaker.png) | [oathbreaker.png](oathbreaker.png) |
| [<img src="hollow-crown.png" width="128" alt="Hollow Crown">](hollow-crown.png) | [hollow-crown.png](hollow-crown.png) |
| [<img src="ashen-aegis.png" width="128" alt="Ashen Aegis">](ashen-aegis.png) | [ashen-aegis.png](ashen-aegis.png) |
| [<img src="wardens-longbow.png" width="128" alt="Wardens Longbow">](wardens-longbow.png) | [wardens-longbow.png](wardens-longbow.png) |
| [<img src="lantern-of-the-deep.png" width="128" alt="Lantern Of The Deep">](lantern-of-the-deep.png) | [lantern-of-the-deep.png](lantern-of-the-deep.png) |
| [<img src="saints-knuckle.png" width="128" alt="Saints Knuckle">](saints-knuckle.png) | [saints-knuckle.png](saints-knuckle.png) |

### Mythic

| Preview | File |
|---|---|
| [<img src="wyrmfire.png" width="128" alt="Wyrmfire">](wyrmfire.png) | [wyrmfire.png](wyrmfire.png) |
| [<img src="last-ember.png" width="128" alt="Last Ember">](last-ember.png) | [last-ember.png](last-ember.png) |
| [<img src="deathless-mail.png" width="128" alt="Deathless Mail">](deathless-mail.png) | [deathless-mail.png](deathless-mail.png) |
| [<img src="luckstone.png" width="128" alt="Luckstone">](luckstone.png) | [luckstone.png](luckstone.png) |
| [<img src="drowned-crown.png" width="128" alt="Drowned Crown">](drowned-crown.png) | [drowned-crown.png](drowned-crown.png) |

### Relic

| Preview | File |
|---|---|
| [<img src="phylactery.png" width="128" alt="Phylactery">](phylactery.png) | [phylactery.png](phylactery.png) |
| [<img src="eye-of-the-abyss.png" width="128" alt="Eye Of The Abyss">](eye-of-the-abyss.png) | [eye-of-the-abyss.png](eye-of-the-abyss.png) |
| [<img src="first-kings-crown.png" width="128" alt="First Kings Crown">](first-kings-crown.png) | [first-kings-crown.png](first-kings-crown.png) |
