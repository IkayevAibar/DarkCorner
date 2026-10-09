# Armory source paintings

44 ordinary gear types and 15 stackable Items for [Codex task 23](https://github.com/IkayevAibar/DarkCorner/blob/55e2bb1/docs/tasks/codex-23-armory-art.md), generated individually with the built-in image_gen tool. Subjects follow [the gear prompt brief](https://github.com/IkayevAibar/DarkCorner/blob/55e2bb1/docs/art/gear-prompts.md). The 13 new unique paintings live beside the existing uniques in [art/items](../items/README.md).

All source PNGs are 1254 × 1254 and retain their generated pixels and transparent alpha. The 59 selected sources total **86.1 MiB**. [Exact submitted prompts](generation-prompts.json) and [dimensions, alpha, bounds, bytes and SHA-256](validation.json) accompany the sources.

Holy Symbol and Leather Armor include isolated corner alpha values of 1/255. These near-transparent pixels are preserved in the originals, as in earlier art batches; review them when making delivery copies.

## Review

[Interactive Bag and Item-size gallery](armory-review.html) · [375 px Bag](review/armory-phone.png) · [Large source inspection](review/armory-detail-phone.png) · [Browser validation](review/armory-browser-validation.json)

The standalone HTML review copies ItemChip.tsx's 62 px Bag and 84 px Item-sheet tiles: a 2 px Tier-colored border, the actual Tier colors and radial background, and 96% object-contain art. It also opens a larger source inspection when an Item is tapped. It is a source-art mockup, not an application screen or runtime integration.

![Mixed-Tier Bag at 375 px](review/armory-phone.png)

Weapons share a grip/butt-to-point diagonal from lower left to upper right. Metal, leather and cloth stay muted and nonmagical; the Tier frame supplies color. Wide armor and smaller jewelry intentionally fill more area than long weapons, while their slot peers keep comparable framing. At 62 px, scratches, chain links and rivets become texture. The gallery includes four existing uniques as palette references.

All 59 paintings were reviewed at 62 and 84 px. Scrolls retain different cords and seals; Keys differ by material and bow shape; the three Chests share a view while their bands and decoration distinguish them. The Fire Bomb received one framing revision to keep its lit fuse and sparks inside the canvas. Its exact edit prompt is recorded. No required second pass remains. Fine seal symbols and engraving are clearer in the larger inspection than in a Bag tile; no Tier-frame adjustment was needed for these sources.

Chrome decoded every displayed image, checked the 62/84 px frames, found no horizontal overflow at 375 px, and opened and closed the larger inspection. Application tests were not run: only source art and review files change; the first-load bundle is unchanged.

## Gear gallery

| Item | Source |
|---|---|
| Greatsword · Двуручный меч | [<img src="greatsword.png" width="128" alt="Greatsword · Двуручный меч">](greatsword.png) |
| Greataxe · Секира | [<img src="greataxe.png" width="128" alt="Greataxe · Секира">](greataxe.png) |
| Maul · Двуручный молот | [<img src="maul.png" width="128" alt="Maul · Двуручный молот">](maul.png) |
| Halberd · Алебарда | [<img src="halberd.png" width="128" alt="Halberd · Алебарда">](halberd.png) |
| Longsword · Длинный меч | [<img src="longsword.png" width="128" alt="Longsword · Длинный меч">](longsword.png) |
| Saber · Сабля | [<img src="saber.png" width="128" alt="Saber · Сабля">](saber.png) |
| Rapier · Рапира | [<img src="rapier.png" width="128" alt="Rapier · Рапира">](rapier.png) |
| Dagger · Кинжал | [<img src="dagger.png" width="128" alt="Dagger · Кинжал">](dagger.png) |
| Shortbow · Короткий лук | [<img src="shortbow.png" width="128" alt="Shortbow · Короткий лук">](shortbow.png) |
| Longbow · Длинный лук | [<img src="longbow.png" width="128" alt="Longbow · Длинный лук">](longbow.png) |
| Crossbow · Арбалет | [<img src="crossbow.png" width="128" alt="Crossbow · Арбалет">](crossbow.png) |
| Hand crossbow · Ручной арбалет | [<img src="hand-crossbow.png" width="128" alt="Hand crossbow · Ручной арбалет">](hand-crossbow.png) |
| Mace · Булава | [<img src="mace.png" width="128" alt="Mace · Булава">](mace.png) |
| Warhammer · Боевой молот | [<img src="warhammer.png" width="128" alt="Warhammer · Боевой молот">](warhammer.png) |
| Flail · Цеп | [<img src="flail.png" width="128" alt="Flail · Цеп">](flail.png) |
| Morningstar · Моргенштерн | [<img src="morningstar.png" width="128" alt="Morningstar · Моргенштерн">](morningstar.png) |
| Staff · Посох | [<img src="staff.png" width="128" alt="Staff · Посох">](staff.png) |
| Wand · Жезл | [<img src="wand.png" width="128" alt="Wand · Жезл">](wand.png) |
| Shield · Щит | [<img src="shield.png" width="128" alt="Shield · Щит">](shield.png) |
| Orb · Сфера | [<img src="orb.png" width="128" alt="Orb · Сфера">](orb.png) |
| Holy symbol · Священный символ | [<img src="holy-symbol.png" width="128" alt="Holy symbol · Священный символ">](holy-symbol.png) |
| Tome · Фолиант | [<img src="tome.png" width="128" alt="Tome · Фолиант">](tome.png) |
| Plate armor · Латы | [<img src="plate.png" width="128" alt="Plate armor · Латы">](plate.png) |
| Chain mail · Кольчуга | [<img src="chainmail.png" width="128" alt="Chain mail · Кольчуга">](chainmail.png) |
| Splint mail · Наборный доспех | [<img src="splint.png" width="128" alt="Splint mail · Наборный доспех">](splint.png) |
| Breastplate · Кираса | [<img src="breastplate.png" width="128" alt="Breastplate · Кираса">](breastplate.png) |
| Scale mail · Чешуйчатый доспех | [<img src="scale.png" width="128" alt="Scale mail · Чешуйчатый доспех">](scale.png) |
| Half plate · Полулаты | [<img src="half-plate.png" width="128" alt="Half plate · Полулаты">](half-plate.png) |
| Leather armor · Кожаный доспех | [<img src="leather.png" width="128" alt="Leather armor · Кожаный доспех">](leather.png) |
| Studded leather · Проклёпанная кожа | [<img src="studded.png" width="128" alt="Studded leather · Проклёпанная кожа">](studded.png) |
| Robes · Мантия | [<img src="robes.png" width="128" alt="Robes · Мантия">](robes.png) |
| Helm · Шлем | [<img src="helm.png" width="128" alt="Helm · Шлем">](helm.png) |
| Hood · Капюшон | [<img src="hood.png" width="128" alt="Hood · Капюшон">](hood.png) |
| Circlet · Венец | [<img src="circlet.png" width="128" alt="Circlet · Венец">](circlet.png) |
| Gauntlets · Латные перчатки | [<img src="gauntlets.png" width="128" alt="Gauntlets · Латные перчатки">](gauntlets.png) |
| Gloves · Перчатки | [<img src="gloves.png" width="128" alt="Gloves · Перчатки">](gloves.png) |
| Bracers · Наручи | [<img src="bracers.png" width="128" alt="Bracers · Наручи">](bracers.png) |
| Boots · Сапоги | [<img src="boots.png" width="128" alt="Boots · Сапоги">](boots.png) |
| Greaves · Поножи | [<img src="greaves.png" width="128" alt="Greaves · Поножи">](greaves.png) |
| Amulet · Амулет | [<img src="amulet.png" width="128" alt="Amulet · Амулет">](amulet.png) |
| Talisman · Талисман | [<img src="talisman.png" width="128" alt="Talisman · Талисман">](talisman.png) |
| Ring · Кольцо | [<img src="ring.png" width="128" alt="Ring · Кольцо">](ring.png) |
| Signet ring · Перстень-печатка | [<img src="signet.png" width="128" alt="Signet ring · Перстень-печатка">](signet.png) |
| Bond ring · Кольцо уз | [<img src="bond-ring.png" width="128" alt="Bond ring · Кольцо уз">](bond-ring.png) |

## Stackables gallery

| Item | Source |
|---|---|
| Healing potion · Зелье лечения | [<img src="potion.png" width="128" alt="Healing potion · Зелье лечения">](potion.png) |
| Scroll of Identify · Свиток опознания | [<img src="scroll-identify.png" width="128" alt="Scroll of Identify · Свиток опознания">](scroll-identify.png) |
| Town Portal scroll · Свиток портала в город | [<img src="scroll-portal.png" width="128" alt="Town Portal scroll · Свиток портала в город">](scroll-portal.png) |
| Protection scroll · Свиток защиты | [<img src="scroll-protection.png" width="128" alt="Protection scroll · Свиток защиты">](scroll-protection.png) |
| Fire bomb · Огненная бомба | [<img src="bomb-fire.png" width="128" alt="Fire bomb · Огненная бомба">](bomb-fire.png) |
| Smoke bomb · Дымовая бомба | [<img src="bomb-smoke.png" width="128" alt="Smoke bomb · Дымовая бомба">](bomb-smoke.png) |
| Iron key · Железный ключ | [<img src="key-iron.png" width="128" alt="Iron key · Железный ключ">](key-iron.png) |
| Silver key · Серебряный ключ | [<img src="key-silver.png" width="128" alt="Silver key · Серебряный ключ">](key-silver.png) |
| Gold key · Золотой ключ | [<img src="key-gold.png" width="128" alt="Gold key · Золотой ключ">](key-gold.png) |
| Iron chest · Железный сундук | [<img src="chest-iron.png" width="128" alt="Iron chest · Железный сундук">](chest-iron.png) |
| Silver chest · Серебряный сундук | [<img src="chest-silver.png" width="128" alt="Silver chest · Серебряный сундук">](chest-silver.png) |
| Gold chest · Золотой сундук | [<img src="chest-gold.png" width="128" alt="Gold chest · Золотой сундук">](chest-gold.png) |
| Scrap · Лом | [<img src="scrap.png" width="128" alt="Scrap · Лом">](scrap.png) |
| Essence · Эссенция | [<img src="essence.png" width="128" alt="Essence · Эссенция">](essence.png) |
| Soulstone · Камень душ | [<img src="soulstone.png" width="128" alt="Soulstone · Камень душ">](soulstone.png) |

## Claude handoff

Make 256 px WebP delivery copies in apps/web/public/art/gear/ and set art on each matching base in BASES. Preserve these PNGs. The briefs and content were read from claude/armory 55e2bb1, while this art branch starts from main. Check the compressed delivery copies in the Bag, Shops, Market and loot screens. No apps/ or packages/ files change here.
