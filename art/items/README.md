# Season 0 unique Item gallery

16 source Item images generated with the built-in image_gen tool from [the unique Item brief](../../docs/art/unique-prompts.md): eight Legendary, five Mythic and three Relic images. Dragonbone Blade already has look-test art and is outside this batch.

All selected files are 1254 × 1254 PNGs with alpha transparency. [Exact generation prompts and the Ember Fang refinement](generation-prompts.json) and [file validation results](validation.json) are retained. Ember Fang was reframed to preserve its full silhouette; the earlier tight composition is preserved in [drafts](drafts/ember-fang-tight.png) and is not a delivery asset.

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
