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

- **Who can play:** 5–15 friends and people they know. Only Players an admin has approved can create a Hero. (The hub lets any Discord account sign in, so approval is the real gate.)
- **Sign-in:** through the ugolok.world hub's shared Discord login. The game shows up as a card on the hub dashboard (Hero level, deepest Floor, best Item) and on the hub landing page.
- **Languages:** Russian and English from the first version. The hub passes the language along with `?lang=`.
- **Devices:** designed for a phone held upright first, and comfortable on desktop too. It can be installed as a PWA.
- **Money:** no real money, ever. No purchases, no donations for perks, no cash-out.
- **Game clock:** Astana time (UTC+5). Players see times in their own time zone.

## Seasons

- **Length:** a Season lasts about 4–6 weeks. It starts with a newly generated Labyrinth and ends with a Wipe.
- **Boss gate:** opens on day 14 *(v0)*. Until then nobody can reach the Boss.
- **Champion and Finale:** the first Player to defeat the Boss becomes Champion. From the Season that adds Duos onward, a Duo can win together and both become Champions. The victory starts the **Finale**: 72 hours in which others can still beat the Boss for 2nd and 3rd place, and make last trades and gambles. Every attempt at the Boss is a separate fight against a Boss at full health.
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

Each Player has one Hero per Season. Fights are automatic in Season 0: the Player decides whether to fight and in which Stance (see Before a fight), then watches. More control in fights may come later.

### Creating a hero

1. **Race and Class:** choose one of each.
2. **Ability scores:** for each score, roll 4d6 and drop the lowest die, with the dice rolling on screen.
   - The Player may reroll the whole set up to 3 times and keep whichever set they like.
   - A set that totals less than 65 *(v0)* is rerolled automatically and doesn't count toward the 3.
3. **Talents:** choose one origin Talent. Humans choose two.
4. **Look:** choose a portrait from the set for that Race and Class, a name and a banner color.
5. **Start:** the Hero receives its Starter kit and 100 gold *(v0)*, and appears in the Tavern.

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

This list exists so the Human's extra Talent has something to choose from in Season 0. Academy Talents come later.

| Talent | Effect |
|---|---|
| Alert | +5 to initiative. |
| Tough | +2 health per level. |
| Savage attacker | Roll weapon damage twice and keep the higher, once per turn. |
| Lucky charm | Once per Run, reroll any one d20. |
| Haggler | Shops pay 10% more and sell for 10% less. |
| Field medic | Potions heal 50% more. |

### Classes

Season 0 starts with the classic party of four. Each later Season adds two Classes.

| Class | Hit die | In fights | In the Labyrinth |
|---|---|---|---|
| Fighter | d10 | Most health, heavy armor, extra attacks. Second wind heals once per fight. | Smashes cracked walls to open shortcuts other Classes can't use. |
| Rogue | d8 | Critical hits, strikes first. A full Sneak attack (half its level in d6) on the first hit of a fight, and a smaller one (a sixth of its level) on its first hit of each later round. | Picks locks, disarms traps, spots lying Clues, has the best odds on Sneaking and Escape rolls. |
| Wizard | d6 | Big spell damage but fragile. Limited spells per rest. **Shield:** the first blow of every fight that would hit is turned aside *(v0)*. | Senses traps and curses. Identifies Items for free. |
| Cleric | d8 | Heals itself. Its spells are deadly to undead. | Rolls with advantage at Shrines. |

Planned order (it can change): Season 1 Barbarian and Ranger, Season 2 Paladin and Warlock, Season 3 Bard and Sorcerer, then Druid and Monk.

### Proficiencies

Weapons and armor come in types. Each Class can use some of the types, and the types overlap, so every drop has more than one possible buyer. Head, hands, feet, amulet and ring Items can be worn by every Class.

| Type | Fighter | Rogue | Wizard | Cleric |
|---|:-:|:-:|:-:|:-:|
| Heavy weapons (greatswords, greataxes, mauls) | ✓ | | | |
| Blades (longswords, sabers, rapiers) | ✓ | ✓ | | |
| Daggers | ✓ | ✓ | ✓ | |
| Bows and crossbows | ✓ | ✓ | | |
| Maces and hammers | ✓ | | | ✓ |
| Staves and wands | | | ✓ | ✓ |
| Shields | ✓ | | | ✓ |
| Orbs (off-hand) | | | ✓ | |
| Holy symbols (off-hand) | | | | ✓ |
| Heavy armor | ✓ | | | |
| Medium armor | ✓ | | | ✓ |
| Light armor | ✓ | ✓ | | ✓ |
| Robes | | | ✓ | ✓ |

