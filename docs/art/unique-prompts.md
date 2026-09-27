# Unique Items: 16 image prompts

Legendary, Mythic and Relic Items are named uniques with painted art ([design.md → Look and feel](../design.md#look-and-feel)). The look test made the Dragonbone Blade; these are the other 16 in Season 0. Until an image exists the game shows the base icon, and the Ember Fang borrows the Dragonbone Blade's art.

## How to use

1. Use one chat for the whole batch. Send the **style block** first.
2. Send each prompt below. Every prompt repeats the framing, so none depends on the one before.
3. Save each result as PNG in `art/items/` under the file name shown, e.g. `gravewhisper.png`.
4. Tell Claude when they're in. Claude shrinks them to 256 px and points each unique's `art` at its file (`packages/engine/src/content/loot.ts`).

The brighter the Tier, the more the Item may glow: Legendaries a little, Mythics clearly, Relics most. Everything else stays in the muted ink palette so Tier colors stay the brightest thing on screen.

## Style block

```
For every image in this chat: a single fantasy item for a game inventory, in a dark fantasy ink illustration with a gothic comic-book feel. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red, tarnished brass and sickly green; only the item's own magic may glow. The item alone, centered, seen from a slight angle, filling most of a square 1:1 frame, readable as a small icon. Genuinely transparent background; if unavailable, solid pure black. No hands, no scenery, no frame, no text, letters, numbers or watermarks. Any runes or magical marks are abstract shapes, never writing. Reply "Ready" and wait.
```

## Prompts

| File | Tier | Prompt |
|---|---|---|
| `ember-fang.png` | Legendary | A longsword called the Ember Fang: a black steel blade with a molten orange edge like cooling lava, a crossguard shaped like a dragon's jaw, a grip wrapped in charred leather, faint embers drifting off it. |
| `gravewhisper.png` | Legendary | A dagger called Gravewhisper: a thin, slightly curved bone-white blade, a hilt of blackened silver shaped like a hooded mourner, a wisp of pale green mist curling from the tip. |
| `oathbreaker.png` | Legendary | A greataxe called the Oathbreaker: a huge notched iron head split by a jagged crack, a broken chain wrapped around the haft, dried blood in the notches, a faint red glow inside the crack. |
| `hollow-crown.png` | Legendary | A helm called the Hollow Crown: a crown-shaped iron helm with nothing inside but darkness, tall broken points, two small cold-white lights where eyes would be. |
| `ashen-aegis.png` | Legendary | A shield called the Ashen Aegis: a round kite shield of grey ash-colored steel, its face cracked like burned wood, a brass boss in the center with faint embers glowing in the cracks. |
| `wardens-longbow.png` | Legendary | A longbow called the Warden's Longbow: tall dark yew with antler tips, a string that glints faintly silver, a quiver strap of worn leather with a single grey feather tied to it. |
| `lantern-of-the-deep.png` | Legendary | An orb called the Lantern of the Deep: a glass sphere caged in tarnished brass bands, holding a cold blue-green flame that lights the metal from inside. |
| `saints-knuckle.png` | Legendary | A holy symbol called the Saint's Knuckle: a finger bone in a small reliquary of worn gold and glass, hung on a chain of iron links, a soft warm light inside the glass. |
| `wyrmfire.png` | Mythic | A greatsword called Wyrmfire: a wide blade that looks forged from a dragon's rib, flames licking along both edges, a hilt of black scales, a large red gem in the pommel glowing bright. |
| `last-ember.png` | Mythic | A staff called the Last Ember: a gnarled black staff whose top is split open around a single floating coal, burning white-hot at its heart and orange at the edges. |
| `deathless-mail.png` | Mythic | A suit of plate armor called the Deathless Mail: a dark, heavily scarred breastplate and pauldrons, riveted bone plates over the steel, a faint pale-green light seeping from the joints. |
| `luckstone.png` | Mythic | A ring called the Luckstone: a thick band of worn gold holding a smooth black stone with a single bright golden fleck that seems to move, a faint golden shimmer around it. |
| `drowned-crown.png` | Mythic | A crown called the Crown of the Drowned King: a heavy crown of green-tarnished bronze tangled with dark seaweed and barnacles, pearls dull as dead eyes, water dripping from its points. |
| `phylactery.png` | Relic | An amulet called the Lich's Phylactery: a small ornate box of black iron and bone on a chain, a crack in its lid leaking cold violet light, abstract rune shapes around the edge. |
| `eye-of-the-abyss.png` | Relic | An orb called the Eye of the Abyss: a black sphere with a single slit-pupil eye of burning amber inside it, held in claws of dark iron, thin shadows curling off it like smoke. |
| `first-kings-crown.png` | Relic | A crown called the Crown of the First King: a simple ancient crown of dull gold, dented and scratched by centuries, set with one great uncut stone that glows warm and bright. |
