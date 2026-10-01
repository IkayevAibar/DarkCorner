# Dark Corner: Game Design

**Тёмный уголок / Dark Corner** · `dark.ugolok.world`

The owner and Claude agreed on this design in an interview held 2026-09-24 → 2026-09-27. Season 0 opens around **2026-11-06**.
Terms follow [CONTEXT.md](../CONTEXT.md). Numbers tagged *(v0)* are starting values. We simulate them before launch and tune them during Season 0.

## The game

5–15 friends each create a D&D-style Hero, wake up in a dark-fantasy City, and go down into one huge shared Labyrinth. The Hero fights on its own. The Player chooses which doors to open, which fights to take and in what Stance, which gambles to take and when to go home. Loot is everything: it comes in tiers, its stats are rolled at random, it can be traded, and you lose it when you die. The first Player to kill the Season's Boss at the bottom becomes Champion. Three days later everything is wiped and a new Season begins.

Games it borrows from: Darkest Dungeon's town, Slay the Spire's choice of path, Dark and Darker's "you lose what you carry", Hypixel SkyBlock's rarity hype, and CS case openings.

## Pillars

Every feature serves at least one of these:

1. **Loot is king.** About 70% of a Hero's power comes from gear. Every Item is a small lottery ticket: its Tier, Quality, Bonus stats and whether it is Radiant are all rolled.
2. **Luck you can see.** Dice roll on screen, Chests spin, and Items are revealed with a show. Big moments get light, sound and a Broadcast.
3. **Friends, not strangers.** Players are a small approved group from one Discord server. The Labyrinth and the Market are shared, so rivalries are personal.
4. **Fair Seasons.** Stamina limits how much anyone can play per day, so free time doesn't decide the winner. Wipes give everyone a fresh start, and only Glory lasts.

## Players, access and platform

- **Who can play:** 5–15 friends and people they know. Only Players an admin has approved can create a Hero. (The hub lets any Discord account sign in, so approval is the real gate.) An admin can open the gate instead: then everyone who signs in is let in at once, and opening it lets in everyone waiting. Banned Players stay out either way.
- **Sign-in:** through the ugolok.world hub's shared Discord login. The game shows up as a card on the hub dashboard (Hero level, deepest Floor, best Item) and on the hub landing page.
- **Languages:** Russian and English from the first version. The hub passes the language along with `?lang=`.
- **Devices:** designed for a phone held upright first, and comfortable on desktop too. It installs on the home screen and opens full-screen like an app: phones get an offer in the City (dismissible, and always in the profile), with the browser's own Install button where it has one (Chrome, Edge) and the taps where it hasn't (Safari on iPhone).
- **Money:** no real money, ever. No purchases, no donations for perks, no cash-out.
- **Game clock:** Astana time (UTC+5). Players see times in their own time zone.

## Seasons

- **Length:** a Season lasts about 4–6 weeks. It starts with a newly generated Labyrinth and ends with a Wipe.
- **Boss gate:** opens on day 28 *(v0)*. Until then nobody can reach the Boss. A Hero built to beat the Dragon (Fireproof, high armor) can do it at full strength the day the gate opens, so the gate's day sets how long a Season runs: about a month. Season 0 opened it on day 14.
- **Champion and Finale:** the first Player to defeat the Boss becomes Champion. Duos face the Boss alone for now; once a Duo can go in together (a later Season), it can win together and both become Champions. The victory starts the **Finale**: 72 hours in which others can still beat the Boss for 2nd and 3rd place, and make last trades and gambles. Every attempt at the Boss is a separate fight against a Boss at full health.
- **Weakening:** from day 29 (week 5) *(v0)*, the Boss loses 10% of its health and damage every week, up to −40%. This stops a Season from dragging on.
- **The podium** *(v0)*: each Player can take one place. Beating the Boss also pays its hoard (3 Items from Floor 10, a Gold Chest, 800–1,500 gold), and then its lair stays quiet for that Hero for a day.
- **Before the start:** Players can create Heroes and use the City while a Season is planned; the Labyrinth opens when an admin starts the Season.
- **Wipe:** Heroes, Items, gold and Maps are erased (in practice they stay in the database under the old Season, where nothing reads them). **Glory** survives:
  - the Hall of Fame: Champions, 2nd and 3rd place, Relic finders, best drops and records
  - titles
  - cosmetics such as portrait frames and banners
- **Every new Season:**
  - a new Boss, with the deep Floors re-themed to match it (the upper Floors stay familiar)
  - 2 new Classes, and later new Races too
- **Late joiners:**
  - they get +25% XP for every full week since the Season started, up to +100% *(v0)*
  - after week 2 their Starter kit is Uncommon instead of Common
  - the boost ends once their Hero reaches the Season's median level
- **Season 0** is a test Season. Its Boss is an ancient Dragon.

## Heroes

Each Player has one Hero per Season. Fights are automatic in Season 0: the Player decides whether to fight and in which Stance (see Before a fight), then watches it play out on the Room's map, and can read the whole fight line by line afterwards (the Fight log). More control in fights may come later.

### Creating a hero

1. **Race and Class:** choose one of each.
2. **Ability scores:** for each score, roll 4d6 and drop the lowest die, with the dice rolling on screen.
   - The Player may reroll the whole set up to 3 times and keep whichever set they like.
   - A set that totals less than 65 *(v0)* is rerolled automatically and doesn't count toward the 3.
3. **Talents:** choose one origin Talent. Humans choose two.
4. **Look:** choose a portrait from the set for that Race and Class, a name and a banner color.
5. **Start:** the Hero receives its Starter kit and 100 gold *(v0)*, and appears in the Tavern.

**Quick start:** a new Player's first screen offers the four Classes by their portraits. Picking one and a name (the Player's own by default) makes the Hero by the same rules, with the rest chosen to suit the Class: a Human Fighter (Tough, Savage attacker), a Halfling Rogue (Alert), an Elf Wizard (Tough) or a Dwarf Cleric (Lucky charm). Its dice are rolled with every reroll, keeping the set best for the Class's main ability. The Hero goes straight to the Labyrinth gate, where three short tips wait before its first Run; the full guide stays behind the "?". "Make it my own" opens the steps above instead.

### Races (Season 0)

The bonuses are small. Race is a matter of taste, not power.

| Race | Trait |
|---|---|
| Human | Versatile: one extra origin Talent. |
| Elf | Keen senses: advantage on Checks to see through lying Clues, and advantage against charm. |
| Dwarf | Dwarven toughness: +1 health per level and resistance to poison. |
| Halfling | Lucky: a natural 1 on any d20 is rerolled. |

Later Seasons add more Races (Tiefling, Orc, Dragonborn, Gnome…).

### Origin talents *(v0)*

This list exists so the Human's extra Talent has something to choose from in Season 0. Every Talent can also be learned at the Academy (The City).

| Talent | Effect |
|---|---|
| Alert | +5 to initiative. |
| Tough | +2 health per level. |
| Savage attacker | Roll weapon damage twice and keep the higher, once per turn. |
| Lucky charm | Once per Run, reroll any one d20. |
| Haggler | Shops pay 10% more and sell for 10% less. |
| Field medic | Potions heal 50% more. |

### Classes

Season 0 started with the classic party of four; the Barbarian and the Ranger joined mid-Season. Later Seasons add more.

| Class | Hit die | In fights | In the Labyrinth |
|---|---|---|---|
| Fighter | d10 | Heavy armor, extra attacks. Second wind heals once per fight. | Smashes cracked walls to open shortcuts that only Fighters and Barbarians can use. |
| Rogue | d8 | Critical hits, strikes first. A full Sneak attack (half its level in d6) on the first hit of a fight, and a smaller one (a sixth of its level) on its first hit of each later round. | Picks locks, disarms traps, spots lying Clues, has the best odds on Sneaking and Escape rolls. |
| Wizard | d6 | Big spell damage but fragile. Limited spells per rest. **Shield:** the first blow of every fight that would hit is turned aside *(v0)*. | Senses traps and curses. Identifies Items for free. |
| Cleric | d8 | Heals itself. Its spells are deadly to undead. | Rolls with advantage at Shrines. |
| Barbarian | d12 | **Rage** *(v0)*, a few times a rest (2, then 3 at level 3, 4 at 6, 5 at 12, 6 at 17): when a fight turns hard (two or more monsters, an elite, a Mini-boss or the Boss) or once below half health, it Rages for the rest of the fight: +2 damage on every hit it lands and 2 less from every blow that lands on it (never below 1); 3 from level 9, 4 from 16. The SRD halves the blows instead, which made Barbarians far too hard to kill here. **Danger sense:** advantage on DEX saves (breath, blasts). Two attacks from level 5. | Smashes cracked walls like a Fighter, and takes half damage from traps. |
| Ranger | d10 | **Hunter's mark** *(v0)*, a few times a rest (2, and one more at 5, 9, 13 and 17): in a hard fight it marks the monster with the most health and attacks it first, and every hit on it deals +1d6; when it falls, the mark moves on to the next. **Archery:** +2 to hit with a bow. Attacks with DEX. Two attacks from level 5. | Reads the tracks: always knows when a Clue lies. |

Planned order (it can change): Season 1 Paladin and Warlock, Season 2 Bard and Sorcerer, then Druid and Monk. Until their own portraits are painted, Barbarians borrow the Fighter's portraits and Rangers the Rogue's, for the same Race.

### Proficiencies

Weapons and armor come in types. Each Class can use some of the types, and the types overlap, so every drop has more than one possible buyer. Head, hands, feet, amulet and ring Items can be worn by every Class.

| Type | Fighter | Rogue | Wizard | Cleric | Barbarian | Ranger |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Heavy weapons (greatswords, greataxes, mauls) | ✓ | | | | ✓ | |
| Blades (longswords, sabers, rapiers) | ✓ | ✓ | | | ✓ | ✓ |
| Daggers | ✓ | ✓ | ✓ | | | ✓ |
| Bows and crossbows | ✓ | ✓ | | | | ✓ |
| Maces and hammers | ✓ | | | ✓ | ✓ | |
| Staves and wands | | | ✓ | ✓ | | |
| Shields | ✓ | | | ✓ | ✓ | ✓ |
| Orbs (off-hand) | | | ✓ | | | |
| Holy symbols (off-hand) | | | | ✓ | | |
| Heavy armor | ✓ | | | | | |
| Medium armor | ✓ | | | ✓ | ✓ | ✓ |
| Light armor | ✓ | ✓ | | ✓ | ✓ | ✓ |
| Robes | | | ✓ | ✓ | | |