Robes are woven with wards: Armor Class 13 + the full DEX modifier *(v0)*, like the SRD's Mage armor, so a caster's body armor grows with Quality and Upgrades too.

### Levels, health and power

- **Levels:** a Hero goes from level 1 to 20 each Season. XP comes from fights, events and reaching a new Floor for the first time (50 × the Floor's number *(v0)*). An active Player should be about level 10 when the Boss gate opens and level 18–20 by the end of the Season *(v0)*.
- **Health on level-up:** roll the Class hit die, but never take less than its average. For example, a d10 always gives at least 6.
- **Growing:** at level 3 the Player chooses a Path; at levels 4, 8, 12, 16 and 19, +2 to one ability score, +1 to two, or a new Talent (see Growing: Paths and Talents).
- **Where power comes from:** about 70% from gear and 30% from the Hero itself (level, ability scores, Talents, and later Academy Talents and training).
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

  Each Class has one Path built for the Boss and one for the long road: Thief, Abjurer and Life trade damage for gold, safety and healing.
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

### Retiring

Once per Season, a Player may Retire their Hero at the Temple and create a new one, with a new Race, Class and ability roll, starting at level 1. Gold and Storage are kept, and the old Hero's gear moves into Storage. It is also the only way to try another Path.

## Dice and fights

The rules are a light version of the D&D System Reference Document (SRD 5.2).

- **Checks:** roll a d20, add the ability modifier (plus proficiency when it applies), and compare the total with a difficulty. Advantage means roll two d20s and keep the higher. Disadvantage means keep the lower.
- **Natural 20 and natural 1:** on an attack, a natural 20 is a critical hit (damage dice doubled) and a natural 1 always misses. On a Check, a natural 20 gives the best outcome and a natural 1 the worst.
- **How fights work:** when a Hero enters a fight Room, the server works out the whole fight at once and the screen plays it back. The fight uses initiative (d20 + DEX), attack rolls against Armor Class, and damage dice. Tokens move and strike on the Room's battle map. In Season 0, where a token stands is only for show.
- **Dice shown on screen:**
  - ability rolls when creating a Hero
  - critical hits and natural 1s
  - Death saves and Escape rolls
  - traps and event Checks

  Ordinary attacks just show hit or miss, so fights stay easy to follow.
- **Before a fight:** see below.
- **Abilities:** some work once per fight. Others have a few uses per rest, and those come back after a long rest at a Camp or on returning to the City.
- **Health:** damage carries over from Room to Room. Heroes heal with potions, Shrines, Cleric spells, a long rest at a Camp, or fully in the City. Waiting anywhere in the Labyrinth also heals, slowly: a twentieth of full health an hour *(v0)*, so a Hero left near death overnight can still walk out.
- **Healing potions** *(v0)*: 2d4 + 2 plus a tenth of the Hero's full health, so they still matter deep down. In a fight a Hero drinks one below 30% health, at most 3 per fight.
- **Monsters:** they come in groups, and deeper Floors have stronger ones. Each kind has a power of its own (see Monsters below).
- **Saving throws:** some powers call for a save: a d20 plus the ability modifier, plus proficiency in the Class's two saves (Fighter STR and CON, Rogue DEX and INT, Wizard INT and WIS, Cleric WIS and CHA). The DC is set by the power, +1 for every two Floors deeper into its theme.
- **Weapons wound differently:** slashing (swords, axes), piercing (rapiers, daggers, bows) or blunt (maces, hammers, mauls, staves). It matters against some monsters.

### Monsters

Every monster has a signature power, so a fight plays differently depending on who is in it. The Door's Threat already counts them, and the Player sees them before choosing (Before a fight). Season 0's bestiary *(v0)*:

| Floors | Monster | Power |
|---|---|---|
| 1–3 | Giant rat, Goblin | none |
| 1–3 | Goblin archer | **Quick:** +5 to initiative |
| 1–3 | Goblin cutpurse | **Thief:** a hit snatches carried gold, 2d10 × (Floors into the theme + 1). It runs with it on its next turn unless it falls first. The gold that gets away is lost. |
| 1–3 | Wolf | **Pack hunter:** advantage while another monster still stands |
| 4–6 | Skeleton | **Brittle bones:** blunt weapons deal +50%, piercing ones −25% |
| 4–6 | Zombie | **Undying:** half the time, the first killing blow that isn't a critical hit leaves it at 1 health |
| 4–6 | Ghoul | **Paralyzing touch:** a hit calls for a CON save (DC 10), or the Hero loses its next turn |
| 4–6 | Wraith | **Life drain:** heals itself for half the damage it deals |
| 7–9 | Cultist | **Dark mending:** once per fight, instead of attacking, heals an ally below half health by 2d8 |
| 7–9 | Imp | **Hellfire:** a hit sets the Hero burning, 1d4 at the start of its next 2 turns |
| 7–9 | Hellhound | **Fire breath:** 3d6, DEX save (DC 13) for half. Ready at the start, and again on a 5–6 on a d6 each turn |
| 7–9 | Demon brute | **Several attacks:** two a turn |
| 10 | Kobold | **Pack hunter** |
| 10 | Drake | **Fire breath:** 7d6, DC 15 |
| any | Mimic | Bites before the Hero can move: the Hero is surprised. |

- **Deeper is harder** *(v0)*: gear keeps getting better, so the monsters do too.
  - Each Floor into a theme adds 15% health and +1 to hit and to damage.
  - On top of that, every Floor below Floor 2 adds 20% health, +0.75 to hit and +0.55 damage (rounded), so a Floor 9 monster has 2.4 times its Floor-1 health and +5 to hit and +4 damage from depth alone. Floors 1 and 2 stay gentle for new Heroes.
  - The Mimic and the Doppelganger, which turn up anywhere, grow like the Floor's own monsters. The Dragon is measured on its own (700 health, AC 20).
  - The aim, checked with `npm run balance:par -w @dark/engine`: on the Floor a typical Hero has just reached, a fight costs about a quarter of its health, most Rooms read Trivial or Easy at full health with a few Dangerous ones, and the Floor's Mini-boss is a real fight. The Dragon at full strength needs about level 18–20 and late-Season gear.
- **Mini-bosses** come with an escort:
  - the Goblin chieftain with a Goblin archer
  - the Bone knight, which is **Undying**, with a Skeleton
  - the Horned tyrant (two attacks a turn, and **Terrifying**: a WIS save as the fight starts, DC 14, or 2 rounds of disadvantage on attacks) with an Imp
- **The Dragon:**
  - **Terrifying** (DC 14).
  - **Fire breath:** 10d6, DEX DC 16.
  - Two attacks a turn.
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
  - Paralyzed: the next turn is lost.
  - Frightened: disadvantage on attacks.

### Before a fight

Opening the Door of a Room with monsters doesn't start the fight. The Hero stops in the doorway, the Player sees who is there, and chooses. Until then the Room's other Doors stay shut.

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
| Tavern | Season 0 | Where Heroes appear. Your room here holds your Storage. Shows who is online, rumors about the Labyrinth, the Feed, and your bounties. Later you can also find a Duo partner and play tavern games here. |
| Shops | Season 0 | Sell Common and Uncommon gear, potions, scrolls (Identify, Town Portal, Protection) and Keys. Buy any Item at its Buyback price. |
| Forge | Season 0 | Upgrade, Reforge, Salvage, and craft Keys and scrolls from Materials. |
| Market | Season 0 | Players list Items at their own price, and anyone can buy at any time. |
| Temple | Season 0 | Where Heroes wake after death. Sells Blessings. You Retire your Hero here. |
| Labyrinth gate | Season 0 | Enter the Labyrinth at the entrance or at any Waypoint your Hero has reached. |
| Academy | later | Learn passive Talents for gold. |
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

- **Moving:** each Move is instant and costs 1 Stamina.
- **Stamina:** up to 20, and 1 point refills every 24 minutes, so an empty bar is full again after 8 hours *(v0)*. A Player who checks in 2–3 times a day makes about 40–60 Moves.
- **Only Moves cost Stamina.** City actions, Waypoints and Town Portals are free.

### Doors, clues and the map

- **Clues:** every Door carries a Clue about the Room behind it, such as "growling behind the door", "a faint golden glow" or "the smell of sulfur". About 80% of Clues are true and 20% lie *(v0)*.
- **Spotting lies:** Rogues and Elves make a WIS Check (DC 13 *(v0)*) to mark a lying Clue as suspicious, and Elves roll it with advantage.
- **Special doors:** cracked walls, which only a Fighter can smash through; locked Doors, which need a Key or a Rogue; and secret Doors (see Hidden rooms).
- **The Map:** each Player's Map shows every Room and Door their Hero has seen this Season. Everything else stays dark. Maps can't be shared in Season 0. (An idea for later: sell copies of your Map on the Market.)

### Room types

| Room | How many *(v0)* | Notes |
|---|---|---|
| Fight | ~50% of a Floor | A group of monsters. Personal: every Hero meets its own. Its Door shows them and their Threat first (Before a fight). A Room a Hero has cleared stays clear for that Hero for 24 hours. |
| Empty | ~15% | Nothing happens, or just a line of description. |
| Event room | ~15% | See the table below. Personal. |
| Treasure | ~7% | Loose loot, sometimes a Chest. Personal. |
| Camp | 3–5 per Floor | Safe place to leave a waiting Hero. |
| Stairs | 2–4 per Floor | Lead down to the next Floor, and back up. |
| Waypoint | 1 per Floor | Once reached, you can enter or leave the Labyrinth here. |
| Vault | 1–2 per Floor | Special room: see below. |
| Mini-boss | 1 per Floor | Special room: see below. |
| Hidden room | 1–2 per Floor (not the lair) | Behind a secret Door: see below. Personal. |

### Event rooms (Season 0)

| Event | What happens |
|---|---|
| Three chests | Pick one of three: one holds gold, two hold an Item each, and 30% of the time one of those is a mimic, which means a fight in which the mimic strikes first *(v0)*. |
| Shrine | Pray for a random Blessing, at the risk of a curse. A WIS Check against 12; failing by 5 or more (or a natural 1) burns a quarter of max health. Clerics roll with advantage, and Wizards sense the curse and step back *(v0)*. |
| Goblin gambler | Double-or-nothing on carried gold: both roll a d20 and ties go to the goblin. Or bet an Item for one a Tier higher (not Mythics or Relics). One bet per visit *(v0)*. |
| Wandering merchant | Sells 3 rare Items (Rare, Epic, sometimes Legendary) at 6 times the Buyback price, and buys yours at twice the Buyback price *(v0)*. |
| Trapped corridor | A DEX Check (11 + half the Floor) to get through unhurt, or take 2d6 + the Floor number in damage, never below 1 health. A Rogue disarms it; Wizards roll with advantage *(v0)*. |
| Cursed altar | Offer a Common, Uncommon or Rare Item: 40% chance its Tier goes up by one and it gains a Bonus stat, 60% it is destroyed *(v0)*. |
| Locked cache | Needs an Iron key or a Rogue. Two Items with the odds of three Floors deeper, plus gold *(v0)*. |
| Lockpicking | A 10–20 second minigame: stop the moving pin in the sweet spot. Rogues get a wider sweet spot. Until the minigame is built it is a DEX Check against 14 (Rogues with advantage), and success gives a Chest. |
| Fountain | Drink: a plain d20 on screen. 1–4 foul (a fifth of full health lost), 5–12 clean (half of it back), 13–19 glowing (all of it, and abilities restored), 20 a spirit (all that, and a Blessing) *(v0)*. |
| Prisoner | Free them with an Iron key, or a Rogue picks the chains. 80% they give an Item with the odds of two Floors deeper and gold; 20% a doppelganger that strikes first *(v0)*. |
| Library | Read a tome: an INT Check against 11 + half the Floor number (Wizards add proficiency and roll with advantage). Success teaches 60 XP per Floor number; failing by 5 or more, or a natural 1, costs a tenth of full health *(v0)*. |
| Bone pile | Search: an old adventurer's purse, 10–40 × (Floor + 1) gold and half the time an Item. 35% of the time the bones rise first and strike first: one Skeleton, two from Floor 4 *(v0)*. |
| Riddling statue | A stone head asks a folk riddle, with three answers to choose from. Right: 50 XP per Floor number, and it points out the Floor's secret Door if the Hero hasn't found it (the room behind goes on the Map). Wrong: its eyes burn 15% of full health, never below 1 *(v0)*. |

- **Daily and personal:** what an Event room holds comes from the Hero, the Room and the day, so leaving and coming back doesn't reroll it. Each Event room works once a day per Hero (the merchant sells until his wares are gone).
- **Luck:** a Hero with the Lucky charm or the Luckstone rerolls one failed Check or death save per Run and keeps the better roll.

Later: the shell game (a goblin hides a gem under one of three cups) and more minigames.

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

### Waiting heroes and camps

- **Waiting:** when the Player stops playing, their Hero stays in the Room where it is.
- **Monsters never attack a waiting Hero.**
- **From Season 1 (PvP):** a waiting Hero outside a Camp can be attacked by other Players, and it reacts according to its Stance. Heroes in Camps are always safe.
- **Long rest:** a Hero that waits at least 4 hours in a Camp *(v0)* comes back with full health and all its abilities.

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

- **Base:** the item type (e.g. longsword) and its item level, which comes from the Floor it dropped on. Together they set its base damage or armor.
- **Tier:** Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange), Mythic (red).
- **Quality:** a 1–100% roll, evenly spread *(v0)*. It scales base damage or armor from 85% to 115%.
- **Bonus stats:**
  - Common has 0, Uncommon 1, Rare 2, Epic 3, Legendary 4, Mythic 5.
  - They come from a pool of about 15 kinds: ability scores, max health, armor, damage %, critical chance, spell power, healing, escape chance, gold find, magic find, resistances and life steal.
  - Each is rolled within a range that grows with item level and Tier *(v0)*. Ability scores, armor and life steal are the exception: the first two live on the d20, where every point counts, and life steal stacked across a whole kit makes a Hero nothing can wear down, so they grow with Tier only, one point more at Epic and another at Relic.
