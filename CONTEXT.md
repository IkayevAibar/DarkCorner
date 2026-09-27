# Dark Corner (Тёмный уголок)

A season-based dark-fantasy browser game for a small circle of friends. Each Player's Hero descends into one shared Labyrinth for loot, and the first to defeat the Season's Boss becomes Champion.

## Language

### Players and heroes

**Player**:
A person, identified by their Discord account, whom an admin has approved to play.
_Avoid_: user, account, member

**Hero**:
A Player's one character for the current Season.
_Avoid_: character, avatar

**Race**:
A Hero's people (Human, Elf, Dwarf, Halfling), each granting one small trait.
_Avoid_: species, ancestry

**Class**:
A Hero's calling (Fighter, Rogue, Wizard, Cleric, …). It sets the Hero's fighting style, Proficiencies and trick in the Labyrinth.
_Avoid_: job, profession, role

**Ability scores**:
The six D&D scores (STR, DEX, CON, INT, WIS, CHA), rolled when a Hero is created.
_Avoid_: attributes, stats

**Talent**:
A small passive perk. Every Hero picks an origin Talent when it is created.
_Avoid_: feat, perk, skill

**Proficiency**:
A weapon or armor type that a Class can use.
_Avoid_: class lock, restriction

**Stance**:
How a Hero reacts when attacked while its Player is away: try to escape, or stand and fight. The Player sets it in advance.

**Retire**:
To end your Hero at the Temple and create a new one. Allowed once per Season.
_Avoid_: delete, reroll

### Seasons

**Season**:
One full cycle of play, from a newly generated Labyrinth to the Wipe. The first one, a test, is Season 0.
_Avoid_: round, league, era

**Boss**:
The Season's final enemy, waiting at the bottom of the Labyrinth behind the Boss gate.
_Avoid_: final boss, raid boss

**Boss gate**:
The door to the Boss's lair. It opens on a fixed day of the Season.

**Champion**:
The Player, or the Duo, who defeats the Boss first in a Season.
_Avoid_: winner

**Finale**:
The three days between the Champion's victory and the Wipe.

**Wipe**:
The end-of-Season reset that erases Heroes, Items, gold and Maps.
_Avoid_: reset, restart

**Glory**:
Everything that survives a Wipe: Hall of Fame entries, titles and cosmetics.

**Hall of Fame**:
The permanent record of Champions, Relic finders and records from every Season.

### The Labyrinth

**Labyrinth**:
The single shared dungeon of a Season. It is generated once and stays the same until the Wipe.
_Avoid_: dungeon, maze

