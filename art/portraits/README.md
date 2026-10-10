# Season 0 Hero portrait gallery

92 source portraits generated with the built-in image_gen tool from [the portrait brief](../../docs/art/portrait-prompts.md). Together with the four existing look-test portraits, these cover two portraits for every Race × Class pair across all twelve Classes. Brief 24 adds 64 sources for Barbarian, Ranger, Paladin, Warlock, Monk, Druid, Bard and Sorcerer.

All selected files are 1254 × 1254 PNGs with alpha transparency. [Exact generation prompts](generation-prompts.json) and [file validation results](validation.json) are retained. The new 64 were reviewed during generation and in [the round-token and Quick start crop gallery](review.html). Their SHA-256 hashes match the generated originals; no image edits or delivery resizes were applied.

## Integration handoff

Claude: create optimized 256 px delivery assets under `apps/web/public` and register them in the Hero portrait content. Keep these source PNGs unchanged. Check the circular crop on hats, horns, ears and shoulder silhouettes, particularly the Dwarf Fighters.

## Gallery

Click a preview to open its source. Validation checks cover manifest count, PNG decoding, dimensions, and sampled alpha values. Some generated edge pixels have alpha 1/255; preserve originals and assess those edges during delivery optimization.

### Human

| Preview | File |
|---|---|
| [<img src="human-fighter-2.png" width="128" alt="Human Fighter 2">](human-fighter-2.png) | [human-fighter-2.png](human-fighter-2.png) |
| [<img src="human-rogue-1.png" width="128" alt="Human Rogue 1">](human-rogue-1.png) | [human-rogue-1.png](human-rogue-1.png) |
| [<img src="human-rogue-2.png" width="128" alt="Human Rogue 2">](human-rogue-2.png) | [human-rogue-2.png](human-rogue-2.png) |
| [<img src="human-wizard-1.png" width="128" alt="Human Wizard 1">](human-wizard-1.png) | [human-wizard-1.png](human-wizard-1.png) |
| [<img src="human-wizard-2.png" width="128" alt="Human Wizard 2">](human-wizard-2.png) | [human-wizard-2.png](human-wizard-2.png) |
| [<img src="human-cleric-1.png" width="128" alt="Human Cleric 1">](human-cleric-1.png) | [human-cleric-1.png](human-cleric-1.png) |
| [<img src="human-cleric-2.png" width="128" alt="Human Cleric 2">](human-cleric-2.png) | [human-cleric-2.png](human-cleric-2.png) |

### Elf

| Preview | File |
|---|---|
| [<img src="elf-fighter-1.png" width="128" alt="Elf Fighter 1">](elf-fighter-1.png) | [elf-fighter-1.png](elf-fighter-1.png) |
| [<img src="elf-fighter-2.png" width="128" alt="Elf Fighter 2">](elf-fighter-2.png) | [elf-fighter-2.png](elf-fighter-2.png) |
| [<img src="elf-rogue-1.png" width="128" alt="Elf Rogue 1">](elf-rogue-1.png) | [elf-rogue-1.png](elf-rogue-1.png) |
| [<img src="elf-rogue-2.png" width="128" alt="Elf Rogue 2">](elf-rogue-2.png) | [elf-rogue-2.png](elf-rogue-2.png) |
| [<img src="elf-wizard-2.png" width="128" alt="Elf Wizard 2">](elf-wizard-2.png) | [elf-wizard-2.png](elf-wizard-2.png) |
| [<img src="elf-cleric-1.png" width="128" alt="Elf Cleric 1">](elf-cleric-1.png) | [elf-cleric-1.png](elf-cleric-1.png) |
| [<img src="elf-cleric-2.png" width="128" alt="Elf Cleric 2">](elf-cleric-2.png) | [elf-cleric-2.png](elf-cleric-2.png) |

### Dwarf

