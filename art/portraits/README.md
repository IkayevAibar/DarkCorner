# Season 0 Hero portrait gallery

28 source portraits generated with the built-in image_gen tool from [the portrait brief](../../docs/art/portrait-prompts.md). Together with the four existing look-test portraits, these cover two portraits per Race × Class pair.

All selected files are 1254 × 1254 PNGs with alpha transparency. [Exact generation prompts](generation-prompts.json) and [file validation results](validation.json) are retained. Images were reviewed during generation; in-game circular crops and small-size readability still need review after optimization.

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
