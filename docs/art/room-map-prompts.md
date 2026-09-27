# Room maps: image prompts

Every Room in the Labyrinth shows a battle map seen from above, and fights play out on it. Each Floor theme has one map today, so a Player sees the same room again and again. These 27 prompts give the warrens, the crypts and the depths 7 more each, and the Dragon's lair 6 of its own (it borrows the demons' map now). The style is the look test's: [design.md → Look and feel](../design.md#look-and-feel), with the three approved Rooms in `apps/web/public/art/rooms/` (sources `art/look-test/room-*.png`).

Each Room turns and mirrors its map its own way (`apps/web/src/screens/labyrinth/roomArt.ts`), so one picture gives eight looks. That is why every map must work at any rotation: the same doorway in the middle of each of the four walls, even lighting, and nothing that only reads one way up.

## How to use

1. Use **one chat or one image-generation session** for all 27, so the style stays consistent.
2. Send the **style block** first, then the **framing block**, then the prompts in order. Each theme's first prompt sets that theme for the rest.
3. If a map drifts, reply: *"Closer to the style of the first maps: heavier ink lines, more muted colors, the middle of the floor clear."*
4. Save each as PNG under the file name given, in `art/rooms/`. Square, as generated (1024 × 1024 or larger).

## Style block (send first)

```
For every image in this chat, use one consistent art style: a dark fantasy ink illustration with a gothic comic-book feel. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture on aged parchment. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red, tarnished brass and sickly green. High contrast. No text, letters, numbers, logos, interface elements or watermarks anywhere in any image. Reply "Ready" and wait for my first request.
```

## Framing block (send second)

```
Every image from now on is one dungeon room seen from directly above, like a tabletop RPG battle map. Square (1:1). Exactly one open doorway in the middle of each of the four walls (top, bottom, left, right). No creatures, characters or bodies standing up. Keep the middle of the floor clear so game pieces can stand on it: put furniture and features along the walls and in the corners. Light the room evenly, with no single light direction, because the map will be shown turned and mirrored. Reply "Ready".
```

## The goblin warrens (Floors 1–3)

- `goblins-2.png`: A goblin mess hall: long crude plank tables pushed against the walls, a soot-black cauldron in one corner, spilled stew, gnawed bones and broken bowls on a packed-earth floor.
- `goblins-3.png`: A damp cave where a shallow underground stream runs along one wall, stepping stones, clusters of pale fungus in the corners, a rotting rope and plank walkway.
- `goblins-4.png`: A beast pen: rusted iron cages along the walls, trampled straw, chains bolted to the rock, chewed bones, claw marks on the cage bars.
- `goblins-5.png`: A goblin armory: racks of crude spears and dented shields along the walls, a grinding wheel, heaps of scrap metal and arrows in the corners.
- `goblins-6.png`: A mushroom grotto: giant pale mushrooms growing from the corners, faint sickly-green glowing spores, soft mud floor, a fallen log.
- `goblins-7.png`: A chieftain's trophy hall: skulls on stakes along the walls, a crude bone throne in one corner, torn banners, a fire pit ringed with stones near a wall.
- `goblins-8.png`: A collapsed mine crossing: timber supports, iron rails crossing the floor, a broken mine cart in a corner, rubble heaped against the walls.

## The undead crypts (Floors 4–6)

- `crypt-2.png`: An ossuary: walls lined floor to ceiling with skulls and stacked long bones in niches, a cracked stone floor, dust.
- `crypt-3.png`: A half-flooded crypt: shallow black water pooled along the walls, stone coffins half sunk, floating candle stubs, a dry raised walkway through the middle.
- `crypt-4.png`: An embalming chamber: stone slabs against the walls, clay jars, hanging hooks, stained linen wrappings, a drain in the floor.
- `crypt-5.png`: A noble's tomb: a large carved sarcophagus in one corner, iron braziers burning with cold green flame in the others, tattered banners on the walls.
- `crypt-6.png`: A graveyard grown inside the crypt: dead trees pushing up through cracked flagstones, twisted roots along the walls, leaning gravestones in the corners.
- `crypt-7.png`: A bell chamber: a huge cracked bronze bell fallen into one corner, snapped ropes, rubble, cobwebs across the walls.
- `crypt-8.png`: A catacomb crossing: rows of narrow burial niches in every wall, a skeletal hand hanging from one, heavy cobwebs, bone dust on the floor.

## The demon-touched depths (Floors 7–9)

- `demons-2.png`: A sacrificial hall: a black stone altar against one wall, blood channels cut into the floor running to a drain, rows of melted black candles.
- `demons-3.png`: A lava rift: a glowing river of magma along one wall, jagged basalt columns in the corners, drifts of grey ash on the floor.
- `demons-4.png`: A torment chamber: chains and meat hooks hanging from the walls, iron cages in the corners, glowing embers in a brazier.
- `demons-5.png`: A broken summoning chamber: a shattered ritual circle scratched into the obsidian floor, cracked red crystal pylons in the four corners, scorch marks.
- `demons-6.png`: A bone forge: an anvil and a furnace burning with red fire against one wall, piles of bones and iron scraps, tongs and hammers on hooks.
- `demons-7.png`: A corrupted chamber: dark red fleshy growths creeping over the walls, thick veins crossing the stone floor toward the corners, a sickly glow.
- `demons-8.png`: A hall of fallen idols: broken statues of horned demons in the corners, cracked pillars, sulfur smoke pooling low.

## The Dragon's lair (Floor 10)

- `lair-1.png`: A vast cave floor strewn with gold coins, goblets and gems swept against the walls, scorched and blackened rock.
- `lair-2.png`: A nest: huge cracked eggshells in the corners, ash and cinders, the bones of large beasts, deep claw marks in the stone.
- `lair-3.png`: A kobold shrine to the Dragon: a crude dragon idol in one corner, offerings of coins and candles, painted scale patterns on the walls.
- `lair-4.png`: A scorched hall: melted armor and weapons fused into the floor along the walls, walls blackened by fire, a few embers still glowing.
- `lair-5.png`: A crystal cavern: clusters of deep red crystal growing from the walls and corners, a heat shimmer, a smooth dark rock floor.
- `lair-6.png`: A bone yard: a gigantic ribcage arching along one wall, a huge horned skull in a corner, scattered swords and shields of fallen heroes.