- **Unique power:** Legendary and Mythic Items also carry a named unique power.
- **Radiant:** 1 in 200 Items of any Tier *(v0)*. It glows and gets +10% to all its numbers.
- **Upgrade level:** from +0 to +10. Each level adds +4% base damage or armor *(v0)*.
- **Trading:** everything can be traded, including Relics and worn gear.

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

- **Upgrade:** the chance of success at each step *(v0)*:

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

  The price is kept low on purpose, so the Market is always the better place to sell, yet loot is never worthless. Stackables have their own small Buyback prices (a potion 6, an Iron key 12, Scrap 2…). Haggler: Shops pay 10% more and sell for 10% less.
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

  Ordinary Legendaries are not Broadcast, to avoid spam.

### PvP encounters (from Season 1)

- **Attacking:** when two Heroes are in the same Room outside a Camp, either one can attack.
- **Escaping:** the attacked Hero gets one **Escape roll**, a DEX Check, as in fights against monsters. Rogues and escape Bonus stats help. If it fails, they fight to the end.
- **Choosing:** a Player who is online chooses on the spot. A waiting Hero follows its Stance: a Bold one stands and fights, Steady and Wary ones try to escape.
- **Result:** the winner takes everything the loser Carried. There are no Death saves in PvP.

### Later Seasons

- **Duos:** invite a friend and both Heroes do the same Run. Each gets its own loot rolls. Some Rooms and bosses are for Duos only. A Duo that defeats the Boss are co-Champions.
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
- **Social:** the Feed and Broadcasts.
- **Everything else:** the admin page, Russian and English, sound effects, and the hub card.

**Later Seasons:** PvP Encounters, Duos, Auctions, Academy, Training grounds, Houses, Arena, Guilds, tavern games, the shell game, Map copies, a Discord bot, music, and more Classes and Races.

**If we fall behind (proposal, to settle in the build plan):** cut in this order:
1. the lockpicking minigame
2. Vault announcements (Vaults stay, just unannounced)
3. the Wandering merchant and the Goblin gambler
4. Reforge
5. Radiant animation polish

## Credits and licenses

The credits are on the account sheet (Account → Credits) and in the README.

- **D&D rules, Class names and Race names:** from the System Reference Document 5.2 by Wizards of the Coast, licensed CC BY 4.0. The credits include the SRD attribution statement word for word.
- **Icons:** from game-icons.net by Lorc, Delapouite and Willdabeast, licensed CC BY 3.0.
- **Sound effects:** Kenney's RPG Audio and Casino Audio packs, CC0 (credited anyway).