**Floor**:
One level of the Labyrinth. Deeper Floors hold stronger monsters and better loot.
_Avoid_: level (a Hero's level is different), depth, layer

**Room**:
One place on a Floor where a Hero can stand. The Room's type decides what happens there.
_Avoid_: tile, cell, node

**Door**:
A passage between two neighboring Rooms. Every Door carries a Clue.

**Clue**:
A short hint on a Door about the Room behind it. Usually true, sometimes a lie.
_Avoid_: hint, omen

**Map**:
A Player's personal record of the Rooms and Doors their Hero has seen this Season.
_Avoid_: minimap, atlas

**Move**:
Going through a Door into the next Room. Each Move costs Stamina.
_Avoid_: step, turn

**Stamina**:
The points a Hero spends on Moves. They refill over real time.
_Avoid_: energy, action points

**Run**:
A Hero's time in the Labyrinth, from entering until it returns to the City or dies.
_Avoid_: dive, expedition, trip, raid

**Waypoint**:
A Room that, once reached, lets a Hero enter or leave the Labyrinth there.
_Avoid_: checkpoint, teleport

**Camp**:
A safe Room. A Hero waiting there can't be attacked and takes a long rest.
_Avoid_: safe room, bonfire

**Event room**:
A Room with a choice, gamble or minigame instead of a fight (e.g., Shrine, Goblin gambler).

**Special room**:
A shared Room (a Vault, a Mini-boss or a rare event) whose prize goes to the first Hero to claim it.
_Avoid_: shared room, world event

**Vault**:
A Special room full of high-tier loot that sometimes holds a Relic. Some Vaults are announced ahead of time in a Broadcast.
_Avoid_: treasure room (an ordinary personal Room), locked cache (an Event room)

**Mini-boss**:
A strong shared monster, one per Floor, that returns a day after it is defeated.

**Grave**:
Everything a dead Hero carried, left for 48 hours in the Room where it died. Anyone can loot it.
_Avoid_: corpse, tombstone, loot bag

**Death save**:
The d20 rolls a Hero makes at 0 health in a fight against monsters, to cling to life.

**Encounter**:
Two Heroes in the same Room outside a Camp. Either of them may attack.
_Avoid_: duel, gank

**Escape roll**:
The d20 Check an attacked Hero makes to slip away before the fight starts.
_Avoid_: flee check

### Items and loot

**Item**:
Anything that can be carried, worn, stored or traded: gear, potions, scrolls, Keys, Chests, Materials.
_Avoid_: object

**Carried**:
Everything a Hero has on it in the Labyrinth, meaning its worn gear and its Bag. All of it is lost on death.
_Avoid_: equipped (worn gear only)

**Bag**:
The Items a Hero carries but doesn't wear.
_Avoid_: backpack, inventory

**Storage**:
A Player's safe chest in the City, in their room at the Tavern. Items there are never at risk.
_Avoid_: stash, bank, vault

**Starter kit**:
The free basic gear a Hero receives when it is created and after every death.

**Tier**:
An Item's rarity: Common, Uncommon, Rare, Epic, Legendary or Mythic. Each Tier has its own color.
_Avoid_: rarity, grade, quality

**Relic**:
A named, serial-numbered Item. Only a few copies exist per Season, and each copy keeps a history of its owners.
_Avoid_: artifact, unique

**Quality**:
An Item's 1–100% roll, which scales its base damage or armor.
_Avoid_: condition, wear, float

**Bonus stat**:
A random extra property on an Item. Higher Tiers carry more of them.
_Avoid_: affix, modifier, enchantment

**Radiant**:
A rare glowing version of an Item (about 1 in 200) with a small boost to all its numbers.
_Avoid_: shiny, golden

**Unidentified**:
A Rare-or-better Item whose Quality, Bonus stats and Radiant status stay hidden until it is identified.

**Upgrade**:
Improving an Item at the Forge, from +1 to +10. An Upgrade can fail, and at high levels a failure can destroy the Item.
_Avoid_: enchant, enhance, refine

**Reforge**:
Rerolling all of an Item's Bonus stats at the Forge.

**Salvage**:
Breaking an Item down into Materials at the Forge.
_Avoid_: dismantle, disenchant

**Materials**:
Items made by Salvage and spent on Upgrades, Reforges and crafting.
_Avoid_: dust, resources

**Chest**:
A tradable Item opened with a matching Key, which reveals its prize with the Spin. The chests in the Three chests event are opened on the spot and are not Items.
_Avoid_: case, crate, lootbox

**Key**:
The Item that opens a Chest of the same grade: Iron, Silver or Gold.

**Spin**:
The animation when a Chest opens: a strip of Items scrolls past and stops on the prize.
_Avoid_: roll, roulette

**Bad-luck meter**:
A counter on each Hero that guarantees a Legendary-or-better drop when it fills up.
_Avoid_: pity timer, RNG meter

### City and economy

**City**:
The safe town above the Labyrinth, made up of Buildings.
_Avoid_: town, hub (the ugolok.world hub is a different thing)

**Gold**:
The only currency.
_Avoid_: coins, money

**Market**:
The City board where Players list Items at their own price, for anyone to buy at any time.
_Avoid_: auction house, trading post, bazaar

**Auction**:
A 24-hour bidding sale of one Item.

**Direct trade**:
An exchange of Items and gold between two Players in the City, confirmed by both.

**Buyback price**:
The fixed, low price at which Shops buy any Item.
_Avoid_: floor price, vendor price

**Blessing**:
A temporary luck boost, bought at the Temple or granted by a Shrine.
_Avoid_: buff

### Social

**Feed**:
The Tavern's running list of notable things happening in the game.
_Avoid_: chat, log, news

**Broadcast**:
A post the game sends to the friends' Discord channel about a big moment.
_Avoid_: announcement, notification

**Duo**:
Two Heroes doing the same Run together.
_Avoid_: party, group

**Guild**:
A small, permanent group of Players.
_Avoid_: clan, faction

### Dice

**Check**:
A d20 roll plus a modifier, against a difficulty.
_Avoid_: test, save

**Natural 20** / **Natural 1**:
A d20 that shows 20 or 1 before modifiers: the best or the worst outcome.