Starter kits: Fighter longsword, shield and chain mail; Rogue rapier, shortbow and leather; Wizard staff, orb and robes; Cleric mace, shield and breastplate; Barbarian greataxe and scale mail; Ranger longbow, shield and studded leather.

Robes are woven with wards: Armor Class 13 + the full DEX modifier *(v0)*, like the SRD's Mage armor, so a caster's body armor grows with Quality and Upgrades too.

### Levels, health and power

- **Levels:** a Hero goes from level 1 to 20 each Season. XP comes from fights, events and reaching a new Floor for the first time (50 × the Floor's number *(v0)*). An active Player should be about level 10 when the Boss gate opens and level 18–20 by the end of the Season *(v0)*.
- **Levelling up is the Player's moment:** XP never levels a Hero on its own. When there's enough, the report says the level is ready, and a Level up button waits on the Heroes tab. It opens the level's page, as in Baldur's Gate 3: everything the level changes, in words (health, proficiency, attacks, spell and Sneak attack dice, uses a rest, new features, a Path's mastery), then the level's choice, then a button to take it. Levels are taken one at a time, anywhere, even mid-Run. Until then the Hero fights at its old level.
- **Health on level-up:** roll the Class hit die, but never take less than its average. For example, a d10 always gives at least 6. The page shows the range beforehand, and the roll after.
- **Growing:** at level 3 the Player chooses a Path; at levels 4, 8, 12, 16 and 19, +2 to one ability score, +1 to two, or a new Talent (see Growing: Paths and Talents). The choice is made on the level's page, and the level can't be taken without it.
- **Where power comes from:** about 70% from gear and 30% from the Hero itself (level, ability scores, Talents, Academy Talents and training).
- **What death never takes:** levels, ability scores, Talents and the Path.
- **Full health** counts gear: a Hero's own health plus its "+max health" Bonus stats. The City, a Camp's rest and potions fill up to it.

### Growing: Paths and Talents

Every few levels the Player chooses how the Hero grows. The choice waits on the Heroes tab until it is made; nothing is lost by waiting.

- **Path (level 3):** one of two for the Hero's Class, for the rest of the Season (only Retiring changes it). Each Path gives a feature at level 3 and another at level 9 *(v0)*:

  | Class | Path | Level 3 | Level 9 |
  |---|---|---|---|
  | Fighter | Champion | Critical hits on a roll one lower | Below half health, regain 2 + CON modifier at the start of each turn |
  | Fighter | Guardian | Once per round, strike back at a monster that misses | Once per fight, a blow that would drop the Hero leaves it at 1 health |
  | Rogue | Thief | Potions don't cost the turn; +20% gold find | +5 to Sneak and Escape rolls; can Sneak past Mini-bosses; from a fight's fourth round, each round's Sneak attack rolls a third of the level in d6 (it has studied its prey), so a Thief can wear the Boss down |
  | Rogue | Assassin | Full Sneak attack every round | The first hit of every fight is a critical hit |
  | Wizard | Evoker | Spells add the INT modifier twice | One more burst per rest; a burst hits even a lone enemy, twice as hard |
  | Wizard | Abjurer | Each fight starts behind a ward of 4 × level + INT modifier that takes damage first and mends by the INT modifier each turn | Advantage on every saving throw |
  | Cleric | Life | Cure wounds and potions heal 50% more | One more Cure wounds per rest; the first in each fight doesn't cost the turn |
  | Cleric | War | The first hit each turn deals +1d8 | Two attacks each turn |
  | Barbarian | Berserker | While raging, one more attack each turn | While raging, fear and paralysis can't take hold (a Rage also ends fear) |
  | Barbarian | Bear-heart | While raging, blows lose twice the Rage's edge, and breath, blasts, wails, fire and poison lose it too | While raging, a blow that would drop the Hero calls for a CON save (DC 10, then 5 higher each time): on a success it stays up with 1 health |
  | Ranger | Hunter | Once a turn, +1d8 on a hit against a monster that is already hurt | One more attack each turn |
  | Ranger | Stalker | In each fight's first round, one more attack, and every attack that round with advantage | Evasion: a DEX save against breath or a blast takes no damage on a success, and half on a failure |

  Each Class has one Path built for the Boss and one for the long road: Thief, Abjurer, Life and Bear-heart trade damage for gold, safety and healing.
- **Growth (levels 4, 8, 12, 16, 19):** +2 to one ability score, +1 to two (never above 20), or one of three Talents offered. The three are drawn from the Talents the Hero doesn't have yet, and stay the same however often the Player looks.
- **Talents learned by growing** *(v0)*, on top of the origin Talents:

  | Talent | Effect |
  |---|---|
  | Iron will | Proficiency in CON and WIS saves |
  | Fireproof | Fire breath and burning deal half damage |
  | Scavenger | +10% magic find |
  | Treasure hunter | +20% gold find |
  | Light step | +2 to Sneak and Escape rolls; heavy armor no longer hinders Sneaking |
  | Heavy hitter | +2 damage on every hit |
  | Battle-hardened | +1 AC |

  Tough learned late counts for every level the Hero already has.

### First steps *(v0)*

A new Hero's first hour gets a short list of goals, shown on the City screen and at the Labyrinth's gate, each with a small reward that also helps with the next one:

| Goal | Reward |
|---|---|
| Win a fight | 2 Healing potions |
| Bring gold home (leave the Labyrinth carrying some) | An Iron Chest and an Iron key |
| Open a Chest | 2 Scrolls of Identify |
| Reach level 2 | A Town Portal scroll |
| Wake a Waypoint | 150 gold |
| Choose your Path | 200 gold |
| Reach Floor 3 | A Silver Chest and a Silver key |
| Go down the Well (the Daily Delve) | 100 gold |

The goals read what the living Hero has done (its Deed counts, level, Waypoints, deepest Floor and the Player's Delves), in any order. The Player claims each reward by hand, once a Season: a new Hero after Retiring finds the rewards already taken. The card goes once every reward is claimed.

### Deeds and Titles *(v0)*

A **Deed** is a feat a Hero works toward all Season. The moment one is done, its gold goes to the Hero's gold in the City, the Feed says so, and the Hero earns its **Title**. The Player may wear one earned Title after the Hero's name, or none; others see it in the Tavern and on the Rankings. Each Deed is done once per Hero. Counting started with Deeds themselves, except the deepest Floor, which counts from the Hero's own record.

| Title | Deed | Gold |
|---|---|---|
| Goblin-bane | Defeat 100 goblins. | 300 |
| Beast-hunter | Defeat 100 beasts. | 300 |
| Grave warden | Put 150 undead to rest. | 500 |
| Demon-slayer | Defeat 100 demons. | 800 |
| Bane of warlords | Defeat 10 Mini-bosses. | 800 |
| Elite hunter | Defeat 25 elite monsters. | 500 |
| Dragonslayer | Defeat the Ancient Dragon. | 2,500 |
| Against all odds | Win a fight the Door called Deadly. | 300 |
| Too tough to die | Go down in 5 fights, and live through each. | 300 |
| Fortune's favourite | Stand back up on a natural 20 death save. | 200 |
| Deep delver | Reach Floor 10. | 1,000 |
| Pathfinder | Walk into 500 Rooms for the first time. | 500 |
| Keeper of secrets | Plunder 5 hidden rooms. | 300 |
| Curious soul | See 50 Event rooms through. | 300 |
| Riddle master | Answer 10 riddles right. | 300 |
| Blood-trader | Strike 5 devil's bargains. | 300 |
| Tomb robber | Open 5 sarcophagi. | 300 |
| Nimble fingers | Pick 10 tricky locks. | 300 |
| Sharp-eyed | Catch the goblin palming his gem 3 times. | 300 |
| Moneybags | Bring 10,000 gold home from the Labyrinth. | 500 |
| Chest-cracker | Open 25 Chests. | 500 |
| Legend-seeker | Find a Legendary Item (a Relic counts). | 300 |
| Sellsword | Finish 20 Bounties. | 500 |
| Well-diver | Win all six Rooms of the Daily Delve three times. | 500 |
| Guardian angel | Stand your partner back up in a fight 5 times (Pull up, or a Cleric's Cure wounds). | 300 |
| Twin-breaker | Defeat the Twin Wardens 3 times. | 500 |
| Oathkeeper | Share at an Oathstone 5 times while your partner shares too. | 300 |
| Oathbreaker | Take at an Oathstone while your partner shares. | 100 |

### Retiring

Once per Season, a Player may Retire their Hero at the Temple and create a new one, with a new Race, Class and ability roll, starting at level 1. Gold and Storage are kept, and the old Hero's gear moves into Storage. It is also the only way to try another Path.

## Dice and fights

The rules are a light version of the D&D System Reference Document (SRD 5.2).

- **Checks:** roll a d20, add the ability modifier (plus proficiency when it applies), and compare the total with a difficulty. Advantage means roll two d20s and keep the higher. Disadvantage means keep the lower.
- **Natural 20 and natural 1:** on an attack, a natural 20 is a critical hit (damage dice doubled) and a natural 1 always misses. On a Check, a natural 20 gives the best outcome and a natural 1 the worst.
- **How fights work:** a fight in a Room is played turn by turn: at each of its Hero's turns the Player chooses what it does (Manual fights, below), or hands it to the AI with Auto. The server rolls every die. The fight uses initiative (d20 + DEX), attack rolls against Armor Class, and damage dice. Tokens move and strike on the Room's battle map. In Season 0, where a token stands is only for show.
- **Dice shown on screen:**
  - ability rolls when creating a Hero
  - critical hits and natural 1s
  - Death saves and Escape rolls
  - traps and event Checks

  Ordinary attacks just show hit or miss, so fights stay easy to follow.
- **Before a fight:** see below.
- **Abilities:** some work once per fight. Others have a few uses per rest, and those come back after a long rest at a Camp or on returning to the City.
- **Health:** damage carries over from Room to Room. Heroes heal with potions, Shrines, Cleric spells, a long rest at a Camp, or fully in the City. Waiting anywhere in the Labyrinth also heals, slowly: a twentieth of full health an hour *(v0)*, so a Hero left near death overnight can still walk out.
- **Healing potions** *(v0)*: 2d4 + 2 plus a tenth of the Hero's full health, so they still matter deep down. At most 3 per fight; a Hero on Auto drinks one below 30% health.
- **Monsters:** they come in groups, and deeper Floors have stronger ones. Each kind has a power of its own (see Monsters below).
- **Saving throws:** some powers call for a save: a d20 plus the ability modifier, plus proficiency in the Class's two saves (Fighter STR and CON, Rogue DEX and INT, Wizard INT and WIS, Cleric WIS and CHA). The DC is set by the power, +1 for every two Floors deeper into its theme.
- **Weapons wound differently:** slashing (swords, axes), piercing (rapiers, daggers, bows) or blunt (maces, hammers, mauls, staves). It matters against some monsters.

### Manual fights *(v0)*

Every fight in a Room (monsters in the doorway, Mini-bosses, the Dragon) is played turn by turn. The monsters act on their own; when it is the Hero's turn, the fight waits for its Player.

- **The Hero's turn:** one of these, as its Class, uses and the fight allow:
  - **Attack:** tap a monster, or let the Hero hit the weakest. Every attack the Hero has that turn goes at it (the next one if it falls).
  - **Burst of fire** (Wizard): every monster, one use. **Cure wounds** (Cleric): itself or its partner, one use. **Second wind** (Fighter): once a fight.
  - **A Healing potion:** at most 3 a fight.
  - **Dodge:** until its next turn, blows at it have disadvantage.
  - **Escape:** an Escape roll (alone only).
  - In a Duo: **Help**, **Guard** and **Pull up** (Duos, below).
- **Free, before the action:** a Barbarian can start its Rage, and a Ranger put its Hunter's mark on a monster.
- **A second action:** Preserve life's free Cure wounds and a Thief's Fast hands potion give the turn another choice.
- **Auto:** the Hero fights the rest on its own, the way it always has: the same AI plays fights in events and the Daily Delve. From the doorway, **Auto** fights the whole fight at once. On Auto, a Hero's Stance also decides when it tries to escape; played by hand, Escape is the Player's call.
- **The dice:** the server rolls every one. It keeps each fight's seed and the choices made, and plays it again from the start to where it stands, so a fight looks the same to everyone and can't be rolled over.
- **While a fight goes on** nothing else happens: no Moves, rests, Bag changes, or leaving a Duo. A fight left waiting waits: the Hero is still in it next time.
- **Not yet by hand** *(v0)*: fights inside events and the Daily Delve play on their own.

### Monsters

Every monster has a signature power, so a fight plays differently depending on who is in it. The Door's Threat already counts them, and the Player sees them before choosing (Before a fight). Save DCs grow by 1 for every two Floors deeper into a theme. Season 0's bestiary *(v0)*:

| Floors | Monster | Power |
|---|---|---|
| 1–3 | Giant rat, Goblin | none |
| 1–3 | Goblin archer | **Quick:** +5 to initiative |
| 1–3 | Goblin cutpurse | **Thief:** a hit snatches carried gold, 2d10 × (Floors into the theme + 1). It runs with it on its next turn unless it falls first. The gold that gets away is lost. |
| 1–3 | Wolf | **Pack hunter:** advantage while another monster still stands |
| 1–3 | Goblin sapper | **Lit bomb:** when it falls, its bomb goes off: 2d4 to the Hero, DEX save (DC 10) for half |
| 1–3 | Goblin shaman | **Dark mending:** once per fight, instead of attacking, heals an ally below half health by 1d8 |
| 1–3 | Bat swarm | **Swarm:** weapon hits deal half damage; spells hit it fully, and bursts and Fire bombs deal double. Also **Quick** |
| 1–3 | Giant spider | **Venom:** a hit calls for a CON save (DC 10), or poison deals 1d4 at the start of the Hero's next 2 turns |
| 4–6 | Skeleton | **Brittle bones:** blunt weapons deal +50%, piercing ones −25% |
| 4–6 | Zombie | **Undying:** half the time, the first killing blow that isn't a critical hit leaves it at 1 health |
| 4–6 | Ghoul | **Paralyzing touch:** a hit calls for a CON save (DC 10), or the Hero loses its next turn |
| 4–6 | Wraith | **Life drain:** heals itself for half the damage it deals |
| 4–6 | Grave robber | **Thief** and **Quick** |
| 4–6 | Banshee | **Wail:** as the fight starts, before the first blow, 2d6 to the Hero, WIS save (DC 12) for half |
| 4–6 | Mummy | **Undying**, and **Terrifying:** a WIS save as the fight starts (DC 11), or 1 round of disadvantage on attacks |
| 4–6 | Rot grubs | **Swarm**, and **Venom:** a hit calls for a CON save (DC 11), or poison deals 1d6 at the start of the Hero's next 2 turns |
| 7–9 | Cultist | **Dark mending:** once per fight, instead of attacking, heals an ally below half health by 2d8 |
| 7–9 | Imp | **Hellfire:** a hit sets the Hero burning, 1d4 at the start of its next 2 turns |
| 7–9 | Hellhound | **Fire breath:** 3d6, DEX save (DC 13) for half. Ready at the start, and again on a 5–6 on a d6 each turn |
| 7–9 | Demon brute | **Several attacks:** two a turn |
| 7–9 | Flame skull | **Hellfire** (1d6 for 2 turns) and **Quick** |
| 7–9 | Night hag | **Life drain**, and **Terrifying** (DC 13, 1 round) |
| 7–9 | Chain devil | **Several attacks:** two a turn, and **Rage:** below half health, once, it gains +2 AC and +1 to hit |
| 10 | Kobold | **Pack hunter** |
| 10 | Drake | **Fire breath:** 7d6, DC 15 |
| any | Mimic | Bites before the Hero can move: the Hero is surprised. |
| 1–9, Duo | Dawn Warden, Dusk Warden | **Twin:** felled while its twin stands, it rises at the end of the round with half its health (Duos → Twin doors). The Dawn Warden also has **Dark mending** (2d8), the Dusk Warden **Life drain** |

- **One fear a fight:** when several monsters are Terrifying, only the first one's roar calls for a save.

- **Deeper is harder** *(v0)*: gear keeps getting better, so the monsters do too.
  - Each Floor into a theme adds 15% health and +1 to hit and to damage.
  - On top of that, every Floor below Floor 2 adds 20% health, +0.75 to hit and +0.55 damage (rounded), so a Floor 9 monster has 2.4 times its Floor-1 health and +5 to hit and +4 damage from depth alone. Floors 1 and 2 stay gentle for new Heroes.
  - The Mimic and the Doppelganger, which turn up anywhere, grow like the Floor's own monsters. The Dragon is measured on its own (1,400 health, AC 20).
  - The aim, checked with `npm run balance:par -w @dark/engine`: on the Floor a typical Hero has just reached, a fight costs about a quarter of its health, most Rooms read Trivial or Easy at full health with a few Dangerous ones, and the Floor's Mini-boss is a real fight. The Dragon at full strength is a gamble even at level 20 with late-Season gear: about one win in four, and two deaths in five. Its weakening from day 29 brings it within reach: about one win in two on day 29, two in three on day 36 and nine in ten on day 43, so most Seasons find their Champion after day 29 *(v0)*.
- **Mini-bosses** come with an escort:
  - the Goblin chieftain with a Goblin archer
  - the Bone knight, which is **Undying**, with a Skeleton
  - the Horned tyrant (two attacks a turn, and **Terrifying**: a WIS save as the fight starts, DC 14, or 2 rounds of disadvantage on attacks) with an Imp
- **The Dragon:**
  - **Terrifying** (DC 15).
  - **Fire breath:** 12d6, DEX DC 17.
  - Two attacks a turn, 2d10 + 10 each.
  - **Rage:** below half health, once, it gains +2 AC and +1 to hit, and its breath is ready again.
- **Elite packs** *(v0)*: from Floor 2 on, a group's strongest monster is sometimes an elite. The chance is 10% on Floors 2–3, 15% on 4–6, 20% on 7–9 and 25% on 10.
  - Every elite has 25% more health (Gilded 50%), is worth double XP, and drops one more Item when it falls.
  - Each has one gift:

    | Gift | Effect |
    |---|---|
    | Gilded | triple gold, the one Players hope for |
    | Frenzied | its hits deal +50% |
    | Armored | +3 AC |
    | Vampiric | Life drain |
    | Swift | +5 to initiative and one more attack a turn |
- **Statuses:**
  - Burning: damage at the start of each turn. Ember Fang's critical hits now set enemies burning for 3 turns, 1d6 a turn, as its text always said.
  - Poisoned: damage at the start of each of the Hero's turns; a fresh bite doesn't stack while the poison lasts.
  - Paralyzed: the next turn is lost.
  - Frightened: disadvantage on attacks.

### Before a fight

Opening the Door of a Room with monsters doesn't start the fight. The Hero stops in the doorway, the Player sees who is there, and chooses. Until then the Room's other Doors stay shut.

- **Monster cards:** tapping a monster shows what it is, with its health, Armor Class, attack and damage as they are on this Floor today, its powers and its elite gift.

- **Threat:** how dangerous the fight is for this Hero right now: Trivial, Easy, Risky, Dangerous or Deadly. The server plays the fight 60 times with the Hero as it stands, with its health, potions, gear and Stance, and never with the real dice. It rates the fight by how often the Hero won and died *(v0)*:

  | Threat | When |
  |---|---|
  | Deadly | died in 35% or more |
  | Dangerous | died in 15% or more, or won less than half |
  | Risky | died in 5% or more, or won less than 80% |
  | Easy | died at all, or won less than 97% |
  | Trivial | anything better |

  **Trivial is a promise:** a Hero that chose to fight a Trivial fight can be knocked down by bad luck but never dies there. It is left for dead with 1 health and crawls back to the last safe Room, keeping its XP. Being caught Sneaking, or any fight the Player didn't choose from the doorway, carries no promise.

- **Stance:** the Player sets it at any time. It holds for every fight until changed, and the Threat is shown for all three *(v0)*:

  | Stance | In the fight | Escape rolls |
  |---|---|---|
  | Bold | advantage on the Hero's attacks, and on the monsters' attacks against it | never |
  | Steady | nothing changes | below 20% health |
  | Wary | +2 AC, −2 to hit | below half health |

- **Fight:** as described above. A **Fire bomb** (Shops, 40 gold) may be thrown first: 2d6 + 2 per Floor number damage to every monster before the first round *(v0)*.
- **Sneak past:** a DEX Check against 10 + half the Floor number + 2 for each monster after the first *(v0)*. Rogues roll with advantage and add their proficiency bonus. Heavy armor gives disadvantage. Every 5% of escape Bonus stats adds +1. A Lucky charm or Luckstone can reroll it.
  - On a success the Hero slips past. It stands in the Room unnoticed and can use its other Doors. The monsters are still there next time.
  - On a failure the monsters notice: the fight starts, and the monsters act first. The Hero loses its turns in the first round.
  - A **Smoke bomb** (Shops, 30 gold) makes it sure, with no roll.
  - Mini-bosses and the Boss can't be snuck past.
- **Retreat:** back to the last safe Room, free: no Stamina and no roll. The monsters stay.
- **Escape rolls:** in a fight, once its health drops below its Stance's line, the Hero spends its turns on Escape rolls instead of attacking. A healing ability or potion it would use comes first.
  - The roll is a DEX Check against 8 + 2 for each monster still standing *(v0)*. Rogues roll with advantage and add their proficiency, and escape Bonus stats help as they do for Sneaking.
  - On a success the Hero gets away to the last safe Room. It keeps the XP for monsters already defeated, but there is no loot.
- **The last safe Room** is the last Room the Hero stood in without monsters left in it. Retreating, escaping and surviving Death saves all end there.
- **Graves** in a Room with monsters can only be looted after the Hero fights them or Sneaks past.

## The City

The City is an inked town map seen from above, with Buildings you can tap. Nothing can attack a Hero there.

| Building | When | What it does |
|---|---|---|
| Tavern | Season 0 | Where Heroes appear. Your room here holds your Storage. Shows who is online, rumors about the Labyrinth, the Feed, the Rankings, and your bounties. Lodging: a bed for the night, for City gold, fills Stamina and brings back the short rests, one night a day (the day turns at midnight UTC). The first night costs 50 gold, and each night after costs half again as much as the one before, all Season *(v0)*. Later you can also play tavern games here. |
| Shops | Season 0 | Sell Common and Uncommon gear, potions, scrolls (Identify, Town Portal, Protection) and Keys. Buy any Item at its Buyback price. |
| Forge | Season 0 | Upgrade, Reforge, Salvage, and craft Keys and scrolls from Materials. |
| Market | Season 0 | Players list Items at their own price, and anyone can buy at any time. |
| Temple | Season 0 | Where Heroes wake after death. Sells Blessings. You Retire your Hero here. |
| Labyrinth gate | Season 0 | Enter the Labyrinth at the entrance or at any Waypoint your Hero has reached. |
| Academy | Season 0 | From level 12, learn one more Talent at a time for City gold, any the Hero doesn't know: 2,000 gold, then 6,000, then 15,000, three in all *(v0)*. They are the Hero's like any other Talent (death never takes them) and leave with it when it Retires. |
| Training grounds | later | Train an ability score for a few hours while you're away. It costs gold, and the Hero can't enter the Labyrinth meanwhile. |
| Houses | later | Bought with gold. They give more Storage and a trophy wall friends can visit. |
| Arena | later | Tournaments with nothing to lose: the loser is simply knocked out. |
| Guild hall | later | Small Guilds. |

### Omens

Each day the whole Labyrinth leans one way, for everyone *(v0)*. The day's Omen comes from the Season's seed and the UTC day. It shows in the Tavern and the Labyrinth, goes in the Feed, and is Broadcast at midnight UTC. About a third of days are plain.

| Omen | Effect |
|---|---|
| Blood moon | Monsters have +20% health and hit 10% harder, and drop 1.5 times the gold |
| Still air | +3 to Sneak Checks and Escape rolls |
| Scholar's day | +25% XP from fights |
| Fortune's wind | +25% magic find for everyone |
| Hunting season | Elites lead twice as many groups |
| Hot forges | +10 percentage points on every Upgrade, never above 95% |
| Free market | No Market tax on today's sales |
| Dim day | Monsters have 10% less health and drop 20% less gold |

The Threat a Door shows already counts the day's Omen.

### The Hunt

Once a week the whole server hunts together *(v0)*.

- **The quarry:** every Monday (00:00 UTC) the Tavern posts a Hunt against one kin of monster: goblins, beasts, undead, demons, cultists or dragonkin. It is drawn from the kins that live on the Floors down to where most Heroes are, so everyone can take part.
- **The target:** 40 for every Hero seen that week, never fewer than 120; a Hunt first posted mid-week (a new Season) asks only its share for the days left. Every monster of that kin any Hero defeats counts, and the board shows the total, your own kills and the top three hunters.
- **The reward:** when the server reaches the target, every Hero with 10 or more kills gets a Silver Chest in its room at the Tavern, and the top hunter a Gold Chest instead. The Hunt and its end go in the Feed.

### The Daily Delve *(v0)*

The City's old Well opens onto a different stretch of the deep every day (midnight to midnight UTC). Each Player gets one Delve a day, with the Hero they have.

- **Six Rooms, the same for everyone:** the day's seed decides who waits in each Room and which Boons are offered. The first Room comes from the Hero's own Floor: its deepest, or half its level rounded up, whichever is deeper. The Rooms go deeper two by two (+0, +0, +1, +1, +2, +2 Floors, never past Floor 10), and the sixth holds a guardian: that Floor's Mini-boss, or two Drakes (one an elite) in the Dragon's lair.
- **Nothing is lost:** the Hero goes down at full health with the Well's own 2 Healing potions and its abilities fresh. Its real health, Bag and Items stay as they are; the Delve keeps its own health, potions and ability uses from Room to Room. The fights use the Hero's gear and Stance, and the day's Omen.
- **Boons:** after each Room won, the Player takes one of two Boons before the next: Mend (40% of full health), Draught (one more potion), Second breath (what a rest brings back: spells, healing prayers, Rages, Hunter's marks; and 15% health), or one that lasts the rest of the Delve: Whetstone (+15% damage), Ward (+2 AC), Keen eye (+10% critical chance), Leech (10% life steal).
- **Stop or go on:** before each Room the Player sees who waits there and the Threat in each Stance, and can stop and bank. The score is 100 points a Room won, plus the health left in percent when the Player stops or wins all six. An Escape roll ends the Delve with the Rooms' points only; falling keeps half of them.
- **Pay:** gold for every Room won (10 × (the Delve's Floor + 1) each), into the City purse. Winning all six counts toward the Well-diver Deed.
- **The board:** the Well shows the day's finished Delves, best first (ties go to whoever finished first), and yesterday's best three. At midnight UTC, Delves still under way stop and bank, and the day's first three win a Gold, a Silver and an Iron Chest, taken at the Well. The podium goes in the Feed and on Discord, and the three hear it as a Notification.

### Tavern bounties

Small goals give each session a reason to go down today *(v0)*.

- **Three a day and one a week** per Hero, new at 00:00 UTC (05:00 game time) and on Mondays. They are drawn from a seed per Hero and day and sized to the deepest Floor the Hero has reached.
- **Daily kinds:**
  - defeat 6–10 monsters
  - defeat 4–6 of the kin that lives that deep (goblins or beasts, undead, demons or cultists, dragonkin)
  - win 3–5 fights on the Hero's deepest Floor − 1 or deeper
  - Sneak past 2–3 groups
  - loot 1–2 Treasure rooms
  - deal with 2–3 Event rooms
  - defeat an elite (from Floor 2)
  - win 1–2 fights rated Risky or worse
  - bring 60 × deepest Floor gold back to the City
- **Daily reward:** 30 + 15 × deepest Floor gold (twice that for an elite, 1.5 times for a Risky fight), and often a small Item: 2 potions or 2 Scrolls of Identify, a Fire or Smoke bomb, or an Iron key.
- **Weekly kinds:** defeat a Mini-boss, reach a new Floor, or defeat 60 monsters. The reward is 300 + 100 × deepest Floor gold and a Silver Chest. A finished weekly bounty goes in the Feed.
- **Paid at once:** the moment a bounty is done, its gold is banked in the City (safe from death) and its Item waits in the Hero's room at the Tavern (Storage). With Storage full, the Item is paid out at twice its Buyback price.
- **Swapping:** once a day, one untouched daily bounty can be swapped for another kind.

## The Labyrinth

### Structure

- **One per Season:** a single Labyrinth, shared by all Players, generated once at the start of the Season and unchanged until the Wipe.
- **Size:** 10 Floors of about 100 Rooms each *(v0)*. Floor 10 is smaller and ends in the Boss lair. Each Floor has 2–4 staircases down, so there are many routes to the Boss.
- **Floor themes in Season 0:**
  - Floors 1–3: goblin warrens and beasts
  - Floors 4–6: undead crypts
  - Floors 7–9: depths twisted by demons
  - Floor 10: the ancient Dragon's lair
- **Difficulty:** the deeper the Floor, the stronger the monsters and the better the loot.
- **Room art:** each Room is drawn as a battle map seen from above. Each theme has a set of about 15–20 maps, which are flipped and rotated so they look varied.

### Moving and stamina

- **Moving:** each Move is instant. A Move into a Room the Hero has never stood in costs 1 Stamina. Walking back through Rooms it knows is free, and so are stairs to a landing or stairs it knows. A known Room costs 1 again when something new waits there today: monsters back, a Treasure or hoard not taken, or an event not done (a Merchant never counts). Otherwise a known Floor could be farmed without Stamina. The Door says which way is free.
- **Stamina:** up to 20, and 1 point refills every 24 minutes, so an empty bar is full again after 8 hours *(v0)*. A Player who checks in 2–3 times a day reaches about 40–60 Rooms that cost Stamina, plus what short rests and Lodging add.
- **Only Moves cost Stamina.** City actions, Waypoints and Town Portals are free.
- **Short rests** *(v0)*: a Run starts with 2. Each gives back half of full health and half of full Stamina (10), anywhere monsters don't block the way. They come back when a Run starts, but no sooner than 8 hours after they last came back, so stepping out at the gate and straight back in can't refill them. Lodging at the Tavern and a long rest in a Camp bring them back too.

### Doors, clues and the map

- **Clues:** every Door carries a Clue about the Room behind it, such as "growling behind the door", "a faint golden glow" or "the smell of sulfur". About 80% of Clues are true and 20% lie *(v0)*.
- **Spotting lies:** Rogues and Elves make a WIS Check (DC 13 *(v0)*) to mark a lying Clue as suspicious, and Elves roll it with advantage.
- **Special doors:** cracked walls, which only a Fighter or a Barbarian can smash through; locked Doors, which need a Key or a Rogue; secret Doors (see Hidden rooms); and Twin doors, which open only for a Duo (see Duos → Twin doors).
- **The Map:** each Player's Map shows every Room and Door their Hero has seen this Season. Everything else stays dark. Maps can't be shared in Season 0. (An idea for later: sell copies of your Map on the Market.)

### Room types

| Room | How many *(v0)* | Notes |
|---|---|---|
| Fight | ~50% of a Floor | A group of monsters. Personal: every Hero meets its own. Its Door shows them and their Threat first (Before a fight). A Room a Hero has cleared stays clear for that Hero for 24 hours. |
| Empty | ~15% | Nothing happens, or just a line of description. |
| Event room | ~15% | See the table below. Personal. |
| Treasure | ~7% | Loose loot, sometimes a Chest. Personal; a Duo's Items go into one Duo Chest (Trust and greed). |
| Camp | 3–5 per Floor | Safe place to leave a waiting Hero. |
| Stairs | 2–4 per Floor | Lead down to the next Floor, and back up. |
| Waypoint | 1 per Floor | Once reached, you can enter or leave the Labyrinth here. |
| Vault | 1–2 per Floor | Special room: see below. |
| Mini-boss | 1 per Floor | Special room: see below. |
| Hidden room | 1–2 per Floor (not the lair) | Behind a secret Door: see below. Personal. |
| Twin Wardens | 1 per Floor (not the lair) | Behind a Twin door, for a Duo: see Duos → Twin doors. Personal. |
| Oathstone | 1 per Floor (not the lair) | A quiet Room where a Duo swears in secret to share or take: see Duos → Trust and greed. |

### Event rooms (Season 0)

| Event | What happens |
|---|---|
| Three chests | Pick one of three: one holds gold, two hold an Item each, and 30% of the time one of those is a mimic, which means a fight in which the mimic strikes first *(v0)*. |
| Shrine | Pray for a random Blessing, at the risk of a curse. A WIS Check against 12; failing by 5 or more (or a natural 1) burns a quarter of max health. Clerics roll with advantage, and Wizards sense the curse and step back *(v0)*. |
| Goblin gambler | Double-or-nothing on carried gold: both roll a d20 and ties go to the goblin. Or bet an Item for one a Tier higher (not Mythics or Relics). Or play his cups: the stake (up to 30 × (Floor + 1) gold) goes down first, then he shows a gem under one of three cups and shuffles, 4 swaps plus half the Floor, quicker deeper down (0.65 s a swap on Floor 1, 0.33 s on Floor 10). Pick the gem's cup, or call his cheat: a quarter of the time he palms the gem and no cup holds it, and a Rogue's eye catches that. A right cup or a cheat caught pays double; anything else loses the stake. One bet per visit *(v0)*. |
| Wandering merchant | Sells 3 rare Items (Rare, Epic, sometimes Legendary) at 6 times the Buyback price, and buys yours at twice the Buyback price *(v0)*. |
| Trapped corridor | A DEX Check (11 + half the Floor) to get through unhurt, or take 2d6 + the Floor number in damage, never below 1 health. A Rogue disarms it; Wizards roll with advantage *(v0)*. |
| Cursed altar | Offer a Common, Uncommon or Rare Item: 40% chance its Tier goes up by one and it gains a Bonus stat, 60% it is destroyed *(v0)*. |
| Locked cache | Needs an Iron key or a Rogue. Two Items with the odds of three Floors deeper, plus gold *(v0)*. |
| Lockpicking | A 10–20 second minigame: three pins, each set by tapping while its sweeping marker is in the lit sweet spot. Deeper Floors sweep faster (one sweep there and back takes 1.4 s on Floor 1 and 0.8 s on Floor 10), and each pin a little faster than the one before. A miss breaks a pick and that pin sweeps again; 2 picks, 3 for Rogues, and out of picks the lock jams. Rogues get a sweet spot half again as wide, and each point of DEX modifier widens it a little. How far the lock got stays for the day, so leaving doesn't reset it. Opened: a Chest with the odds of three Floors deeper *(v0)*. |
| Fountain | Drink: a plain d20 on screen. 1–4 foul (a fifth of full health lost), 5–12 clean (half of it back), 13–19 glowing (all of it, and abilities restored), 20 a spirit (all that, and a Blessing) *(v0)*. |
| Prisoner | Free them with an Iron key, or a Rogue picks the chains. 80% they give an Item with the odds of two Floors deeper and gold; 20% a doppelganger that strikes first *(v0)*. |
| Library | Read a tome: an INT Check against 11 + half the Floor number (Wizards add proficiency and roll with advantage). Success teaches 60 XP per Floor number; failing by 5 or more, or a natural 1, costs a tenth of full health *(v0)*. |
| Bone pile | Search: an old adventurer's purse, 10–40 × (Floor + 1) gold and half the time an Item. 35% of the time the bones rise first and strike first: one Skeleton, two from Floor 4 *(v0)*. |
| Riddling statue | A stone head asks a folk riddle, with three answers to choose from. Right: 50 XP per Floor number, and it points out the Floor's secret Door if the Hero hasn't found it (the room behind goes on the Map). Wrong: its eyes burn 15% of full health, never below 1 *(v0)*. |
| Goblin cookpot (Floors 1–3) | Taste the stew: a CON Check against 10 + half the Floor (Dwarves with advantage). Success heals a third of full health and gives 3 Stamina; failing, it was not meat: a tenth of full health *(v0)*. |
| Webbed body (Floors 1–3) | Cut it down: a DEX Check against 11 + half the Floor (Rogues add proficiency and roll with advantage). Its purse, 10–30 × (Floor + 1) gold, and half the time an Item with the odds of a Floor deeper. Failing, a Giant spider drops first and strikes first *(v0)*. |
| Sarcophagus (Floors 4–6) | Pry the lid: a STR Check against 11 + half the Floor (Fighters add proficiency and roll with advantage). The grave goods either way: 20–50 × (Floor + 1) gold and an Item with the odds of two Floors deeper. Failing, the lid grinds loud enough to wake its Mummy, which strikes first *(v0)*. |
| Devil's bargain (Floors 7–9) | A chain devil bound in a circle of salt offers two deals a day, each paid in health: 30–60 × (Floor + 1) gold for a fifth of full health, or an Item of a Tier it shows up front (Rare 60%, Epic 30%, Legendary 9%, Mythic 1%) for a quarter, a third, half or 60% of full health. A deal needs more health than it takes, and only one is made a day. Or banish it: a WIS Check against 12 + half the Floor (Clerics add proficiency and roll with advantage) for 60 XP per Floor number; failing, the devil breaks the circle and fights *(v0)*. |
| Whispering skulls (Floor 10) | Listen: a WIS Check against 11 + half the Floor (Elves with advantage). Success teaches 50 XP per Floor number and puts the way to the Dragon's chamber on the Map; failing, the whispers scream: 15% of full health, never below 1 *(v0)*. |
| Spilled hoard (Floor 10) | Grab one, two or three handfuls, each worth 30–60 × (Floor + 1) gold. The Dragon's kin notice 20%, 45% or 70% of the time and strike first: kobolds, one more than the handfuls, or a drake for three. The gold is kept if the fight is won *(v0)*. |
| Fallen champion (Floor 10) | Take the champion's gear: an Item that is Epic (70%), Legendary (25%) or Mythic (5%), but half the time the champion's bones stand up as a Bone knight and strike first. Or bury the champion for a random Blessing *(v0)*. |

- **Where they are:** each event Room holds one kind for the whole Season. The goblin cookpot and the webbed body came later: a quarter of the warrens' event Rooms hold one of them. The sarcophagus and the Devil's bargain came later still: a fifth of the crypts' event Rooms hold a sarcophagus and a fifth of the depths' a bargain. Half of the lair's few event Rooms hold one of its own three. Each is rolled apart from the rest, so the other Rooms kept their events *(v0)*.
- **Daily and personal:** what an Event room holds comes from the Hero, the Room and the day, so leaving and coming back doesn't reroll it. Each Event room works once a day per Hero (the merchant sells until his wares are gone).
- **Luck:** a Hero with the Lucky charm or the Luckstone rerolls one failed Check or death save per Run and keeps the better roll.

Later: more minigames.

### Hidden rooms

- **Where:** 1–2 dead-end Rooms per Floor (not the lair) sit behind a **secret Door**, the only way in *(v0)*.
- **Spotting it:** a WIS Check against 14 in the Room outside, a fresh try each day. Rogues add their proficiency bonus, and Rogues and Elves roll with advantage. Once a Hero has been inside, the Door stays visible to it; the Eye of the Abyss shows every hidden room on the Floor, and its Door.
- **Inside:** a hoard: 2 Items with the odds of two Floors deeper, 20–60 × (Floor + 1) gold, and a 25% chance of a Chest. It is personal, and fills again a week after it is taken. Finding one goes in the Feed.

### Special rooms and announced vaults

- **Shared:** Vaults, Mini-bosses and rare events are shared by everyone. The first Hero to claim one takes the prize, and it's gone for everyone else. A Mini-boss comes back 24 hours after it is defeated.
- **A Vault's prize** *(v0)*: 3 Items with the odds of three Floors deeper, a Silver Chest (a Gold one on Floors 7–10), and 100–200 gold × (Floor + 1).
- **Announced Vaults:** some Vaults are announced in advance through a Broadcast, e.g. "A sealed vault on Floor 6 opens tonight at 21:00". About 3 happen per week *(v0)*, only on Floors that at least two Heroes have reached. The first Hero to enter after the opening time claims it. These races are where Players mostly meet. *(v0: every day at 12:00 game time there is a 3-in-7 chance of one, opening at 21:00. An announcement seals an already-emptied Vault and refills it.)*
- **Relics:** found in Vaults, and rarely from Mini-bosses on Floors 7–10, until every copy is out. *(v0: 60% from an announced Vault, 10% from any other Vault on Floors 7–10, 2% from a Mini-boss there.)* A Relic is identified the moment it is found, and it goes into the Bag even when the Bag is full.

### Getting in and out

- **Entering:** go in through the Labyrinth gate, starting either from the entrance on Floor 1, from any Waypoint your Hero has reached this Season, or back through an open Town Portal.
- **Leaving:** walk back out through the entrance on Floor 1, walk to any Waypoint you've reached, or read a **Town Portal** scroll anywhere outside a fight (50 gold *(v0)*).
- **Town Portals stay open:** the portal a Hero reads stays open behind it for 24 hours *(v0)*. Stepping back through it from the Labyrinth gate, once, returns the Hero to the Room it read the scroll in (read in a doorway, to the last safe Room). If monsters have come back to that Room meanwhile, the Hero steps out in their doorway. So a trip to the City to sell and heal doesn't cost the way back down.
- **In the City:** returning fully heals the Hero and restores all its abilities. Gold picked up in the Labyrinth becomes safe from that moment.
- **The Run's summary:** when a Run ends (home through the entrance, a Waypoint or a Town Portal, or a death), the report sums it up: how long it took, Rooms walked into for the first time, fights won out of fights fought, the gold brought home (after a death, the gold left in the Grave), Items found, XP, levels gained and the deepest Floor reached. Stepping back through a portal starts a new Run.

### Waiting heroes and camps

- **Waiting:** when the Player stops playing, their Hero stays in the Room where it is.
- **Monsters never attack a waiting Hero.**
- **From Season 1 (PvP):** a waiting Hero outside a Camp can be attacked by other Players, and it reacts according to its Stance. Heroes in Camps are always safe.
- **Long rest:** a Hero that waits at least 4 hours in a Camp *(v0)* gets a full rest: full health, all its abilities, full Stamina and both short rests back. Leaving the Camp before then loses it (coming back starts the 4 hours over), so the game asks before the Hero walks out while the rest still has something to give.

## Death

- **Death saves:** when a Hero drops to 0 health in a fight against monsters, it rolls d20s on screen until it has 3 successes (10 or higher) or 3 failures.
  - A natural 20: the Hero gets back up with a quarter of its health and keeps fighting.
  - A natural 1: counts as two failures.
  - 3 successes: the Hero survives with 1 health, loses the fight, and is dragged back to the last safe Room.
  - 3 failures: the Hero dies.
- **No Death saves against Players.**
- **Grave:** a dead Hero drops **everything it Carried** (worn gear, Bag and the gold it picked up on this Run) into a Grave in that Room. The Grave stays for 48 hours, and anyone who reaches it can loot it, including the owner with a new set of gear. Looting someone else's Grave shows in the Feed. After 48 hours its contents are destroyed.
- **Falling to the Boss:** nobody can Sneak past the Boss, so its lair would keep a Grave out of reach; a Hero who dies to it leaves the Grave on the lair's doorstep instead, the last safe Room before it.
- **Killed by another Hero:** the winner takes everything instead. Whatever doesn't fit in the winner's Bag goes into a Grave.
- **Waking up:** the Hero wakes at the Temple with a free **Starter kit** (a Common weapon for its Class, Common armor and 2 potions).
- **Never lost:** levels, ability scores, Talents, Storage and gold in the City.

## Items and loot

### Slots and space

- **Worn:** main hand, off-hand, head, body, hands, feet, amulet and two rings.
- **Bag:** 20 slots *(v0)*. Potions, scrolls, Keys and Materials stack.
- **Storage:** 60 slots *(v0)*. Houses add more later.

### What an item is made of

- **Base:** the item type (e.g. longsword) sets its base damage or armor. Its **item level** comes from the Floor it dropped on: it makes the Bonus stats bigger (+10% a level) and the price higher, and leaves base damage and armor as they are.
- **Tier:** Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange), Mythic (red).
- **Quality:** a 1–100% roll, evenly spread *(v0)*. It scales base damage or armor from 85% to 115%.
- **Bonus stats:**
  - Common has 0, Uncommon 1, Rare 2, Epic 3, Legendary 4, Mythic 5.
  - They come from a pool of about 15 kinds: ability scores, max health, armor, damage %, critical chance, spell power, healing, escape chance, gold find, magic find, resistances and life steal.
  - Each is rolled within a range that grows with item level and Tier *(v0)*. Ability scores, armor and life steal are the exception: the first two live on the d20, where every point counts, and life steal stacked across a whole kit makes a Hero nothing can wear down, so they grow with Tier only, one point more at Epic and another at Relic.
  - **What each one does** (the card explains every line when it is tapped, and the Character sheet adds up the gear):
    - **Ability scores** count wherever the score is used: fights and every Check (event rooms, spotting secret Doors, seeing through lying Clues). Every 2 points of a score are +1 to its rolls. Constitution on gear adds no health ("+max health" does; levels use the Hero's own Constitution).
    - **Charisma** gets better prices: the Shops and the Wandering merchant pay more and charge less, 4% for each point of Charisma modifier *(v0)*. A low Charisma costs nothing.
    - **Critical chance** and **escape chance** add up across everything worn and count in steps: every full 5% of critical chance lets one more face of the d20 crit (19–20 at 5%, 18–20 at 10%, the most; a Champion one lower), and every full 5% of escape chance is +1 to Sneak Checks and Escape rolls.
    - **Damage** raises every hit, weapon or spell; **spell power** raises spells, Burst of fire included; **healing** raises potions and Cure wounds; **life steal** heals for a share of each hit; **gold find** and **magic find** raise gold and the odds of Rare and better drops; **armor** and **max health** add to Armor Class and full health.
- **Unique power:** Legendary and Mythic Items also carry a named unique power.
- **Radiant:** 1 in 200 Items of any Tier *(v0)*. It glows and gets +10% to all its numbers.
- **Upgrade level:** from +0 to +10 *(v0)*. Each level adds 4% to base damage and body armor, and 5% to its percentage and max-health Bonus stats. At +5 and again at +10, each of its ability, armor and life-steal Bonus stats gains +1, and so does a helm's or shield's armor. So every Item gains from the Forge, though a small number grows only every few levels. The Forge shows what the next level changes.
- **Trading:** everything can be traded, including Relics and worn gear.
- **The card says what it does:** gear shows its slot, its damage (dice, the range after Quality, Upgrades and Radiant, and the damage type) or its Armor Class, which Classes may wear it, and how it compares with what the Hero wears in that slot. A Wizard's or Cleric's card notes that spells ignore weapon dice. Stackables say what using one does: a potion's healing, a Chest's odds, what a Material pays for at the Forge.

### Relics

- **What they are:** named Items above the Tiers. Each has a fixed special power, a serial number ("Dragonbone Blade #2/3") and a history of its owners.
- **How many:** about 10 per Season across the whole server *(v0)*, made of 4–5 designs with 1–3 copies each. Once every copy of a design has been found, no more exist.
- **How they look:** painted art and an animated gold frame. A Broadcast goes out when one is found.

### Unidentified items

- **Which Items:** Rare and better Items drop **Unidentified**. The Tier color shows at once. Quality, Bonus stats, the unique power and Radiant stay hidden.
- **Identifying:** use an Identify scroll (20 gold *(v0)*, sold in Shops). Wizards identify for free. The reveal has its own animation.
- **Trading:** Unidentified Items can be sold and traded as gambles.

### Where loot comes from

- **Fight Rooms:** a 20% chance of an Item per fight, a 3% chance of an Iron key, plus gold *(v0)*. An elite in the group adds one Item.
- **Treasure Rooms:** 1–3 Items (60% one, 30% two, 10% three), a 20% chance of a Chest, plus gold *(v0)*.
- **Mini-bosses:** 2 Items, a 50% chance of a Chest, and ten times the gold *(v0)*.
- **Elites:** one more Item each; a Gilded one triples its gold.
- **Elsewhere:** Event rooms, Vaults and the Boss.
- **Magic find** makes every Rare-or-better chance that many percent bigger. **Gold find** adds to gold picked up.

Chances of each Tier when an Item drops *(v0)*:

| Tier | Floors 1–3 | Floors 4–6 | Floors 7–9 | Floor 10 |
|---|--:|--:|--:|--:|
| Common | 60% | 45% | 30.15% | 20.25% |
| Uncommon | 27% | 31% | 32% | 30% |
| Rare | 10% | 16% | 24% | 30% |
| Epic | 2.69% | 6.6% | 11% | 15% |
| Legendary | 0.3% | 1.3% | 2.6% | 4.3% |
| Mythic | 0.01% | 0.1% | 0.25% | 0.45% |

**What a Player should see:** about one Legendary every 2–3 days for an active Player, 1–2 Mythics per Player per Season, and about 10 Relics per Season across the server. `npm run balance:season -w @dark/engine` simulates a Season and checks the first two; on 2026-09-27 it gave a Legendary every 2.3 days and 1.8 Mythics per Player, after lowering the deep-Floor Mythic odds (from 0.4% and 0.7%) and the fight and Treasure drops. Elites came later the same day with an Item each, so the plain fight drop went from 30% to 20%: a Legendary every 2.0 days and 1.9 Mythics, counting every fight as fought.

### Bad-luck meter

The meter gains +1 for each fight won and +5 for each Mini-boss defeated. At 120 *(v0)*, the next Item that drops is Legendary or better, with a 5% chance of Mythic. Any Legendary-or-better drop resets the meter.

### Chests and keys

Chests are Items. They drop from Treasure Rooms, Mini-bosses and Event rooms. Opening one plays the **Spin**: a strip of Items scrolls past and slows to a stop on the prize, with sound and light that grow with the Tier.

| Chest | Key price *(v0)* | What's inside *(v0)* |
|---|--:|---|
| Iron | 50 gold | Uncommon 70%, Rare 22%, Epic 6.5%, Legendary 1.3%, Mythic 0.2% |
| Silver | 250 gold | Rare 70%, Epic 24%, Legendary 5%, Mythic 1% |
| Gold | 1,000 gold | Epic 75%, Legendary 21%, Mythic 4% |

Keys are sold in Shops, crafted at the Forge from Materials, and occasionally drop. Chests and Keys can be traded.

### The Forge

- **Upgrade:** what a level gives is under "What an item is made of" (Upgrade level). The chance of success at each step *(v0)*:

  | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
  |---|---|---|---|---|---|---|---|---|---|
  | 95% | 90% | 85% | 80% | 70% | 60% | 50% | 40% | 30% | 20% |

  - A failure on the way to +5 costs only the gold and Materials.
  - A failure at +6 or higher gives a 50% chance the Item drops one level and a 50% chance it is destroyed.
  - A Protection scroll turns "destroyed" into "drops one level". It burns only when it saves the Item.
  - A successful +10 is Broadcast.
  - Cost *(v0)*: 20 × (the new level)² gold, times 1 (Common), 1.5, 2.5, 4, 7, 12 or 15 (Relic). Plus Scrap for +1 to +3 (2–4), Essence for +4 to +7 (2–5), Soulstone for +8 to +10 (1–3).
- **Reforge:** rerolls all Bonus stats. Tier, Quality, Radiant and the unique power stay the same. Cost *(v0)*: Uncommon 100 gold + 3 Scrap, Rare 250 + 1 Essence, Epic 600 + 3 Essence, Legendary 2,000 + 1 Soulstone, Mythic 6,000 + 3 Soulstone, Relic 10,000 + 5 Soulstone.
- **Salvage:** breaks an Item into Materials *(v0)*, plus one more for every 3 Upgrade levels. Relics can't be salvaged.
  - Common: 1–2 Scrap. Uncommon: 2–4 Scrap.
  - Rare: 1–2 Essence. Epic: 2–4 Essence.
  - Legendary: 1 Soulstone. Mythic: 2–3 Soulstone.
- **Craft** *(v0)*: Iron key from 6 Scrap, Silver key from 4 Essence, Gold key from 2 Soulstone, Protection scroll from 3 Essence.

## Economy

- **Currency:** gold is the only currency. Everything else is an Item.
- **Where gold comes from:** fights, Treasure Rooms, selling to Shops, and wins from the Goblin gambler.
- **Where gold goes:**
  - the Market tax
  - Keys and scrolls
  - Forge costs
  - Blessings
  - losses to the gambler
  - the Wipe
- **How Items leave the game:** Graves that expire, Items destroyed at the Forge or the Cursed altar, Salvage, and Items dropped from the Bag to make room (anywhere; never Relics).
- **Buyback price:** Shops buy any Item *(v0)*:
  - base price: Common 5, Uncommon 15, Rare 60, Epic 250, Legendary 1,200, Mythic 6,000 gold
  - multiplied by (1 + item level ÷ 10)

  The price is kept low on purpose, so the Market is always the better place to sell, yet loot is never worthless. Stackables have their own small Buyback prices (a potion 6, an Iron key 12, Scrap 2…). Haggler: Shops pay 10% more and sell for 10% less. Charisma adds 4% each way for each point of its modifier, at the Shops and with the Wandering merchant *(v0)*.
- **Shops** *(v0)*: potions 25 gold, Scrolls of Identify 20, Town Portal 50, Protection 200, Fire bombs 40, Smoke bombs 30, Keys 50 / 250 / 1,000. Plus a stock of 4 Common and 2 Uncommon pieces a day, chosen for the Hero's Class and depth, at 4 times their Buyback price; each sells once per Hero per day. Shops, the Forge, the Market and the Temple only work in the City.
- **Market:** list an Item (a whole stack) at your price for up to 7 days *(v0)*. Anyone can buy it at any time. The seller receives the price minus a 5% tax, even while away in the Labyrinth. Up to 20 listings per Player; expired ones wait for the seller to take them back.
- **Blessings** *(v0)*: the Temple sells Blessing of Fortune (+25% magic find, 150 gold), of Greed (+50% gold find, 100 gold) and of Providence (the Bad-luck meter fills twice as fast, 200 gold). A Blessing lasts 3 hours and a new one replaces the old; Shrines give them for free.
- **Direct trade:** two Players in the City swap Items and gold, and both confirm. No tax.
- **Auctions** (a later Season): 24-hour bidding for top Items.

## Social and PvP

### Feed and broadcasts

- **No in-game chat.** Friends talk on Discord.
- **The Feed:** the Tavern shows notable drops, deaths, Market sales, records, weekly bounties, the week's Hunt, hidden rooms found, attempts at the Boss, and Graves looted by anyone but their owner (with the best Tier taken, from Rare up).
- **Broadcasts:** the game posts to the friends' Discord channel through a webhook when:
  - a Mythic or a Relic is found
  - a Radiant Legendary or better drops
  - an Upgrade to +10 succeeds
  - the Boss is defeated (Champion, 2nd and 3rd)
  - a Vault is announced
  - the day's Omen, at midnight UTC, just after a recap of the past day: up to five of its best moments from the Feed (a Hero's deepest new Floor only), then who fell. A quiet day has no recap.
  - the Boss gate opens
  - the Boss weakens
  - a Season starts or ends
  - someone new signs in and waits at the gate, and when an admin lets them in (nothing else tells either of them)
  - an admin posts an announcement (the admin page's Announce tab), which also goes into the Feed and, for Players who want news, out as a Notification

  Ordinary Legendaries are not Broadcast, to avoid spam.

### Notifications *(v0)*

A Player can turn on push notifications for each phone or browser in the Account sheet. They go to that device even when the game is closed:

- **Stamina is full:** once each time a Hero's bar fills. Nothing is sent if the Player has been on the site since it filled.
- **A Camp rest is done:** four hours in a Camp, when the rest gives something back (health, abilities, Stamina or short rests). It also covers the Stamina it filled.
- **Something sells on the Market:** the Item, the buyer, the price and the seller's share.
- **A place in the Daily Delve's first three,** and the Chest that waits at the Well.
- **An invite to a Duo.**
- **The Boss gate opens.**

Each kind can be turned off. Nothing arrives between 23:00 and 08:00 on the device's own clock; what comes due at night arrives in the morning. On an iPhone, notifications only work once the game is on the Home Screen.

### Duos *(v0)*

Two friends walk the Labyrinth together, while both are online.

- **Forming:** the City's Duo card lists the Heroes whose Players are online and in the City, and not in a Duo. An invite lasts 10 minutes and also comes as a Notification; one invite out at a time. Accepting makes the two Heroes a Duo, and each is the other's **Partner**.
- **Going in:** either Player enters, and both Heroes go: at Floor 1, or at a Waypoint both have woken. A Town Portal takes one Hero, so a Duo can't step back through one.
- **Either Player leads:** every Move, fight, Sneak and Retreat takes the Duo. Each Hero pays its own Stamina: a Room is free for a Hero only when it has stood there and nothing new waits there for either Hero. A Door either Hero can get through lets both through (a Rogue picks the lock; otherwise one Iron key goes, the leader's first). Cracked walls either Hero could break, and secret Doors either spots, show to both.
- **Monsters:** a Duo meets two of the Floor's groups, each monster with 30% more health and hitting 20% harder on Floors 1–6, and 15% more health from Floor 7 *(v0)*: with both played by the AI, a Duo wins and dies about as often as a Hero alone. A Mini-boss has 2.2 times that health and hits 25% harder again *(v0)*: nobody runs in a Duo fight, so a pair beats it more often than a Hero alone beats its own (alone, a Hero sometimes retreats), and dies about as often (balance:duo-boss). The pair meets the same group all day. Monsters either Hero hasn't beaten today wait for both, and the Threat shown is rated with the partner in the fight.
- **Fights:** one fight, side by side, played turn by turn: each Player chooses for its own Hero on its turns (Manual fights). A turn left 30 seconds goes to the AI *(v0)*, counted once the moves before it can have played on screen (2 seconds for the next look and 0.8 a move, at most 12), and a Player who is no longer online hands its Hero to the AI for the rest. Both Heroes roll initiative; a monster picks a standing Hero to attack, and a breath or a blast hits both (each saves). Nobody runs.
- **Teamwork:**
  - **Help:** the partner's next attack has advantage.
  - **Guard:** until the Guard's next turn, blows meant for the partner come to it instead.
  - **A fallen partner** stays down and makes a death save on each of its turns, until it is stable, dead, or back up. **Pull up** stands it with a quarter of its health on a WIS check against 10 *(v0)*, Clerics adding their proficiency; a Cleric's Cure wounds raises it too. Still down when the Duo wins, it is hauled up and shares the win.
  - **Together:** a Rogue gets its full Sneak attack on a monster its partner went for this round, and a Hunter's mark counts for both Heroes.
- **Rewards:** each Hero takes 65% of the fight's XP and of its gold *(v0)*, rolls its own drops, and finds its own event, Vault and hidden hoard in a Room. Treasure found together goes into one Duo Chest (Trust and greed, below).
- **Sneaking:** a group Check: each Hero rolls, and one success takes both past. A Smoke bomb covers both. Past a Mini-boss only if both could Sneak past it alone.
- **Home:** leaving by a Waypoint or the entrance takes both home, still a Duo. Each Hero's Run is its own.
- **The Boss** is faced alone: a Duo can't go into the lair *(v0)*.
- **Twin doors:** see below.
- **Away:** a Player not seen for 2 minutes is away, and the Duo waits: the other Player can't lead it until they're back, or leaves the Duo. After 30 minutes away the Duo ends by itself.
- **Ending:** either Player can leave the Duo at any time. A death, or reading a Town Portal, also ends it. The other Hero goes on alone from where it stands.
- **Seeing it:** while in a Duo the game looks every few seconds for what the partner did. The partner's fights, loot and notes come up on the next look.

#### Twin doors *(v0)*

- **Where:** one Room on every Floor from 1 to 9 waits behind a **Twin door**, two stone hands side by side: a dead end where the Floor has one free, otherwise a Room that is never the only way to anywhere (every Door into it is then a Twin door). Its Clue is always true. Like the Floor's other later additions, it was placed apart from the rest, so no other Room changed.
- **Opening:** it opens only for a Duo. Alone, a Hero sees the Door and can't go through; anyone walks out. A Hero left alone in the doorway (its Duo over) steps back out.
- **The Twin Wardens:** inside wait the Dawn Warden (it mends its twin once) and the Dusk Warden (it drinks the life it strikes). One felled while its twin stands rises at the end of the round with half its health; only both falling in the same round ends them. No Sneaking past them, and no Duo toughening on top: their numbers are a Duo's already, growing with the Floor like its own monsters, so for the Heroes who reach it they are about as hard as that Floor's Mini-boss is for one Hero alone (balance:twins).
- **On Auto,** a Hero goes for the healthier Warden, so both wear down together; played by hand, the Players can do better.
- **The prize:** each Hero takes its share of the fight's XP and gold (ten times a fight Room's, like a Mini-boss), 2 Items with the odds of two Floors deeper, and, when both stand at the end, a half of a pair of **Bond rings**. The Feed tells everyone.
- **Coming back:** the Wardens wake for a Hero a week after it beat them. A Duo meets them while either Hero hasn't beaten them this week, and both are paid.
- **The hoard is shared:** when both Heroes stand at the end, the Wardens' hoard (2 Items each) goes into one Duo Chest (Trust and greed, below).
- **Bond rings:** a pair of one Tier, Rare or Epic (as the odds two Floors deeper weigh those two), identified, each half with its own Quality and Bonus stats from the ones that count in a fight (abilities but Charisma, armor, damage, critical chance, spell power, healing, life steal). While the two Heroes of a Duo each wear a half of one pair, the halves count their Bonus stats **twice** in their fights; otherwise each is a ring of its Tier. A Bond ring goes into the Bag even when it is full, never drops or sells at random, and keeps to its stats when Reforged or offered at the Cursed altar.

#### Trust and greed *(v0)*

Two things a Duo decides between its own two Players.

- **Oathstones:** one quiet Room on every Floor from 1 to 9 holds an Oathstone, placed apart from the rest like the Twin doors (its Clues are true). Alone, it is silent. A Duo standing at it swears by it in secret: each Player chooses **Share** or **Take**, neither sees the other's oath until both have sworn, and a sworn oath stands.
  - **Both share:** each Hero gets a gift, an Item of Rare or better with the odds of three Floors deeper. A gift goes into the Bag even when it is full.
  - **One takes:** the taker gets both gifts, the other nothing, and the Feed tells everyone.
  - **Both take:** the stone cracks and curses them both. The Oathbreaker's curse takes the Blessing's place for 3 hours (half the gold, −25% magic find), driving out any Blessing.
  - A Hero swears at a given stone once a week; it answers a Duo while neither has sworn there this week. The Feed also tells of oaths kept and stones cracked.
- **Duo Chests:** Treasure a Duo walks in on together, and the Twin Wardens' hoard when both stand at the end, goes into one Duo Chest.
  - Each Hero rolls its own share as it would alone (its magic find, the Bad-luck meter) and keeps its own gold and Chest drops. Only the Items are pooled.
  - The Players pick in turns, a coin deciding who goes first. A pick left 30 seconds takes the best Item left (Tier, then item level) for that Player.
  - A Hero whose Bag is full is skipped; once neither can carry more, the rest stays behind.
  - Walking on, going home, reading a portal or the Duo ending picks the rest in turn.

### Rankings

The Tavern's Rankings show the current Season's records, one board each, with a podium for the first three, the rest of the top ten under it, and the Player's own place when it is lower. Equal values share a place. Each Hero shows with the Title it wears.

| Board | What it counts |
| --- | --- |
| Deepest | The deepest Floor a Hero has reached. A Player's best Hero counts, retired or not. |
| Level | A Hero's level. XP orders a tie within its place. |
| Richest | Gold in the City plus gold carried, for the Hero played now. |
| Victories | Fights won this Season, by all of a Player's Heroes. |
| Deeds | Deeds done by a Player's best Hero on it. |
| Finest Item | The best identified Item a Hero has, worn, in the Bag or in Storage: Tier first, then Upgrade, then item level. |
| Graves | Other Heroes' Graves looted. |
| Vaults | Vaults emptied. |
| Deaths | Deaths. Glory of a kind. |
| The Dragon | The Boss podium: the Champion, then second and third from the Finale. |

A board leaves out anyone with nothing to show on it yet. The Rankings end with the Wipe; the Hall of Fame keeps the records that last.

### PvP encounters (from Season 1)

- **Attacking:** when two Heroes are in the same Room outside a Camp, either one can attack.
- **Escaping:** the attacked Hero gets one **Escape roll**, a DEX Check, as in fights against monsters. Rogues and escape Bonus stats help. If it fails, they fight to the end.
- **Choosing:** a Player who is online chooses on the spot. A waiting Hero follows its Stance: a Bold one stands and fights, Steady and Wary ones try to escape.
- **Result:** the winner takes everything the loser Carried. There are no Death saves in PvP.

### Later Seasons

- **More for Duos:** Rooms and bosses for Duos only, and the Boss faced together: a Duo that defeats it are co-Champions.
- **Guilds:** up to 4–5 members, with shared storage. Guild members can't attack each other, and the Champion's Guild banner hangs in the Hall of Fame.
- **Arena tournaments:** brackets with nothing to lose; the loser is simply knocked out.
- **Tavern games:** coin flips, dice and shared gold pots, with a cut for the house.
- **A Discord bot:** direct messages ("your Hero was attacked", "your listing sold") and slash commands.

## Look and feel

- **Style:** ink and shadow, with heavy black lines, muted colors and a gothic comic look, all **seen from above** like a D&D table.
  - The City is an inked town map, and Rooms are battle maps.
  - Heroes and monsters are round tokens: a portrait in a ring.
  - The world is kept muted so that Tier colors are always the brightest thing on screen.
- **Hero and equipment screens:** front-facing portraits and a Diablo-style equipment layout.
- **Item art:**
  - Common to Epic: game-icons.net icons, recolored by Tier.
  - Legendary, Mythic and Relics: unique painted art.
- **Animated scenes (PixiJS):**
  - Fight playback: tokens slide, strike, shake and flash, with damage numbers and dice at key moments.
  - The Chest Spin and the identify reveal.
  - Drop effects that grow with the Tier: beams of light, particles, and screen shake for Mythic and above.
- **Sound:**
  - Effects from free sound libraries: dice, hits, doors, and reveals that get bigger with each Tier.
  - Android phones vibrate on Mythic-or-better drops and natural 20s. (iPhones don't let websites vibrate.)
  - Music comes later.
- **Where the art comes from:** ChatGPT image generation, always using one fixed style description. For Season 0 that means:
  - about 15–20 Room maps per Floor theme
  - 2 portraits per Race and Class pair (32 in total)
  - monster tokens for each monster family
  - the Dragon
- **UI look: B · Crypt**, chosen in the look test on 2026-09-27:
  - dark stone panels with a faint texture
  - tarnished-brass borders with corner brackets
  - Alegreya SC small caps for headings, Alegreya for body text (both have Cyrillic)
  - blood-red primary buttons and gold highlights
- **The Labyrinth screen: layout B**, chosen on 2026-09-28:
  - The Room fills the screen's width as a stage. Its Doors are arrows on the stage, and the same Doors, with their Clues, are listed under it as "Where next".
  - A status strip across the top of the stage shows the Hero's portrait, level, Floor, health and Stamina, with round Map and Bag buttons.
  - The belt runs along the bottom of the stage. The Hero's class features are on the left: diamonds count the uses left until a rest, a dashed frame means always on, and a lock means a later level brings it. On the right are the Potions, Bombs and Town Portal scrolls in the Bag, with how many. Tapping one shows what it does now, in numbers, and what it becomes later. A Potion can be drunk and a scroll read from there.
  - Anything that needs the Player comes up as a card in the middle of the screen: monsters in the doorway, an event, what just happened, the Map and the Bag. Monsters and a waiting event come up by themselves. The Player can put them aside to look around first, and a button under the stage brings them back.
- **Look test:** done on 2026-09-27. It is kept on the `prototype/look-test` branch (`npm run look-test` there). The image prompts are in [art/look-test-prompts.md](art/look-test-prompts.md).

## Scope

### Season 0 (target 2026-11-06)

**In:**
- **Heroes:** creating a Hero (4 Races, 4 Classes, rolled ability scores, origin Talents, portraits) and Retiring.
- **City:** Tavern, Shops, Forge, Market, Temple and the Labyrinth gate.
- **Labyrinth:** full size, with Stamina, Clues, the Map, Waypoints, Town Portals and Camps.
- **Fights:** played back with dice, Death saves and Graves.
- **Loot:**
  - Tiers, Quality, Bonus stats, Radiant, Unidentified Items and Relics
  - Chests and Keys
  - Upgrade, Reforge, Salvage and crafting
  - the Bad-luck meter
- **Rooms:** the Season 0 event rooms, Vaults and their announcements, Mini-bosses, and the Dragon.
- **The Season itself:** the timeline, the Wipe and the Hall of Fame.
- **Social:** the Feed, Broadcasts and Duos.
- **Everything else:** the admin page, Russian and English, sound effects, and the hub card.

**Later Seasons:** PvP Encounters, Duo-only Rooms and the Boss for Duos, Auctions, Academy, Training grounds, Houses, Arena, Guilds, tavern games, the shell game, Map copies, a Discord bot, music, and more Classes and Races.

**If we fall behind (proposal, to settle in the build plan):** cut in this order:
1. the lockpicking minigame
2. Vault announcements (Vaults stay, just unannounced)
3. the Wandering merchant and the Goblin gambler
4. Reforge
5. Radiant animation polish

## Credits and licenses

The credits are on the account sheet (Account → Credits) and in the README.

- **D&D rules, Class names and Race names:** from the System Reference Document 5.2 by Wizards of the Coast, licensed CC BY 4.0. The credits include the SRD attribution statement word for word.
- **Icons:** from game-icons.net by Lorc, Delapouite, Willdabeast and DarkZaitzev, licensed CC BY 3.0.
- **Sound effects:** Kenney's RPG Audio and Casino Audio packs, CC0 (credited anyway).