| Preview | File |
|---|---|
| [<img src="dwarf-fighter-1.png" width="128" alt="Dwarf Fighter 1">](dwarf-fighter-1.png) | [dwarf-fighter-1.png](dwarf-fighter-1.png) |
| [<img src="dwarf-fighter-2.png" width="128" alt="Dwarf Fighter 2">](dwarf-fighter-2.png) | [dwarf-fighter-2.png](dwarf-fighter-2.png) |
| [<img src="dwarf-rogue-1.png" width="128" alt="Dwarf Rogue 1">](dwarf-rogue-1.png) | [dwarf-rogue-1.png](dwarf-rogue-1.png) |
| [<img src="dwarf-rogue-2.png" width="128" alt="Dwarf Rogue 2">](dwarf-rogue-2.png) | [dwarf-rogue-2.png](dwarf-rogue-2.png) |
| [<img src="dwarf-wizard-1.png" width="128" alt="Dwarf Wizard 1">](dwarf-wizard-1.png) | [dwarf-wizard-1.png](dwarf-wizard-1.png) |
| [<img src="dwarf-wizard-2.png" width="128" alt="Dwarf Wizard 2">](dwarf-wizard-2.png) | [dwarf-wizard-2.png](dwarf-wizard-2.png) |
| [<img src="dwarf-cleric-2.png" width="128" alt="Dwarf Cleric 2">](dwarf-cleric-2.png) | [dwarf-cleric-2.png](dwarf-cleric-2.png) |

### Halfling

| Preview | File |
|---|---|
| [<img src="halfling-fighter-1.png" width="128" alt="Halfling Fighter 1">](halfling-fighter-1.png) | [halfling-fighter-1.png](halfling-fighter-1.png) |
| [<img src="halfling-fighter-2.png" width="128" alt="Halfling Fighter 2">](halfling-fighter-2.png) | [halfling-fighter-2.png](halfling-fighter-2.png) |
| [<img src="halfling-rogue-2.png" width="128" alt="Halfling Rogue 2">](halfling-rogue-2.png) | [halfling-rogue-2.png](halfling-rogue-2.png) |
| [<img src="halfling-wizard-1.png" width="128" alt="Halfling Wizard 1">](halfling-wizard-1.png) | [halfling-wizard-1.png](halfling-wizard-1.png) |
| [<img src="halfling-wizard-2.png" width="128" alt="Halfling Wizard 2">](halfling-wizard-2.png) | [halfling-wizard-2.png](halfling-wizard-2.png) |
| [<img src="halfling-cleric-1.png" width="128" alt="Halfling Cleric 1">](halfling-cleric-1.png) | [halfling-cleric-1.png](halfling-cleric-1.png) |
| [<img src="halfling-cleric-2.png" width="128" alt="Halfling Cleric 2">](halfling-cleric-2.png) | [halfling-cleric-2.png](halfling-cleric-2.png) |

## Brief 24 — eight more Classes

[48 px, 160 px and Quick start crop review](review.html). Each Class has two portraits for Human, Elf, Dwarf and Halfling. The four original look-test callings appear beside every Class for palette and silhouette comparison.

Claude: convert these 64 to 256 px WebP and add all eight Classes to `CLASSES_PAINTED`; source-only work here, with no runtime or contract edits.

### Barbarian

