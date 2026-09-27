# Dark Corner: Game Design

**Тёмный уголок / Dark Corner** · `dark.ugolok.world`

The owner and Claude agreed on this design in an interview held 2026-09-24 → 2026-09-27. Season 0 opens around **2026-11-06**.
Terms follow [CONTEXT.md](../CONTEXT.md). Numbers tagged *(v0)* are starting values. We simulate them before launch and tune them during Season 0.

## The game

5–15 friends each create a D&D-style Hero, wake up in a dark-fantasy City, and go down into one huge shared Labyrinth. The Hero fights on its own. The Player chooses which doors to open, which gambles to take and when to go home. Loot is everything: it comes in tiers, its stats are rolled at random, it can be traded, and you lose it when you die. The first Player to kill the Season's Boss at the bottom becomes Champion. Three days later everything is wiped and a new Season begins.

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
- **Wipe:** Heroes, Items, gold and Maps are erased. **Glory** survives:
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

Each Player has one Hero per Season. Fights are automatic in Season 0. Player control in fights may come later.

### Creating a hero

1. **Race and Class:** choose one of each.
2. **Ability scores:** for each score, roll 4d6 and drop the lowest die, with the dice rolling on screen.
   - The Player may reroll the whole set up to 3 times and keep whichever set they like.
   - A set that totals less than 65 *(v0)* is rerolled automatically and doesn't count toward the 3.
3. **Talents:** choose one origin Talent. Humans choose two.
4. **Look:** choose a portrait from the set for that Race and Class, a name and a banner color.
5. **Start:** the Hero receives its Starter kit and appears in the Tavern.

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
| Rogue | d8 | Critical hits, strikes first, Sneak attack on the first hit of a fight. | Picks locks, disarms traps, spots lying Clues, has the best odds on Escape rolls. |
| Wizard | d6 | Big spell damage but fragile. Limited spells per rest. | Senses traps and curses. Identifies Items for free. |
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

### Levels, health and power

- **Levels:** a Hero goes from level 1 to 20 each Season. XP comes from fights, events and reaching a new Floor for the first time. An active Player should be about level 10 when the Boss gate opens and level 18–20 by the end of the Season *(v0)*.
- **Health on level-up:** roll the Class hit die, but never take less than its average. For example, a d10 always gives at least 6.
- **Ability score increases:** at levels 4, 8, 12, 16 and 19, add +2 to one score or +1 to two.
- **Where power comes from:** about 70% from gear and 30% from the Hero itself (level, ability scores, Talents, and later Academy Talents and training).
- **What death never takes:** levels, ability scores and Talents.

### Retiring

Once per Season, a Player may Retire their Hero at the Temple and create a new one, with a new Race, Class and ability roll, starting at level 1. Gold and Storage are kept, and the old Hero's gear moves into Storage.

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
- **Abilities:** some work once per fight. Others have a few uses per rest, and those come back after a long rest at a Camp or on returning to the City.
- **Health:** damage carries over from Room to Room. Heroes heal with potions, Shrines, Cleric spells, a long rest at a Camp, or fully in the City.
- **Monsters:** they come in groups, and deeper Floors have stronger ones.

## The City

The City is an inked town map seen from above, with Buildings you can tap. Nothing can attack a Hero there.

| Building | When | What it does |
|---|---|---|
| Tavern | Season 0 | Where Heroes appear. Your room here holds your Storage. Shows who is online, rumors about the Labyrinth, and the Feed. Later you can also find a Duo partner and play tavern games here. |
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
- **Spotting lies:** Rogues make a WIS Check to mark a lying Clue as suspicious, and Elves roll that Check with advantage.
- **Special doors:** cracked walls, which only a Fighter can smash through, and locked Doors, which need a Key or a Rogue.
- **The Map:** each Player's Map shows every Room and Door their Hero has seen this Season. Everything else stays dark. Maps can't be shared in Season 0. (An idea for later: sell copies of your Map on the Market.)

### Room types

| Room | How many *(v0)* | Notes |
|---|---|---|
| Fight | ~50% of a Floor | A group of monsters. Personal: every Hero meets its own. A Room a Hero has cleared stays clear for that Hero for 24 hours. |
| Empty | ~15% | Nothing happens, or just a line of description. |
| Event room | ~15% | See the table below. Personal. |
| Treasure | ~7% | Loose loot, sometimes a Chest. Personal. |
| Camp | 3–5 per Floor | Safe place to leave a waiting Hero. |
| Stairs | 2–4 per Floor | Lead down to the next Floor, and back up. |
| Waypoint | 1 per Floor | Once reached, you can enter or leave the Labyrinth here. |
| Vault | 1–2 per Floor | Special room: see below. |
| Mini-boss | 1 per Floor | Special room: see below. |

### Event rooms (Season 0)

| Event | What happens |
|---|---|
| Three chests | Pick one of three. One of them may be a mimic, which means a fight. |
| Shrine | Pray for a random Blessing, at the risk of a curse. Clerics roll with advantage. |
| Goblin gambler | Double-or-nothing on gold, or bet an Item on a dice roll. |
| Wandering merchant | Sells rare Items at steep prices, and buys yours for more than the Shops pay. |
| Trapped corridor | A DEX Check to get through unhurt. A Rogue disarms it. |
| Cursed altar | Offer an Item: 40% chance its Tier goes up by one and it gains a Bonus stat, 60% it is destroyed *(v0)*. |
| Locked cache | Needs a Key or a Rogue. Better loot inside. |
| Lockpicking | A 10–20 second minigame: stop the moving pin in the sweet spot. Rogues get a wider sweet spot. |

