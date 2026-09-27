# Gameplay plan: making every Move a decision

The Season 0 build ([plan-season-0.md](plan-season-0.md)) is done through week 5. There are no testers yet, so until they arrive Claude works on what makes the game fun to play, in the order below. Each part is its own branch and pull request, with `docs/design.md`, `CONTEXT.md`, tests and the balance scripts updated in the same branch. The owner can reorder or cut any of it.

## Where the game is flat today

A Player checks in 2–3 times a day and spends about 20 Moves each time. Those Moves are thin:

- **Fights are watched, not played.** About 59% of Rooms are fights. Opening their Door starts the fight at once, and monsters are plain stat blocks, so the 50th fight plays like the 5th.
- **Door choice is shallow.** A Clue names the kind of Room but never how dangerous it is. The choice collapses into "Treasure, then an Event, then a fight, never an empty Room".
- **Levels only change numbers.** Nothing is chosen on a level up. Ability score increases go automatically into the main ability, and no new ability appears that a Player could look forward to.
- **No goal smaller than "go deeper".** A session has nothing that says "today, try this".
- **Every day in the Labyrinth plays the same.**

## Principles

- **Every Move offers a decision or a reveal**, and ideally both.
- **Fights stay automatic** (the Season 0 decision). What happens around them is the Player's call: whether to fight, in which Stance, and with what.
- **Danger you can read before you take it.** It is Pillar 2: luck you can see.
- **Gear stays king.** New Hero powers are small and flavorful. Gear stays at about 70% of power.

## The parts, in order

### 1. Encounters: fight Rooms become choices (done)

- Opening the Door of a Room with monsters shows who is inside and a **threat** rating: Trivial, Easy, Risky, Dangerous or Deadly. The server gets it by playing that fight 60 times with the Hero as it stands right now.
- The Player chooses:
  - **Fight.**
  - **Sneak past:** a DEX Check. It is harder with more monsters and deeper Floors. Heavy armor gives disadvantage, Rogues roll with advantage, and escape Bonus stats help. Failing it means an ambush: the monsters act first.
  - **Retreat:** back to the last safe Room, free.
- **Stance:** Bold (advantage on attacks, and so do the monsters), Steady, or Wary (+2 AC and −2 to hit). Steady tries to escape near death and Wary below half health, so a Player picks how much risk to take.
- **Bombs** from the Shops. A Fire bomb hurts every monster before the fight starts. A Smoke bomb makes sneaking past sure.
- Mini-bosses and the Boss show themselves too. They offer only Fight or Retreat.

### 2. Monster powers and elite packs (done)

- Every monster gets one signature, for example:
  - the goblin cutpurse grabs gold and runs for it
  - wolves hunt as a pack
  - skeletons shrug off arrows and daggers but break under maces
  - ghouls paralyze
  - zombies won't stay down
  - wraiths drain life
  - cultists heal each other
  - hellhounds breathe fire
- The Dragon breathes fire, frightens, attacks three times, and takes to the air at half health.
- **Elite packs** from Floor 2 on:
  - Gilded: triple gold and a sure drop, so worth the risk
  - Frenzied
  - Armored
  - Vampiric
  - Swift
- Elites show in the Encounter, so they feed the fight-or-sneak call. Status effects arrive with them: burning, which also makes Ember Fang do what its text says, and paralysis.

### 3. Paths and Talents: choices on level up (done)

- **Level 3:** choose a Path, 2 per Class:
  - Fighter: Champion or Guardian
  - Rogue: Thief or Assassin
  - Wizard: Evoker or Abjurer
  - Cleric: Life or War
- **Levels 4, 8, 12, 16 and 19:** choose +2 to one ability score, +1 to two, or one of three Talents offered to that Hero.
- Retiring gets a real reason: trying the other Path.

### 4. Tavern bounties: a reason to come back today (done)

- Three small bounties a day per Hero and one bigger weekly one. Examples: "Clear 6 fight Rooms on Floor 3 or deeper", "Sneak past 3 groups", "Win a Risky fight", "Open a Treasure room".
- Rewards are gold, Keys and Chests, which feed the loot loop.

### 5. Omens: every day plays a little differently (done)

- One Omen a day for the whole server, announced in the Tavern and with the Season's Broadcasts. Examples:
  - Blood moon: monsters +20% health, +50% gold
  - Still air: sneaking is easier
  - Restless dead: more undead, and Clerics shine
  - Merchant's day: Wandering merchants everywhere

### 6. More to find (done: secret Doors and four Event rooms; the riddling statue is left for later)

- **Secret Doors:** a WIS Check when entering a Room, in the same way Clues are seen through. Behind one there is always something good.
- **New Event rooms:**
  - a fountain to drink from
  - a prisoner to free
  - a library to read in
  - a bone pile to search
  - a riddling statue

## How we'll know it worked

The testers will tell us. Until then, each part must pass `npm run balance:fights` and `npm run balance:season` (the Season targets stay: a Legendary every 2–3 days, 1–2 Mythics per Player), and the owner plays it in the browser before merging.

Since 2026-09-27 there is also a headless playtest: four bots, one per Class, play 14 days through the real API on a fake clock (`npm run playtest -w @dark/api`). Its first runs found Heroes stuck in Camps that never rested, stranded at 1 health or behind a full Bag, and, with real drop gear, every Floor Trivial by day 10 and the Dragon beatable at level 14. The fixes are in design.md: deeper Floors keep pace with gear, d20 Bonus stats grow with Tier only, Trivial fights never kill, Heroes heal slowly while waiting, Items can be dropped, Wizards get a Shield, and the weak Paths were raised. After them, the bots reach about level 10 and Floors 5–8 by day 14.