| Preview | Source |
|---|---|
| [<img src="human-barbarian-1.png" width="128" alt="Human Barbarian 1">](human-barbarian-1.png) | [human-barbarian-1.png](human-barbarian-1.png) |
| [<img src="human-barbarian-2.png" width="128" alt="Human Barbarian 2">](human-barbarian-2.png) | [human-barbarian-2.png](human-barbarian-2.png) |
| [<img src="elf-barbarian-1.png" width="128" alt="Elf Barbarian 1">](elf-barbarian-1.png) | [elf-barbarian-1.png](elf-barbarian-1.png) |
| [<img src="elf-barbarian-2.png" width="128" alt="Elf Barbarian 2">](elf-barbarian-2.png) | [elf-barbarian-2.png](elf-barbarian-2.png) |
| [<img src="dwarf-barbarian-1.png" width="128" alt="Dwarf Barbarian 1">](dwarf-barbarian-1.png) | [dwarf-barbarian-1.png](dwarf-barbarian-1.png) |
| [<img src="dwarf-barbarian-2.png" width="128" alt="Dwarf Barbarian 2">](dwarf-barbarian-2.png) | [dwarf-barbarian-2.png](dwarf-barbarian-2.png) |
| [<img src="halfling-barbarian-1.png" width="128" alt="Halfling Barbarian 1">](halfling-barbarian-1.png) | [halfling-barbarian-1.png](halfling-barbarian-1.png) |
| [<img src="halfling-barbarian-2.png" width="128" alt="Halfling Barbarian 2">](halfling-barbarian-2.png) | [halfling-barbarian-2.png](halfling-barbarian-2.png) |

### Ranger

| Preview | Source |
|---|---|
| [<img src="human-ranger-1.png" width="128" alt="Human Ranger 1">](human-ranger-1.png) | [human-ranger-1.png](human-ranger-1.png) |
| [<img src="human-ranger-2.png" width="128" alt="Human Ranger 2">](human-ranger-2.png) | [human-ranger-2.png](human-ranger-2.png) |
| [<img src="elf-ranger-1.png" width="128" alt="Elf Ranger 1">](elf-ranger-1.png) | [elf-ranger-1.png](elf-ranger-1.png) |
| [<img src="elf-ranger-2.png" width="128" alt="Elf Ranger 2">](elf-ranger-2.png) | [elf-ranger-2.png](elf-ranger-2.png) |
| [<img src="dwarf-ranger-1.png" width="128" alt="Dwarf Ranger 1">](dwarf-ranger-1.png) | [dwarf-ranger-1.png](dwarf-ranger-1.png) |
| [<img src="dwarf-ranger-2.png" width="128" alt="Dwarf Ranger 2">](dwarf-ranger-2.png) | [dwarf-ranger-2.png](dwarf-ranger-2.png) |
| [<img src="halfling-ranger-1.png" width="128" alt="Halfling Ranger 1">](halfling-ranger-1.png) | [halfling-ranger-1.png](halfling-ranger-1.png) |
| [<img src="halfling-ranger-2.png" width="128" alt="Halfling Ranger 2">](halfling-ranger-2.png) | [halfling-ranger-2.png](halfling-ranger-2.png) |

### Paladin

| Preview | Source |
|---|---|
| [<img src="human-paladin-1.png" width="128" alt="Human Paladin 1">](human-paladin-1.png) | [human-paladin-1.png](human-paladin-1.png) |
| [<img src="human-paladin-2.png" width="128" alt="Human Paladin 2">](human-paladin-2.png) | [human-paladin-2.png](human-paladin-2.png) |
| [<img src="elf-paladin-1.png" width="128" alt="Elf Paladin 1">](elf-paladin-1.png) | [elf-paladin-1.png](elf-paladin-1.png) |
| [<img src="elf-paladin-2.png" width="128" alt="Elf Paladin 2">](elf-paladin-2.png) | [elf-paladin-2.png](elf-paladin-2.png) |
| [<img src="dwarf-paladin-1.png" width="128" alt="Dwarf Paladin 1">](dwarf-paladin-1.png) | [dwarf-paladin-1.png](dwarf-paladin-1.png) |
| [<img src="dwarf-paladin-2.png" width="128" alt="Dwarf Paladin 2">](dwarf-paladin-2.png) | [dwarf-paladin-2.png](dwarf-paladin-2.png) |
| [<img src="halfling-paladin-1.png" width="128" alt="Halfling Paladin 1">](halfling-paladin-1.png) | [halfling-paladin-1.png](halfling-paladin-1.png) |
| [<img src="halfling-paladin-2.png" width="128" alt="Halfling Paladin 2">](halfling-paladin-2.png) | [halfling-paladin-2.png](halfling-paladin-2.png) |