Later: the shell game (a goblin hides a gem under one of three cups) and more minigames.

### Special rooms and announced vaults

- **Shared:** Vaults, Mini-bosses and rare events are shared by everyone. The first Hero to claim one takes the prize, and it's gone for everyone else. A Mini-boss comes back 24 hours after it is defeated.
- **Announced Vaults:** some Vaults are announced in advance through a Broadcast, e.g. "A sealed vault on Floor 6 opens tonight at 21:00". About 3 happen per week *(v0)*, only on Floors that at least two Heroes have reached. The first Hero to enter after the opening time claims it. These races are where Players mostly meet.
- **Relics:** found in Vaults, and rarely from Mini-bosses on Floors 7–10, until every copy is out.

### Getting in and out

- **Entering:** go in through the Labyrinth gate, starting either from the entrance on Floor 1 or from any Waypoint your Hero has reached this Season.
- **Leaving:** walk to any Waypoint you've reached, or read a **Town Portal** scroll anywhere outside a fight (50 gold *(v0)*).
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
  - 3 successes: the Hero survives with 1 health, loses the fight, and is dragged back to the last Room it cleared.
  - 3 failures: the Hero dies.
- **No Death saves against Players.**
- **Grave:** a dead Hero drops **everything it Carried** (worn gear, Bag and the gold it picked up on this Run) into a Grave in that Room. The Grave stays for 48 hours, and anyone who reaches it can loot it, including the owner with a new set of gear. After 48 hours its contents are destroyed.
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
  - Each is rolled within a range that grows with item level.
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

- **Fight Rooms:** about a 40% chance of an Item per fight *(v0)*, plus gold.
- **Treasure Rooms:** 1–3 Items, sometimes a Chest.
- **Elsewhere:** Event rooms, Mini-bosses, Vaults and the Boss.

Chances of each Tier when an Item drops *(v0)*:

| Tier | Floors 1–3 | Floors 4–6 | Floors 7–9 | Floor 10 |
|---|--:|--:|--:|--:|
| Common | 60% | 45% | 30% | 20% |
| Uncommon | 27% | 31% | 32% | 30% |
| Rare | 10% | 16% | 24% | 30% |
| Epic | 2.69% | 6.6% | 11% | 15% |
| Legendary | 0.3% | 1.3% | 2.6% | 4.3% |
| Mythic | 0.01% | 0.1% | 0.4% | 0.7% |

**What a Player should see:** about one Legendary every 2–3 days for an active Player, 1–2 Mythics per Player per Season, and about 10 Relics per Season across the server.

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
  - A Protection scroll turns "destroyed" into "drops one level".
  - A successful +10 is Broadcast.
- **Reforge:** rerolls all Bonus stats. Tier, Quality, Radiant and the unique power stay the same. The cost rises with the Tier.
- **Salvage:** breaks an Item into Materials *(v0)*:
  - Common and Uncommon give Scrap.
  - Rare and Epic give Essence.
  - Legendary and above give Soulstone.
- **Craft:** Keys and Protection scrolls, made from Materials.

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
- **How Items leave the game:** Graves that expire, Items destroyed at the Forge or the Cursed altar, and Salvage.
- **Buyback price:** Shops buy any Item *(v0)*:
  - base price: Common 5, Uncommon 15, Rare 60, Epic 250, Legendary 1,200, Mythic 6,000 gold
  - multiplied by (1 + item level ÷ 10)

  The price is kept low on purpose, so the Market is always the better place to sell, yet loot is never worthless.
- **Market:** list an Item at your price for up to 7 days *(v0)*. Anyone can buy it at any time. The seller receives the price minus a 5% tax.
- **Direct trade:** two Players in the City swap Items and gold, and both confirm. No tax.
- **Auctions** (a later Season): 24-hour bidding for top Items.

## Social and PvP

### Feed and broadcasts

- **No in-game chat.** Friends talk on Discord.
- **The Feed:** the Tavern shows notable drops, deaths, Market sales, records and attempts at the Boss.
- **Broadcasts:** the game posts to the friends' Discord channel through a webhook when:
  - a Mythic or a Relic is found
  - a Radiant Legendary or better drops
  - an Upgrade to +10 succeeds
  - the Boss is defeated (Champion, 2nd and 3rd)
  - a Vault is announced
  - the Boss gate opens
  - the Boss weakens
  - a Season starts or ends

  Ordinary Legendaries are not Broadcast, to avoid spam.

### PvP encounters (from Season 1)

- **Attacking:** when two Heroes are in the same Room outside a Camp, either one can attack.
- **Escaping:** the attacked Hero gets one **Escape roll**, a DEX Check. Rogues and escape Bonus stats help. If it fails, they fight to the end.
- **Choosing:** a Player who is online chooses on the spot. A waiting Hero follows its Stance.
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

- **D&D rules, Class names and Race names:** from the System Reference Document 5.2 by Wizards of the Coast, licensed CC BY 4.0. The credits screen must include the SRD attribution statement.
- **Icons:** from game-icons.net, licensed CC BY 3.0. Credit each icon's author on the credits screen.
- **Sound effects:** credited according to each library's license.
