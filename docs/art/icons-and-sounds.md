# Icons and sounds

The owner approved both downloads on 2026-09-27, and they are in the game. Credits are on the account sheet (Account → Credits) and in the README.

## Icons: game-icons.net

- **License:** Creative Commons BY 3.0. The game must credit the authors, e.g. on the account sheet and in the README: *Icons by Lorc, Delapouite and Willdabeast from game-icons.net, CC BY 3.0.*
- **Where they are:** `apps/web/src/components/items/icons.ts` (Items) and `apps/web/src/components/buildingIcons.ts` (Buildings), built from the SVGs at `https://raw.githubusercontent.com/game-icons/icons/master/<file>`. Only the path data is kept, on the icons' own 512×512 viewBox, with numbers rounded to one decimal: 25 KB for the Items (about 11 KB gzipped) and 7 KB for the Buildings. To add one, download its SVG and copy the `d` of its second `<path>` (the first is the black background).

| Game icon key | File |
|---|---|
| `sword` | `lorc/broadsword.svg` |
| `axe` | `lorc/battle-axe.svg` |
| `dagger` | `lorc/plain-dagger.svg` |
| `bow` | `lorc/pocket-bow.svg` |
| `staff` | `lorc/wizard-staff.svg` |
| `mace` | `lorc/spiked-mace.svg` |
| `shield` | `willdabeast/round-shield.svg` |
| `orb` | `lorc/crystal-ball.svg` |
| `holy-symbol` | `lorc/holy-symbol.svg` |
| `helm` | `lorc/visored-helm.svg` |
| `hood` | `lorc/hood.svg` |
| `armor` | `lorc/breastplate.svg` |
| `robes` | `lorc/robe.svg` |
| `gloves` | `delapouite/gauntlet.svg` |
| `boots` | `lorc/leather-boot.svg` |
| `ring` | `delapouite/ring.svg` |
| `amulet` | `lorc/gem-pendant.svg` |
| `potion` | `lorc/potion-ball.svg` |
| `scroll` | `lorc/scroll-unfurled.svg` |
| `chest` | `lorc/locked-chest.svg` |
| `key` | `lorc/key.svg` |
| `scrap` | `lorc/metal-bar.svg` |
| `essence` | `lorc/magic-swirl.svg` |
| `soulstone` | `delapouite/soul-vessel.svg` |

City buildings, for the cards now and Codex's map pins later:

| Building | File |
|---|---|
| Shops | `delapouite/shop.svg` |
| Forge | `lorc/anvil-impact.svg` |
| Market | `lorc/scales.svg` |
| Temple | `delapouite/church.svg` |
| Labyrinth gate | `delapouite/dungeon-gate.svg` |
| Tavern | `delapouite/tavern-sign.svg` |

## Sounds: Kenney (CC0)

- **License:** Creative Commons CC0: no credit required (a thank-you in the README is still nice).
- **Packs:**
  - [RPG Audio](https://kenney.nl/assets/rpg-audio): 50 sounds: footsteps, doors, metal and weapon hits, coins, books. For Doors, fights, the Forge and gold.
  - [Casino Audio](https://kenney.nl/assets/casino-audio): 50 sounds, including dice. For the d20s, the goblin gambler and the Chest Spin.
- **Where they are:** `apps/web/public/sfx/*.ogg`, as the packs ship them (Safari plays OGG from iOS 18.4 and macOS 15.4; older Safari stays silent). `apps/web/src/sound.ts` loads each file the first time it plays, and every scene calls `play(sound)` or `playTier(tier)`. The account sheet turns sound and vibration off.

| Sound | Files | From | Plays when |
|---|---|---|---|
| `door` | door-1, door-2 | RPG: doorOpen_1, doorOpen_2 | a Door opens; the gate (slower) |
| `creak` | creak | RPG: creak1 | a cracked wall or a locked Door; an Upgrade that drops a level |
| `step` | step-1, step-2 | RPG: footstep00, footstep03 | the stairs, walking out |
| `draw` | draw | RPG: drawKnife1 | a fight starts |
| `hit` | hit-1…3 | RPG: knifeSlice, knifeSlice2, chop | a blow lands |
| `miss` | miss | RPG: cloth1 | a blow misses; a failed Upgrade |
| `crit` | crit | RPG: metalPot2 | a critical hit, a blocked blow (higher), Mythic reveals (lower) |
| `grave` | grave | RPG: doorClose_4 | the Hero dies; an Item is destroyed at the Forge |
| `anvil` | anvil | RPG: metalPot1 | every Forge action |
| `die` | die-1, die-2 | Casino: die-throw-1, die-throw-3 | Death saves, Checks, the goblin's duel |
| `dice` | dice | Casino: dice-throw-1 | rolling ability scores |
| `shake` | shake | Casino: dice-shake-1 | betting with the Goblin gambler |
| `coins` | coins-1, coins-2 | RPG: handleCoins, handleCoins2 | gold changes hands; a won fight |
| `chips` | chips | Casino: chips-stack-1 | a level up, a successful Upgrade, Epic-and-up reveals |
| `loot` | loot | RPG: dropLeather | Common and Uncommon drops, a monster falls |
| `latch` | latch | RPG: metalLatch | a Chest or cache opens, a lock is picked |
| `tick` | tick-1, tick-2 | Casino: chip-lay-1, chip-lay-2 | each Item passing the needle in the Chest Spin |
| `reveal` | reveal | Casino: cards-pack-open-1 | Rare-and-up reveals, Reforge, Blessings |
| `page` | page | RPG: bookFlip2 | a Town Portal scroll, a Listing, a saved Upgrade |
| `equip` | equip | RPG: beltHandle1 | equipping gear; rising from Death saves |

`playTier` layers them so a reveal grows with the Tier: Common and Uncommon rustle, Rare adds the card flourish, Epic adds chips, Legendary adds coins, and Mythic and Relic add a low clang and vibrate on Android.

A real fanfare for Mythics would need a second pack; that can wait for what testers say.