### Warlock

| Preview | Source |
|---|---|
| [<img src="human-warlock-1.png" width="128" alt="Human Warlock 1">](human-warlock-1.png) | [human-warlock-1.png](human-warlock-1.png) |
| [<img src="human-warlock-2.png" width="128" alt="Human Warlock 2">](human-warlock-2.png) | [human-warlock-2.png](human-warlock-2.png) |
| [<img src="elf-warlock-1.png" width="128" alt="Elf Warlock 1">](elf-warlock-1.png) | [elf-warlock-1.png](elf-warlock-1.png) |
| [<img src="elf-warlock-2.png" width="128" alt="Elf Warlock 2">](elf-warlock-2.png) | [elf-warlock-2.png](elf-warlock-2.png) |
| [<img src="dwarf-warlock-1.png" width="128" alt="Dwarf Warlock 1">](dwarf-warlock-1.png) | [dwarf-warlock-1.png](dwarf-warlock-1.png) |
| [<img src="dwarf-warlock-2.png" width="128" alt="Dwarf Warlock 2">](dwarf-warlock-2.png) | [dwarf-warlock-2.png](dwarf-warlock-2.png) |
| [<img src="halfling-warlock-1.png" width="128" alt="Halfling Warlock 1">](halfling-warlock-1.png) | [halfling-warlock-1.png](halfling-warlock-1.png) |
| [<img src="halfling-warlock-2.png" width="128" alt="Halfling Warlock 2">](halfling-warlock-2.png) | [halfling-warlock-2.png](halfling-warlock-2.png) |

### Monk

| Preview | Source |
|---|---|
| [<img src="human-monk-1.png" width="128" alt="Human Monk 1">](human-monk-1.png) | [human-monk-1.png](human-monk-1.png) |
| [<img src="human-monk-2.png" width="128" alt="Human Monk 2">](human-monk-2.png) | [human-monk-2.png](human-monk-2.png) |
| [<img src="elf-monk-1.png" width="128" alt="Elf Monk 1">](elf-monk-1.png) | [elf-monk-1.png](elf-monk-1.png) |
| [<img src="elf-monk-2.png" width="128" alt="Elf Monk 2">](elf-monk-2.png) | [elf-monk-2.png](elf-monk-2.png) |
| [<img src="dwarf-monk-1.png" width="128" alt="Dwarf Monk 1">](dwarf-monk-1.png) | [dwarf-monk-1.png](dwarf-monk-1.png) |
| [<img src="dwarf-monk-2.png" width="128" alt="Dwarf Monk 2">](dwarf-monk-2.png) | [dwarf-monk-2.png](dwarf-monk-2.png) |
| [<img src="halfling-monk-1.png" width="128" alt="Halfling Monk 1">](halfling-monk-1.png) | [halfling-monk-1.png](halfling-monk-1.png) |
| [<img src="halfling-monk-2.png" width="128" alt="Halfling Monk 2">](halfling-monk-2.png) | [halfling-monk-2.png](halfling-monk-2.png) |

### Druid

| Preview | Source |
|---|---|
| [<img src="human-druid-1.png" width="128" alt="Human Druid 1">](human-druid-1.png) | [human-druid-1.png](human-druid-1.png) |
| [<img src="human-druid-2.png" width="128" alt="Human Druid 2">](human-druid-2.png) | [human-druid-2.png](human-druid-2.png) |
| [<img src="elf-druid-1.png" width="128" alt="Elf Druid 1">](elf-druid-1.png) | [elf-druid-1.png](elf-druid-1.png) |
| [<img src="elf-druid-2.png" width="128" alt="Elf Druid 2">](elf-druid-2.png) | [elf-druid-2.png](elf-druid-2.png) |
| [<img src="dwarf-druid-1.png" width="128" alt="Dwarf Druid 1">](dwarf-druid-1.png) | [dwarf-druid-1.png](dwarf-druid-1.png) |
| [<img src="dwarf-druid-2.png" width="128" alt="Dwarf Druid 2">](dwarf-druid-2.png) | [dwarf-druid-2.png](dwarf-druid-2.png) |
| [<img src="halfling-druid-1.png" width="128" alt="Halfling Druid 1">](halfling-druid-1.png) | [halfling-druid-1.png](halfling-druid-1.png) |
| [<img src="halfling-druid-2.png" width="128" alt="Halfling Druid 2">](halfling-druid-2.png) | [halfling-druid-2.png](halfling-druid-2.png) |

