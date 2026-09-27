# Icons and sounds to download (needs the owner's OK)

The plan's week 4 asks the owner to approve two downloads before Claude fetches anything. Every file name below was checked against the [game-icons.net repository](https://github.com/game-icons/icons) on 2026-09-27.

## Icons: game-icons.net

- **License:** Creative Commons BY 3.0. The game must credit the authors, e.g. on the account sheet and in the README: *Icons by Lorc, Delapouite and Willdabeast from game-icons.net, CC BY 3.0.*
- **What happens after the OK:** Claude downloads these SVGs from `https://raw.githubusercontent.com/game-icons/icons/master/<file>`, keeps only their paths, and swaps them into `apps/web/src/components/items/icons.ts` (the hand-drawn stand-ins from the look test). About 1 KB each.

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
- **What happens after the OK:** Claude downloads the two zips from kenney.nl, picks about 20 sounds, converts them to small `.ogg`/`.mp3` files under `apps/web/public/sfx/`, and lists each choice here. Howler.js plays them (Codex's scenes call one `play(sound)` function).

Reveal sounds that grow with each Tier (a Mythic should sound nothing like a Common) may need a second pack later; that can wait for the test season.
