# Hero portraits: 28 image prompts

Season 0 wants **2 portraits for each Race × Class pair** (32 in total). The look test already made one each for the Human Fighter, Elf Wizard, Halfling Rogue and Dwarf Cleric, so 28 are left. Use the same tool and style as the look test ([look-test-prompts.md](look-test-prompts.md)).

## How to use

1. Use one chat for the whole batch. Send the **style block** first.
2. Send each prompt below. Every prompt already repeats the framing, so none depends on the one before.
3. Save each result as PNG in `art/portraits/` under the file name shown, e.g. `elf-fighter-1.png`.
4. Tell Claude when they're in. Claude shrinks them for phones and adds them to the game.

Each pair is split into one masculine-leaning and one feminine-leaning portrait, with varied ages, so a party of friends doesn't look like one family.

## Style block

```
For every image in this chat: a hero portrait for a round game token in a dark fantasy ink illustration with a gothic comic-book feel. Heavy black ink linework, deep shadows, rough cross-hatching, visible brush texture. A muted, desaturated palette: charcoal, bone white, cold stone grey and faded sepia, with small touches of dried-blood red, tarnished brass and sickly green. Head and shoulders, facing the viewer, face centered and readable at small sizes, with face and essential silhouette inside a central circle so it can be cropped round. Square 1:1. Genuinely transparent background; if unavailable, solid pure black. No scenery, no frame, no text, letters, numbers or watermarks. Any magical marks are abstract shapes, never writing. Reply "Ready" and wait.
```

## Prompts

| File | Prompt |
|---|---|
| `human-fighter-2.png` | A human Fighter woman in her forties: short grey-streaked hair, a broken nose, a steel gorget over a padded gambeson, a scar through one eyebrow, steady eyes. |
| `human-rogue-1.png` | A young human Rogue man: a smirk, a dark hood half down, a scarf over the chin, leather straps, a thin knife held near the collarbone. |
| `human-rogue-2.png` | A human Rogue woman: a sharp face, hair braided tight, a feathered cap tilted low, a high leather collar, a coin between two fingers. |
| `human-wizard-1.png` | An old human Wizard man: a long white beard, deep-set eyes, a heavy hood with frayed embroidery, faint cold light glowing at his fingertips. |
| `human-wizard-2.png` | A human Wizard woman: dark hair pinned with bone needles, ink stains on her cheek, a high-collared robe, a small floating abstract rune of light. |
| `human-cleric-1.png` | A human Cleric man: a shaved head, a burn scar on one side of the face, chainmail, a sun holy symbol on a cord, a calm stare. |
| `human-cleric-2.png` | A human Cleric woman: a white veil over dark hair, a tired and kind face, a chain coif, a brass sun symbol at her throat. |
| `elf-fighter-1.png` | An elf Fighter man: long silver hair tied back, high cheekbones, an ornate but dented leaf-shaped pauldron, a cold, proud look. |
| `elf-fighter-2.png` | An elf Fighter woman: a short black undercut, pointed ears with iron rings, a scale-armor collar, a thin scar across the lips. |
| `elf-rogue-1.png` | An elf Rogue woman: a deep green hood, narrow watchful eyes, a leather mask pulled down to the chin, an arrow fletching over one shoulder. |
| `elf-rogue-2.png` | An elf Rogue man: messy copper hair, a sly half smile, a dark cloak clasped with a raven brooch, a dagger hilt at the shoulder. |
| `elf-wizard-2.png` | An elf Wizard man: a shaved head covered in faint abstract tattoos, pale eyes, a heavy dark mantle, cold blue light under his chin. |
| `elf-cleric-1.png` | An elf Cleric woman: long pale braids, a silver circlet, a white-and-grey vestment, a moon-and-sun holy symbol, serene eyes. |
| `elf-cleric-2.png` | An elf Cleric man: an ancient, lined face, hair like dry straw, a hood of undyed wool, holding a small lantern of holy light. |
| `dwarf-fighter-1.png` | A dwarf Fighter man: a huge red-black beard in thick braids, a horned iron helm, a broken tooth, an axe haft over the shoulder. |
| `dwarf-fighter-2.png` | A dwarf Fighter woman: braided auburn hair and short braided sideburns, a riveted steel breastplate, soot on her face, a fierce grin. |
| `dwarf-rogue-1.png` | A dwarf Rogue man: a trimmed black beard with a single gold bead, a flat cap, a leather apron full of lockpicks, suspicious eyes. |
| `dwarf-rogue-2.png` | A dwarf Rogue woman: two thick braids, a soot-dark hood, goggles pushed up on the forehead, a small crossbow over one shoulder. |
| `dwarf-wizard-1.png` | A dwarf Wizard man: a long white beard tucked into his belt, round spectacles, a runed leather cap, a glowing abstract sigil over one palm. |
| `dwarf-wizard-2.png` | A dwarf Wizard woman: grey hair in a heavy bun, a stern face, a fur-trimmed robe, faint amber light in her eyes. |
| `dwarf-cleric-2.png` | A dwarf Cleric woman: braids bound with iron rings, a round face, chainmail, a warhammer head beside her cheek, a brass sun on her chest. |
| `halfling-fighter-1.png` | A halfling Fighter man: curly brown hair, freckles, a battered too-big helmet, a small round shield strapped to his back, a brave frown. |
| `halfling-fighter-2.png` | A halfling Fighter woman: short red curls, a split lip, a padded jack with steel plates, a short sword hilt over the shoulder. |
| `halfling-rogue-2.png` | A halfling Rogue woman: a wide mischievous grin, a patched hood, a necklace of stolen keys, one eyebrow raised. |
| `halfling-wizard-1.png` | A halfling Wizard man: a round face, big curious eyes, a floppy pointed hat, a pipe, a tiny abstract spark floating over his hand. |
| `halfling-wizard-2.png` | A halfling Wizard woman: a messy bun with a pencil through it, ink-stained fingers, a patched robe, faint blue light reflected on her cheeks. |
| `halfling-cleric-1.png` | A halfling Cleric man: gentle old eyes, a bald head, a brown friar's hood, a wooden holy symbol, a soft half smile. |
| `halfling-cleric-2.png` | A halfling Cleric woman: rosy cheeks, curly grey hair, a white apron over mail, a small sun symbol, a determined look. |

