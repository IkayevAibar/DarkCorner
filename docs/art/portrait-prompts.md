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

## Batch 3: Paladins, Warlocks, Monks, Druids, Bards and Sorcerers (48 prompts)

Six Classes joined on 2026-10-10. Until these are in, they borrow a painted Class's portraits for the same Race (engine `portraitsFor`): Paladins the Fighter's, Monks and Bards the Rogue's, Warlocks and Sorcerers the Wizard's, Druids the Cleric's. Use the same style block as above. Once a Class's eight files are in `art/portraits/`, Claude adds it to `CLASSES_PAINTED` in `packages/engine/src/content/portraits.ts`.

Each Class should read at a glance on a 48 px token: the Paladin's holy armor, the Warlock's eldritch light, the Monk's bare, wrapped hands, the Druid's leaves, fur and antlers, the Bard's instrument and the Sorcerer's magic coming out of the body itself.

| File | Prompt |
|---|---|
| `human-paladin-1.png` | A human Paladin man in his thirties: close-cropped fair hair, a square jaw, dented plate pauldrons, a tabard with an abstract sunburst, a greatsword hilt behind the shoulder, a resolute gaze. |
| `human-paladin-2.png` | A human Paladin woman: dark hair under a winged steel helm with the visor raised, a faint holy light in her eyes, a white cloak clasped with a brass sunburst, a calm, unshakable face. |
| `elf-paladin-1.png` | An elf Paladin woman: long golden hair in a single braid, a silver-chased gorget, a pale blue cloak, an abstract star-shaped holy symbol at her throat, serene and stern. |
| `elf-paladin-2.png` | An elf Paladin man: an ageless lean face, short white hair, leaf-patterned plate, a faint halo of cold light behind his head, eyes closed in prayer. |
| `dwarf-paladin-1.png` | A dwarf Paladin man: a great grey beard bound with gold rings, a heavy plate collar engraved with abstract mountain shapes, a warhammer head beside the cheek, a solemn, fatherly look. |
| `dwarf-paladin-2.png` | A dwarf Paladin woman: red braids under a round steel helm, a soot-streaked face, a shield rim over one shoulder bearing an abstract anvil and sun, a fierce, devout stare. |
| `halfling-paladin-1.png` | A halfling Paladin man: an earnest round face, neat brown curls, a too-big polished breastplate, a small shield with an abstract sun, a proud, brave look. |
| `halfling-paladin-2.png` | A halfling Paladin woman: silver-streaked curls, a chain coif, a white tabard, a lantern of soft holy light held near the face, a gentle but firm smile. |
| `human-warlock-1.png` | A human Warlock man: a gaunt face, hollow eyes with faint violet light, a high-collared black coat, abstract eldritch shapes drifting like smoke near one hand, a thin knowing smile. |
| `human-warlock-2.png` | A human Warlock woman: sharp cheekbones, black hair with one white streak, a dark lace veil pulled back, a pact ring glowing sickly green, a cold stare. |
| `elf-warlock-1.png` | An elf Warlock woman: ashen skin, silver hair, black eyes with pale irises, a mantle of raven feathers, tendrils of shadow curling over one shoulder. |
| `elf-warlock-2.png` | An elf Warlock man: a young, haunted face, long dark hair, thin abstract cracks of violet light across one cheek, a hooded cloak, eyes looking just past the viewer. |
| `dwarf-warlock-1.png` | A dwarf Warlock man: a soot-black beard with ember-red tips, a horned iron mask pushed up on the forehead, faint infernal light in the eyes, a chain of iron hooks around the neck. |
| `dwarf-warlock-2.png` | A dwarf Warlock woman: grey braids, a deep hood, one milky eye glowing faint green, an abstract eldritch shape hovering over her palm, a grim mouth. |
| `halfling-warlock-1.png` | A halfling Warlock man: a sly young face, curly dark hair, a tattered velvet cloak, a tiny shadowy creature peering from behind his shoulder, a violet glint in his eyes. |
| `halfling-warlock-2.png` | A halfling Warlock woman: a pale freckled face, red curls under a dark hood, a small horned skull charm at her throat, faint green flame in one cupped hand, a secretive smile. |
| `human-monk-1.png` | A human Monk man: a shaved head, calm eyes, a plain dark wrap over one shoulder, cloth-wrapped forearms raised in a guard near the chin, a faint scar at the temple. |
| `human-monk-2.png` | A human Monk woman: hair in a tight topknot, a plain grey tunic, wooden prayer beads around the neck, bandaged knuckles, a still, focused face. |
| `elf-monk-1.png` | An elf Monk woman: very short silver hair, a serene face, a sleeveless dark robe, one palm raised in an open-hand stance, faint lines of wind around her fingers. |
| `elf-monk-2.png` | An elf Monk man: long black hair in a low tail, a lean ascetic face, a cloth mask lowered under the chin, a shadowy hood, half the face in deep shadow. |
| `dwarf-monk-1.png` | A dwarf Monk man: a bald head with an abstract painted circle on the brow, a braided beard tucked into a sash, broad shoulders under a rough robe, fists wrapped in cloth. |
| `dwarf-monk-2.png` | A dwarf Monk woman: braids pinned in a crown, a plain brown robe, a quarterstaff across the shoulders, a calm, immovable look. |
| `halfling-monk-1.png` | A halfling Monk man: an old wrinkled face with a wispy white beard, a shaved head, a patched grey robe, one eyebrow raised in amusement. |
| `halfling-monk-2.png` | A halfling Monk woman: a young freckled face, dark hair in two buns, a sash over a plain tunic, wrapped hands in a ready stance, a playful but sharp look. |
| `human-druid-1.png` | A human Druid woman: wild auburn hair woven with twigs and small leaves, a mantle of moss and bark, green eyes, a crow perched on her shoulder. |
| `human-druid-2.png` | A human Druid man: an old weathered face, a long grey beard with beads of wood and bone, an antlered hood, the gnarled top of a staff beside his head. |
| `elf-druid-1.png` | An elf Druid man: long dark hair, abstract leaf-shaped marks on one cheek, a wolf-pelt hood with the wolf's head above his brow, amber eyes. |
| `elf-druid-2.png` | An elf Druid woman: silver hair threaded with ivy, a cloak of feathers, faint green light in her cupped hands, a calm, watchful look. |
| `dwarf-druid-1.png` | A dwarf Druid man: a mossy beard with tiny mushrooms growing in it, a bark-brown leather cap, earthy robes, kind deep-set eyes. |
| `dwarf-druid-2.png` | A dwarf Druid woman: copper braids bound with roots, a bear-claw necklace, a stone amulet with an abstract spiral, a stern, grounded stare. |
| `halfling-druid-1.png` | A halfling Druid woman: curly hair full of small flowers, a leafy green hood, a hedgehog peeking from her collar, a cheerful face. |
| `halfling-druid-2.png` | A halfling Druid man: a round face with a short beard, a hooded cloak of fur and leaves, a small owl on his shoulder, patient eyes. |
| `human-bard-1.png` | A human Bard man: a rakish grin, a thin moustache, a feathered hat tilted back, a lute's neck over the shoulder, a high-collared slashed doublet. |
| `human-bard-2.png` | A human Bard woman: dark curls under a velvet beret, a silver earring, a mocking smile, a wooden flute held near her lips. |
| `elf-bard-1.png` | An elf Bard woman: long platinum hair, a circlet of small silver leaves, an embroidered cloak, the curve of a lyre beside her head, a knowing half smile. |
| `elf-bard-2.png` | An elf Bard man: an elegant face, long dark hair, a high ruffled collar, a fiddle bow held like a rapier, one eyebrow raised. |
| `dwarf-bard-1.png` | A dwarf Bard man: a magnificent braided beard with brass beads, a broad laughing face, a drum strap across the chest, mid-song. |
| `dwarf-bard-2.png` | A dwarf Bard woman: auburn braids, a fur-trimmed cape, a small harp held against her shoulder, a bold, singing mouth. |
| `halfling-bard-1.png` | A halfling Bard man: tousled blond curls, a bright scarf, a mandolin over the shoulder, a cheeky wink. |
| `halfling-bard-2.png` | A halfling Bard woman: a round freckled face, a jaunty hat with a long feather, a tambourine beside her cheek, a teasing grin. |
| `human-sorcerer-1.png` | A young human Sorcerer woman: a fierce face, hair lifting as if in hot wind, faint glowing scale-like patches on her neck, small flames curling from her fingertips. |
| `human-sorcerer-2.png` | A human Sorcerer man: a sharp young face, wild dark hair, crackling abstract arcs of light around one raised hand, one amber eye and one grey. |
| `elf-sorcerer-1.png` | An elf Sorcerer man: pale skin with faintly glowing veins, white hair standing as if charged, a high dark collar, sparks drifting around his head. |
| `elf-sorcerer-2.png` | An elf Sorcerer woman: copper hair, small draconic horn nubs at the temples, golden slit-pupil eyes, embers floating before her face. |
| `dwarf-sorcerer-1.png` | A dwarf Sorcerer man: a black beard singed at the ends, ember-orange cracks of light across one cheek, a heavy fur collar, smoke rising from one fist. |
| `dwarf-sorcerer-2.png` | A dwarf Sorcerer woman: grey braids crackling with tiny sparks, a stern face, faint scales on the brow, a palm cupping a small ball of fire. |
| `halfling-sorcerer-1.png` | A halfling Sorcerer woman: a mischievous face, frizzy hair standing on end with static, a patched robe, a tiny unstable abstract swirl of light over her palm. |
| `halfling-sorcerer-2.png` | A halfling Sorcerer man: a young round face, freckles that glow faintly like embers, a hood thrown back, flame-colored eyes, a surprised half smile. |