### Bard

| Preview | Source |
|---|---|
| [<img src="human-bard-1.png" width="128" alt="Human Bard 1">](human-bard-1.png) | [human-bard-1.png](human-bard-1.png) |
| [<img src="human-bard-2.png" width="128" alt="Human Bard 2">](human-bard-2.png) | [human-bard-2.png](human-bard-2.png) |
| [<img src="elf-bard-1.png" width="128" alt="Elf Bard 1">](elf-bard-1.png) | [elf-bard-1.png](elf-bard-1.png) |
| [<img src="elf-bard-2.png" width="128" alt="Elf Bard 2">](elf-bard-2.png) | [elf-bard-2.png](elf-bard-2.png) |
| [<img src="dwarf-bard-1.png" width="128" alt="Dwarf Bard 1">](dwarf-bard-1.png) | [dwarf-bard-1.png](dwarf-bard-1.png) |
| [<img src="dwarf-bard-2.png" width="128" alt="Dwarf Bard 2">](dwarf-bard-2.png) | [dwarf-bard-2.png](dwarf-bard-2.png) |
| [<img src="halfling-bard-1.png" width="128" alt="Halfling Bard 1">](halfling-bard-1.png) | [halfling-bard-1.png](halfling-bard-1.png) |
| [<img src="halfling-bard-2.png" width="128" alt="Halfling Bard 2">](halfling-bard-2.png) | [halfling-bard-2.png](halfling-bard-2.png) |

### Sorcerer

| Preview | Source |
|---|---|
| [<img src="human-sorcerer-1.png" width="128" alt="Human Sorcerer 1">](human-sorcerer-1.png) | [human-sorcerer-1.png](human-sorcerer-1.png) |
| [<img src="human-sorcerer-2.png" width="128" alt="Human Sorcerer 2">](human-sorcerer-2.png) | [human-sorcerer-2.png](human-sorcerer-2.png) |
| [<img src="elf-sorcerer-1.png" width="128" alt="Elf Sorcerer 1">](elf-sorcerer-1.png) | [elf-sorcerer-1.png](elf-sorcerer-1.png) |
| [<img src="elf-sorcerer-2.png" width="128" alt="Elf Sorcerer 2">](elf-sorcerer-2.png) | [elf-sorcerer-2.png](elf-sorcerer-2.png) |
| [<img src="dwarf-sorcerer-1.png" width="128" alt="Dwarf Sorcerer 1">](dwarf-sorcerer-1.png) | [dwarf-sorcerer-1.png](dwarf-sorcerer-1.png) |
| [<img src="dwarf-sorcerer-2.png" width="128" alt="Dwarf Sorcerer 2">](dwarf-sorcerer-2.png) | [dwarf-sorcerer-2.png](dwarf-sorcerer-2.png) |
| [<img src="halfling-sorcerer-1.png" width="128" alt="Halfling Sorcerer 1">](halfling-sorcerer-1.png) | [halfling-sorcerer-1.png](halfling-sorcerer-1.png) |
| [<img src="halfling-sorcerer-2.png" width="128" alt="Halfling Sorcerer 2">](halfling-sorcerer-2.png) | [halfling-sorcerer-2.png](halfling-sorcerer-2.png) |