## Batch 2: Barbarians and Rangers (16 prompts)

The Barbarian and the Ranger joined mid-Season 0. Until these are in, they borrow the Fighter's and the Rogue's portraits for the same Race (engine `portraitsFor`). Use the same style block as above, in a new chat if the old one has drifted. Once the files are in `art/portraits/`, Claude adds `barbarian` and `ranger` to `CLASSES_PAINTED` in `packages/engine/src/content/portraits.ts`.

| File | Prompt |
|---|---|
| `human-barbarian-1.png` | A human Barbarian man: wild black hair and a braided beard, a wolf pelt over bare scarred shoulders, blue-grey war paint across the eyes, a greataxe haft over one shoulder, a snarl. |
| `human-barbarian-2.png` | A human Barbarian woman in her thirties: a shaved head with one long braid, a bear-fur mantle, a bone necklace, a fresh cut on the cheek, eyes burning with fury. |
| `human-ranger-1.png` | A human Ranger man: a weathered face, a short beard, a mossy green hood, a longbow string across the chest, quiet watchful eyes. |
| `human-ranger-2.png` | A human Ranger woman: windswept brown hair, a leather hood lined with fur, a quiver strap, a hawk feather tied in her hair, a steady aim in her gaze. |
| `elf-barbarian-1.png` | An elf Barbarian woman: white hair in wild locks, pointed ears with bone rings, ritual scars on the cheekbones, a stag-antler pauldron, a fierce, feral stare. |
| `elf-barbarian-2.png` | An elf Barbarian man: long copper hair knotted with feathers, red war paint across the mouth, a lynx pelt on the shoulders, bared teeth. |
| `elf-ranger-1.png` | An elf Ranger man: a lean face, silver hair tied back, a dark leaf-patterned cloak, an arrow held between two fingers near the chin, calm eyes. |
| `elf-ranger-2.png` | An elf Ranger woman: a deep hood of moss green, pale eyes, a thin braid over one shoulder, a longbow's curve behind her head. |
| `dwarf-barbarian-1.png` | A dwarf Barbarian man: a wild red beard with iron clasps, a bare chest under a boar-hide mantle, a head wound bandaged with cloth, roaring. |
| `dwarf-barbarian-2.png` | A dwarf Barbarian woman: thick black braids, war paint in white stripes, a bearskin hood with the bear's jaws above her brow, a maul handle over the shoulder. |
| `dwarf-ranger-1.png` | A dwarf Ranger man: a grey beard tucked into a scarf, a wide-brimmed leather hat, a crossbow over the shoulder, a pipe, sharp squinting eyes. |
| `dwarf-ranger-2.png` | A dwarf Ranger woman: auburn braids under a fur cap, a quiver of short arrows, a raven feather in the cap, a patient, hunter's look. |
| `halfling-barbarian-1.png` | A halfling Barbarian man: curly black hair full of burrs, a badger pelt as a hood, a gap-toothed battle grin, a hand axe raised beside the face. |
| `halfling-barbarian-2.png` | A halfling Barbarian woman: wild blond curls, freckles under smeared red war paint, a fox-fur collar, a tiny notched greataxe blade behind her head. |
| `halfling-ranger-1.png` | A halfling Ranger woman: a green hooded cloak, a round freckled face, a sling and a short bow, a sparrow perched on her shoulder. |
| `halfling-ranger-2.png` | A halfling Ranger man: a brown felt hood, a trimmed moustache, a quiver of fletched arrows, keen eyes looking just past the viewer. |
