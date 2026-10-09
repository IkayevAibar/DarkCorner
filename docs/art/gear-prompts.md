# Gear types: 44 image prompts, and 15 for the stackables

Every Item used to show as a flat game-icons.net silhouette in its Tier frame, unless it was a named unique with its own painting. The owner chose (2026-10-10) to paint **every gear type** in the same ink style, so a sword, a helm or a ring in the Bag is a picture, not a symbol. A gear type's painting shows for every Item of that type, Common to Epic; a named unique's own painting still wins over it ([design.md → Look and feel](../design.md#look-and-feel)).

## How to use

1. Use one chat for the whole batch. Send the **style block** first.
2. Send each prompt below. Every prompt repeats the framing, so none depends on the one before.
3. Save each result as PNG in `art/gear/` under the file name shown, e.g. `longsword.png`.
4. Keep the exact prompts in `art/gear/generation-prompts.json` and the file checks in `art/gear/validation.json`, as for the monster tokens. Claude shrinks them to 256 px WebP under `apps/web/public/art/gear/` and points each base's `art` at its file (`packages/engine/src/content/bases.ts`).

These are **ordinary** Items: plain, well-used workmanship, no glow, no gems that shine. The Tier frame around them carries the color (gray, green, blue, purple), and a named unique's painting carries the magic. Keep each one plainer than any unique, and keep the same angle and scale within a slot, so a row of Bag tiles reads evenly.

## Style block

```
For every image in this chat: a single ordinary fantasy item for a game inventory, in a dark fantasy ink illustration with a gothic comic-book feel, matching a set of named magic items painted in the same style. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red and tarnished brass. Plain, well-used workmanship: no glow, no shining gems, nothing magical. The item alone, centered, seen from a slight angle, filling most of a square 1:1 frame, readable as a small icon at 48 pixels. Weapons diagonal from lower left to upper right. Genuinely transparent background; if unavailable, solid pure black. No hands, no scenery, no frame, no text, letters, numbers or watermarks. Reply "Ready" and wait.
```

## Weapons

| File | Prompt |
|---|---|
| `greatsword.png` | A greatsword: a long, broad two-handed blade with a plain cross guard and a long leather-wrapped grip, a few nicks along the edge. |
| `greataxe.png` | A greataxe: a heavy two-handed axe with a wide, single crescent head of dark iron on a long ash-wood haft bound with iron rings. |
| `maul.png` | A maul: a two-handed warhammer with a squat, blocky iron head and a long thick haft, the striking faces dented from use. |
| `halberd.png` | A halberd: a long polearm topped with an axe blade, a spike and a back hook, the wooden haft scarred and wrapped near the grip. |
| `longsword.png` | A longsword: a straight double-edged blade with a simple cross guard, a leather grip and a round pommel. |
| `saber.png` | A saber: a single-edged, gently curved cavalry blade with a knuckle-guard hilt of blackened steel. |
| `rapier.png` | A rapier: a slender thrusting blade with a swept-hilt guard of curling steel bars and a small round pommel. |
| `dagger.png` | A dagger: a short double-edged blade with a small cross guard and a leather-wrapped grip. |
| `shortbow.png` | A shortbow: a short, sharply curved bow of dark wood with a leather grip, strung. |
| `longbow.png` | A longbow: a tall, gently curved yew bow with a cord-wrapped grip, strung. |
| `crossbow.png` | A crossbow: a heavy crossbow with a wooden stock, a steel bow and a cranking lever, a bolt loaded. |
| `hand-crossbow.png` | A hand crossbow: a small one-handed crossbow with a pistol grip of dark wood, a short steel bow, a bolt loaded. |
| `mace.png` | A mace: a short iron club topped with a flanged head, a leather grip. |
| `warhammer.png` | A warhammer: a one-handed hammer with a square iron head and a short back spike on a wooden haft. |
| `flail.png` | A flail: a wooden handle with a short chain ending in a spiked iron ball. |
| `morningstar.png` | A morningstar: a one-handed club topped with a round iron head studded with long spikes. |
| `staff.png` | A staff: a tall gnarled wooden staff, its top a knot of roots, iron shod at the foot. |
| `wand.png` | A wand: a short, slightly crooked wand of pale wood with a small iron cap at its tip. |

## Off-hands

| File | Prompt |
|---|---|
| `shield.png` | A shield: a round wooden shield with an iron rim and a central iron boss, painted long ago and worn back to the wood. |
| `orb.png` | An orb: a clouded glass sphere in a plain three-pronged iron holder. Cloudy grey inside, not glowing. |
| `holy-symbol.png` | A holy symbol: a disc of worn brass with an abstract sunburst shape, on a short leather cord. |
| `tome.png` | A tome: a thick, closed book in cracked brown leather with iron corners and a simple clasp. |

## Body armor

| File | Prompt |
|---|---|
| `plate.png` | Plate armor: a full breastplate with pauldrons and articulated plates, seen from the front, steel dulled by use. |
| `chainmail.png` | Chain mail: a long shirt of riveted iron rings with short sleeves, seen from the front, hanging as if on a stand. |
| `splint.png` | Splint mail: vertical strips of iron riveted onto a leather backing, with mail at the shoulders, seen from the front. |
| `breastplate.png` | A breastplate: a single shaped steel chest plate with leather straps, seen from the front. |
| `scale.png` | Scale mail: a coat of overlapping iron scales like a fish's, on leather, seen from the front. |
| `half-plate.png` | Half plate: a breastplate with shoulder plates and plated upper arms, the rest left open, seen from the front. |
| `leather.png` | Leather armor: a stiff boiled-leather jerkin with shoulder pieces, seen from the front. |
| `studded.png` | Studded leather: a leather jerkin set with rows of iron studs, seen from the front. |
| `robes.png` | Robes: a long hooded robe of heavy dark cloth with wide sleeves, faint stitched border patterns (abstract shapes, never writing), hanging as if on a stand. |

## Head, hands, feet, neck and rings

| File | Prompt |
|---|---|
| `helm.png` | A helm: a closed iron helm with a visor slit and a short crest ridge, seen from the front at a slight angle. |
| `hood.png` | A hood: a deep hood of rough dark cloth with a short mantle, empty, holding its shape. |
| `circlet.png` | A circlet: a thin band of plain dark silver shaped to sit on a brow, with a small raised point at the front. |
| `gauntlets.png` | Gauntlets: a pair of articulated steel gauntlets with flared cuffs. |
| `gloves.png` | Gloves: a pair of worn leather gloves with laced cuffs. |
| `bracers.png` | Bracers: a pair of hardened leather forearm guards with iron strips, laced closed. |
| `boots.png` | Boots: a pair of tall leather boots with turned-down cuffs, scuffed at the toes. |
| `greaves.png` | Greaves: a pair of steel shin guards with knee cops, on leather straps. |
| `amulet.png` | An amulet: a round pendant of dark brass on a fine chain, a dull polished stone at its center. |
| `talisman.png` | A talisman: a carved bone charm with small knotted cords and a few beads, on a leather thong. |
| `ring.png` | A ring: a plain band of tarnished silver with a small dull stone. |
| `signet.png` | A signet ring: a heavy ring of dark gold with a flat engraved seal (abstract shapes, never letters). |
| `bond-ring.png` | A Bond ring: two interlocked thin rings of pale silver and dark iron, one half of a pair, a faint seam where they were split apart. |

## The stackables (second, after the gear)

Smaller, and grouped by what they are; the same style block, "an ordinary item" still holds. Save them in `art/gear/` too.

| File | Prompt |
|---|---|
| `potion.png` | A healing potion: a round glass flask of red liquid with a cork stopper, a string tied around the neck. |
| `scroll-identify.png` | A scroll of Identify: a rolled parchment tied with a blue cord, the edge of an abstract eye-like symbol showing. |
| `scroll-portal.png` | A Town Portal scroll: a rolled parchment tied with a gold cord, the edge of an abstract doorway symbol showing. |
| `scroll-protection.png` | A Protection scroll: a rolled parchment sealed with a blob of grey wax, the edge of an abstract shield symbol showing. |
| `bomb-fire.png` | A Fire bomb: a round clay pot with a lit, sparking fuse, a wax seal, scorch marks on its side. |
| `bomb-smoke.png` | A Smoke bomb: a dark round clay pot with a short fuse, grey smoke already leaking from a crack. |
| `key-iron.png` | An Iron key: a heavy old iron key with a plain ring bow and a simple bit. |
| `key-silver.png` | A Silver key: an ornate silver key with a looping bow and a toothed bit. |
| `key-gold.png` | A Gold key: a gold key with a bow shaped like a small crown and an intricate bit. |
| `chest-iron.png` | An Iron chest: a small wooden chest bound in iron bands, a heavy iron lock. |
| `chest-silver.png` | A Silver chest: a small chest bound in silver bands with corner plates, a silver lock. |
| `chest-gold.png` | A Gold chest: a small chest bound in gold with ornate corners and a gold lock. |
| `scrap.png` | Scrap: a small pile of bent iron pieces, nails and broken links. |
| `essence.png` | Essence: a small stoppered vial of swirling grey-blue mist. |
| `soulstone.png` | A Soulstone: a dark, faceted crystal with a faint pale wisp trapped inside. |
