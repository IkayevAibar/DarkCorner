# Look test: image prompts for ChatGPT

These 13 images are for the look test: a page that shows the City map, a fight in a Room, Item cards, the Chest Spin and the identify reveal, before any real game code exists. The style is described in [design.md → Look and feel](../design.md#look-and-feel).

## How to use

1. Open **one new ChatGPT chat** for all the images, so the style stays consistent.
2. Send the **style block** first. Then send the prompts one at a time, in order. The City and the first Room set the style for the rest.
3. If an image drifts from the style, reply: *"Closer to the style of the first images: heavier ink lines, more muted colors."*
4. Save each result as PNG, using the file name given, in `D:\browser-game\art\look-test\`.
5. Portraits, monsters and the item need a transparent background. A plain black background is also fine; I'll cut it out.

## Style block (send first)

```
For every image in this chat, use one consistent art style: a dark fantasy ink illustration with a gothic comic-book feel. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture on aged parchment. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red, tarnished brass and sickly green. High contrast. No text, letters, numbers, logos, interface elements or watermarks anywhere in any image. Reply "Ready" and wait for my first request.
```

## 1. The City → `city-map.png`

```
Image 1: the City. A top-down map of a small walled dark-fantasy town, seen from directly above like a hand-inked tabletop RPG map. Portrait orientation (2:3). Include these places, each clearly separated with open ground around it so labels can be added later:
- the Tavern, the largest building, near the center, with warm orange light in its windows
- a Forge with a smoking chimney and an anvil in its yard
- a Market square with covered stalls
- a row of small Shops
- a small Temple with a graveyard behind it
- at the bottom edge, a massive stone gate over a dark pit with stairs going down: the entrance to the Labyrinth
Crooked rooftops, cobblestone streets, a few torches glowing orange, drifting fog, crows. Everything is seen strictly from above.
```

## 2–4. Rooms → `room-goblins.png`, `room-crypt.png`, `room-demons.png`

```
Image 2: one dungeon room, seen from directly above like a tabletop RPG battle map. Square (1:1). A goblin warren: rough cave floor, crude wooden palisades, scattered bones, a small campfire, goblin totems, piles of junk. Exactly one open doorway in the middle of each of the four walls (top, bottom, left, right). No creatures or characters. Keep the middle of the floor fairly clear so game pieces can stand on it.
```

```
Image 3: same framing as image 2 (square, from directly above, one doorway in the middle of each wall, no characters, clear middle of the floor). An undead crypt: cracked flagstones, stone sarcophagi along the walls, melted candles, cobwebs, a collapsed pillar, a faint cold green light.
```

```
Image 4: same framing as image 2. Depths twisted by demons: a black obsidian floor split by glowing red cracks, hanging chains, a ritual circle scratched into the stone, charred bones, heat haze.
```

## 5–8. Hero portraits → `hero-human-fighter.png`, `hero-elf-wizard.png`, `hero-halfling-rogue.png`, `hero-dwarf-cleric.png`

```
Image 5: a hero portrait that will be cropped into a round game token. Head and shoulders, facing the viewer, centered, square (1:1), transparent background (plain black if transparency isn't possible). A human Fighter: a scarred, weathered face, short dark hair, dented steel plate armor with a torn cloak, a grim, determined look.
```

```
Image 6: same framing as image 5. An elf Wizard: long pale hair, sharp features, a dark hooded robe with silver embroidery, faint cold blue glowing runes floating near one hand.
```

```
Image 7: same framing as image 5. A halfling Rogue: small, with a clever grin, hood pulled low, leather armor with many straps and pouches, a dagger held close.
```

```
Image 8: same framing as image 5. A dwarf Cleric: a broad face, a braided grey beard with iron rings, chainmail with a sun-shaped holy symbol on the chest, a warhammer resting on one shoulder.
```

## 9–11. Monsters → `monster-goblin.png`, `monster-skeleton.png`, `monster-imp.png`

```
Image 9: a monster portrait for a round game token, framed like image 5 (head and shoulders, facing the viewer, centered, square, transparent or black background). A goblin: yellow eyes, jagged teeth, a rusty cleaver, patchwork leather.
```

```
Image 10: same framing as image 9. A skeleton warrior: a cracked skull with a faint green light in its eye sockets, a rusted helmet, a broken shield.
```

```
Image 11: same framing as image 9. An imp: a small horned demon with leathery wings, burning orange eyes, a wicked grin.
```

## 12. A Legendary item → `item-dragonbone-blade.png`

```
Image 12: a legendary item illustration. Square (1:1), the item alone, centered, transparent or black background. A longsword called the Dragonbone Blade: a blade carved from pale dragon bone, glowing ember-orange runes along it, a dark leather grip, a claw-shaped crossguard. This is the one image in this chat that may glow brightly.
```

## 13. The Season 0 Boss → `boss-dragon.png`

```
Image 13: the season's final boss, for a large round game token. The head and neck of an ancient dragon, facing the viewer, centered, square (1:1), transparent or black background. Blackened scales, broken horns, smoldering orange eyes, smoke curling from its jaws, old battle scars.
```
