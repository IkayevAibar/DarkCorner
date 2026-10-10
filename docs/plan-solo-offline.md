# Dark Corner, solo and offline: a plan

**Status (2026-10-10):** the owner has ended online Seasons, because only one other person plays. Next comes an Android version that plays solo, with no server. This doc is the starting point for that work:
- what stays
- what the server does today, and what replaces it
- an architecture
- the solo game it becomes
- a plan in phases

The owner settled the decisions in section 1 on 2026-10-10, all six as recommended. Phases 1 and 2 and the Android shell are on `main`. Phase 3 is under way: Days, Chapters, difficulty, Iron mode and the bots are on `main`, and the Companion is built on the branch `claude/solo-companion`, as the owner confirmed it on 2026-10-11. The Chapter's end screen and Rivals are still to come.

Read with [design.md](design.md), [architecture.md](architecture.md) and [CONTEXT.md](../CONTEXT.md). design.md stays the source of truth for every rule this doc doesn't change.

## 1. Decisions (settled 2026-10-10)

1. **Pacing: in-game days.** Today the game runs on the real clock:
   - Stamina refills one point every 24 minutes, up to 20.
   - A Camp rest takes 4 hours, and Training 8.
   - The Omen, Bounties, the Daily Delve and the Mini-bosses' return follow the calendar.

   Solo, a day ends when the Hero sleeps. A solo player plays when it suits them. With nobody to keep pace with, real-time waiting only frustrates, and changing the phone's clock would cheat it anyway.
2. **The arc: Chapters.** A Chapter is one Labyrinth (a new seed) and its Boss. Beating the Boss ends the Chapter: the Hero enters the player's own Hall of Fame, and the player either keeps playing that world or starts the next Chapter with a small legacy. Chapters after the first need new Bosses, which is the content a Season 1 would have needed anyway.
3. **Duo content stays, with a Companion:** an AI-played partner Hero (section 4). That keeps Twin doors and the Twin Wardens, Bond rings, Oathstones and Duo Chests.
4. **The server: offline only.** Nothing in the app depends on a server. The server code stays in the repo in case an optional online layer comes later (cloud saves, a Daily Delve board). The live site keeps running as it is until the owner retires it.
5. **Difficulty: Story, Normal and Hard,** chosen when a save starts. Normal is today's numbers for a Hero alone.
6. **Death: as today, plus an optional Iron mode** (one life) chosen when a save starts. Today a dead Hero leaves a Grave to walk back to, and wakes at the Temple.

## 2. What stays

- **`packages/engine`:** every rule, Class, monster, Item and fight. It is seeded, has no I/O, and runs in the app as it is.
- **`packages/shared`:** the request and response types. They stay the contract between the screens and whatever answers them.
- **`apps/web`:** every screen and the PixiJS scenes, the art, the sounds, and `en` and `ru`.
  - The screens call `api.*` in `apps/web/src/api.ts`. Only what answers those calls changes (section 5).
  - Screens for the features solo removes are hidden.
- **Codex's open briefs** (24 portraits, 25 power effects) are worth as much offline as online.

## 3. What the server does today, and what replaces it

| Today (server) | Solo offline |
|---|---|
| Game state in Postgres (28 Prisma models) | One save file per slot on the phone |
| `apps/api/src/services`: 44 files and about 7,800 lines of orchestration around the engine | A local backend in the app, ported from them (section 5) |
| Discord sign-in, Player approval, the admin page | Gone: one local player and save slots |
| Dice rolled on the server so nobody can cheat | Dice rolled on the phone, which is fine with no other players |
| Scheduled jobs: the gate, weakening, Omens, Vault plans, Training, push | Worked out when time passes (on waking and on load) |
| Duos: invites, who is online, 30-second turns | A Companion played by the AI |
| Oathstones: share or take with another Player | Share or take with the Companion, who remembers |
| Market: Listings between Players | NPC buyers who pay a fair price after a day, or no Market |
| The Feed, Broadcasts to Discord, push notifications | A Chronicle of the Hero's story; local notifications only if real time stays |
| Rankings, a shared Hall of Fame | Personal records, and a Hall of Fame of the player's own Heroes |
| The week's Hunt: a server-wide goal | A personal weekly goal |
| Relics: a set number of copies per Season, server-wide | Each Relic once per world |
| Announced Vaults, where the first Hero in takes everything | Vaults on the world's own schedule |
| Graves anyone can loot | A corpse run to the Hero's own Grave |
| The Season: the gate on day 28, weakening, the Finale, the Wipe | The Chapter: the gate opens by progress, and the Boss's fall ends it |
| PvP encounters (never built) | Rivals: past Heroes come back as ghosts (section 4) |

## 4. The solo game

**Days.** A day ends when the Hero sleeps: at the Tavern (Lodging), in a Camp, or rough on the stones of any other Room.
- On waking: Stamina is full, the short rests are back, cleared Rooms and Mini-bosses return, and there is a new Omen, new Bounties and a new Daily Delve.
- Stamina stays as the measure of how far a Hero gets in a day.
- Training finishes after one night.
- The day count replaces the calendar everywhere a service calls `new Date()` for game time.

**The Companion.**
- Hired at the Tavern for gold a day, or won in events (freeing the Prisoner already exists).
- A Hero of another Class, played by the AI, that levels with the Hero and wears its own gear.
- **Fights need nothing new.** The engine already fights a Duo with an AI-played partner: `ally` in `FightInput`, with its key left out of `FightControl.manual`.
- **Duo content works as designed:**
  - Twin doors open.
  - The Twin Wardens, Bond rings and Duo Chests work as they do for a Duo today.
- **Balance:** a Companion fights at the Duo numbers (`alone = false`), because the extra difficulty from Floor 3 is for a Hero alone.
- **Oathstones:** the Companion has loyalty. Taking costs loyalty and sharing earns it. A disloyal Companion takes in its turn, or leaves.

**Chapters.**
- Chapter 1 is today's Labyrinth, with the Ancient Dragon.
- The Boss gate opens when the Hero first reaches Floor 10, or after a set number of days.
- The weakening counts days from the gate, so a stuck player still gets through.
- The Dragon's fall ends the Chapter: an end screen and the Hall of Fame. Then the player keeps playing that world, or starts Chapter 2 with a legacy (an heirloom Item, a Title, some gold).
- Later Chapters need new Bosses and re-themed deep Floors.

**Rivals.** Heroes the player Retired or lost come back deep in the Labyrinth as ghosts, wearing their gear. That is a fight against a monster shaped like a Hero. Turning a Hero into a `MonsterInstance` is new work.

**Kept as is:**
- the City, Shops, Forge, Temple, Academy and Training grounds
- Deeds and Titles, First steps, Bounties and the Daily Delve
- event rooms, Vaults, hidden rooms, Relics and Mini-bosses
- manual fights, Stances and the Bad-luck meter

## 5. Architecture

**Recommended: a local backend behind the same API.**
- **The switch.** `apps/web/src/api.ts` sends its 92 calls through one `request()`. Put a `Backend` behind it with two implementations: `http` (today) and `local`. The screens don't change.
- **The handlers.** The local backend is a new package (for example `packages/solo`) of handlers ported from `apps/api/src/services`.
  - They take a `World` (the save) instead of Prisma.
  - They call the engine for every rule.
  - They throw the same error codes (`{ error, message }`), so the screens' error handling keeps working.
- **The save** is one JSON document per slot, small enough (a few hundred Items at most). It holds:
  - version, seed and day
  - the Hero, its Items, and the Companion
  - each Floor's seen and cleared Rooms, and the Graves
  - the fight in progress, as its seed and the choices so far (`liveFights.ts` replays a manual fight from them)
  - the Delve, Bounties, the Chronicle and records
- **Transactions.** Each action runs on a copy of the World (`structuredClone`). On success the copy replaces the World and is saved; on an error it is thrown away. That keeps the all-or-nothing behavior of today's Postgres transactions.
- **Storage.**
  - Android: Capacitor Filesystem, written atomically (to a temporary file, then renamed), with the previous save kept as a backup.
  - Web build: IndexedDB.
  - Every save carries a version number, with migrations between versions.
- **Time.** One `Clock`: the day count, plus the wall clock only for animations. Scheduled jobs become `advanceTo(day)` steps that run when the Hero wakes.
- **Seeds.** `newSeed()` uses `crypto.getRandomValues`. The engine's RNG doesn't change, so the same seed and choices still replay the same fight.
- **Cost on a phone.** A Door's Threat plays its fight 60 times (`THREAT_SAMPLES` in `fightOdds`), in every Room. Measure this on a mid-range phone. If it stutters, move it to a Web Worker, or cache it per Room and Stance.
- **Shell.** Capacitor around the Vite build:
  - every asset bundled, so nothing loads from a network
  - portrait only
  - Android's back button handled
  - the app icon and splash screen

**Not recommended:**
- Running Fastify, Postgres and Prisma on the phone. Prisma has no Android runtime, and nodejs-mobile is heavy and fragile.
- An online-first app that syncs. It keeps all the cost of a server for a single player.

**As built in Phase 1** (details in [architecture.md](architecture.md#the-solo-build)). The handlers were copied rather than rewritten. Phase 1's routes import nearly the whole service layer: 49 files and about 7,700 lines. So `packages/solo` holds a copy of every service and route, running on an in-memory database: the slice of Prisma's client they use, over the World's tables.
- **The services are almost unchanged.** `new Date()` became the game clock, and Fastify became a small router. They still typecheck against Prisma's own types.
- **The server's scenarios are the proof.** Every API test except sign-in, push and one Postgres migration runs on the solo backend and passes.
- **All or nothing, twice over.** Each request runs on the World and is undone if it throws. A failed `$transaction` is undone inside it, as in Postgres.
- **The Clock** is a moment of in-game time that stands still until the Hero sleeps. That keeps every rule the server counts in hours (Stamina, rests, Training, Graves) working over nights. The job queue stays: jobs run on that clock.
- **Storage:** IndexedDB in a browser for now. The Android file comes in Phase 4.

**Porting map** (`apps/api/src/services`):
- **Port:**
  - labyrinth (1,403 lines, the bulk of the work), events, heroes
  - fights, liveFights, delve, loot, boss, progression, runs
  - items, inventory, itemUse, shop, forge, relics, vaults
  - bounties, deeds, steps, academy, training, lodging, temple, omens
- **Rework:**
  - duo, twins and trust become the Companion.
  - feed, feedLine and recap become the Chronicle.
  - rankings becomes records, and hunts a personal goal.
  - seasons and seasonLife become Chapters.
  - scheduler and jobs become the Clock.
- **Drop:**
  - players, admin, push, broadcast and settings
  - market, unless NPC buyers replace it
  - the auth routes
  - the row locks in `ledger.ts`, which have nothing left to guard

## 6. Plan

Each phase ends on something a person can try.

1. **The first loop, offline.**
   - Build: the `World`, saving and loading, the Clock, and the `Backend` switch.
   - Port: creating a Hero, the City's basics, entering the Labyrinth, Move and Face, fights (Auto and by hand), loot, the Bag and equipping, and going home.

   *Done when* a new player, in a browser with the network off, makes a Hero, clears a Floor 1 Room, puts on its loot, goes back to the City, reloads the page, and finds everything as it was.

   **Done, 2026-10-10.**
   - The loop is played in `packages/solo/test/backend.test.ts`, with fixed dice so it runs the same every time.
   - In a browser, the solo build (`npm run dev:solo -w @dark/web`, port 5181) made a Fighter, won four Floor 1 fights and wore the longsword one dropped. The Hero went home, and a reload found it all as it was.
   - The game made no request to an API or a sign-in at any point.
   - Only the Google Fonts stylesheet still uses the network: Phase 4 bundles the fonts.
2. **Everything single-player.**
   - Port the rest: events, the Daily Delve, Forge, Shop, Bounties, Deeds, First steps, Academy, Training, Lodging, Temple, Relics, Vaults and the Boss.
   - Port the scenarios in `apps/api/test` so they run against the local backend.

   *Done when* every screen that solo keeps works offline, and the ported tests pass.

   **Done, 2026-10-11.** Every service came with Phase 1, and the ported scenarios pass.
   - **The bots play offline.** `npm run playtest -w @dark/solo` runs the server's playtest bots on the solo backend. Twelve bots played a whole Season in 31 days, through the Boss gate, eight Dragon kills and the Wipe, with no server errors.
   - **Every screen was walked** in the solo build, with no errors:
     - the City and its buildings, and the Tavern's panels
     - the Labyrinth: events, fights, Treasure, Camps and the Map's Routes
     - the Well, Loot, and Heroes: levelling up, Retiring and making a new Hero
   - **Fixed on the way:**
     - **A Hero could be stuck for good.** A Hero who woke rested and began Training could neither enter the Labyrinth nor sleep, and only sleep moves the clock. Solo, a rested Hero may now take a night at the Tavern.
     - **The screens counted time on the phone's clock,** while the game's clock stands still until the Hero sleeps. Countdowns now follow the World's clock, and redraw when it moves.
     - **The screens asked again every few seconds** for news from other Players. Solo, they look again only when the day turns.
     - **Server leftovers:** the Duo card, push settings, Sign out and the approval status are gone from the solo build.
   - **Left for Phase 3,** because each needs its rules:
     - **What a night costs.** A night at the Tavern is the only way time passes, and each costs half again as much as the last. Within a week or two a Hero can't pay for one, and selling gear is the only way out. Free sleep at a Camp, and a price for the Tavern's night, belong with Days.
     - **Words for real time:**
       - Stamina's "+1 in 24:00", and "1 point every 24 minutes"
       - a Camp's "full rest at" an hour that never comes, and "Waiting heals slowly", by the hour
       - Training's 8 hours, and Blessings' 3 hours, which last the whole day offline
       - the Graves' 48 hours
       - the Shop's, the Well's and the Bounties' countdowns to midnight
       - a Run that took "0 min"
     - **Things made for other Players:** the Market, where nobody buys; the Well's board; the server's Hunt; Rankings; the Feed's clock times; and the Hall of Fame.
     - **Words about the Season** in the Guide, the Academy, the Training grounds and Retiring.
3. **The solo game.**
   - Build: days, the Companion, the Chronicle, records and the Hall of Fame, Chapters, and difficulty.
   - Hide what solo removes.
   - Teach the solo bots (`packages/solo/scripts/playtest.ts`) to play by Days.

   *Done when* the bots play a Chapter from level 1 to the Dragon's fall without errors, and par Heroes (`balance:par`) still land where design.md says.

   **Under way, 2026-10-11,** on `claude/solo-phase-3`. design.md → The solo game has the rules.
   - **Days:**
     - A night costs nothing: at the Tavern, in a Camp, or rough on the stones of any other Room, which gives back only half the missing health. No Hero is ever stuck in a Day.
     - The screens count in nights and Days instead of hours.
     - A Town Portal stays open through one night.
   - **Chapters:**
     - The Boss gate opens early when the Hero first reaches Floor 10, and the Dragon's weakening counts from the gate.
     - The Dragon's first fall completes the Chapter and puts the Hero in the Hall of Fame. There is no Wipe: the world goes on.
   - **The Save's settings,** chosen before its first Hero:
     - Story, Normal or Hard: monsters' health and damage ×0.75, ×1 or ×1.25.
     - Iron mode: a fallen Hero is gone for good.
   - **Alone:**
     - The Market is hidden, and the Free market Omen never comes.
     - The Hunt is sized for one Hero, and the Daily Delve gives a Chest for the Rooms won.
     - The Feed is the Chronicle, stamped with Days, and Rankings are the Records.
     - Other Players are gone from the Tavern and the Well.
   - **The solo wording** lives in `apps/web/src/i18n/solo.ts`: Chapters instead of Seasons, nights instead of hours, one Player instead of many.
   - **The bots play by Days:** a World each, a Day of Stamina, then bed. In 80 Days, all twelve reached level 20 and Floor 10, and ten saw the Dragon fall, between Day 25 and Day 60. The Monk and the Bard kept escaping from it to the end. Eight opened the Boss gate early, between Day 14 and Day 27; the other four found it open on Day 29. There were no server errors, and every bot could always sleep: 0 to 9 rough nights each.
     - **Fixed on the way:**
       - A Hero with no Stamina, no short rests, no Town Portal and no Camp in reach couldn't sleep, so its Days stopped. The rough night ends that.
       - The bots went home whenever four Items waited to be identified, and looped on a Floor's landing at bedtime.
   - **Par Heroes are unchanged.** Phase 3 changed nothing in `packages/engine`, where par Heroes fight, and Normal difficulty leaves monsters as they are. `balance:par` on 2026-10-11, by Class: Rooms from Floor 3 kill 2–6% of the time, and Mini-bosses are won 38–68% of the time. By Path, late-Season Heroes beat the Dragon 9–56% of the time. design.md's ranges hold.

   **The Companion, 2026-10-11,** on `claude/solo-companion`. The owner confirmed the proposal, and design.md → The solo game → The Companion has its rules.
   - **Loyalty moves at both Oathstones and Duo Chests.** The proposal put sharing and taking at a Duo Chest, but a Duo Chest is picked in turns: the Share or Take choice is the Oathstone's. So the Player's oath moves Loyalty, and the Companion swears by it: Share at 5 or more. At a Duo Chest, letting the Companion take its turns earns 1, and taking every Item left costs 2.
   - **Built on the Duo code.** A Companion is a Hero owned by a Player of its own, so `packages/shared` and the server's schema are unchanged. The screens are wired:
     - a Companion card at the Tavern
     - "Give to" on the Bag's gear
     - the Duo strip in the Labyrinth
     - "Take it all" at a Duo Chest
   - **The bots hire Companions** with `PLAYTEST_COMPANION=1`. Twelve bots played 15 Days with no server errors. They hired, paid wages, fell and came back, dressed their Companions, shared and took at Duo Chests, swore at Oathstones, and left their Companions at the lair's door.
     - **With a Companion, the bots level faster and die more often.** By Day 15 the average level was 12.8 against 11.4 alone, and the twelve died 30 times against 21.
     - Nobody flees a Duo fight, and the bots fled 11 times against 55 alone. Whether a Duo with a Companion may retreat mid-fight is the owner's call *(v0)*.
   - **One request for Codex:** the Duo Chest scene shows a 30-second pick timer. Offline, the Companion picks at once and the game clock stands still, so the timer always reads 30. The solo build should hide it.

   **Still to build in Phase 3:**
   - **The Chapter's end:** an end screen, and Chapter 2 started with a legacy. Chapter 2 also needs new Bosses and re-themed deep Floors.
   - **Rivals:** Retired and fallen Heroes, back as ghosts deep in the Labyrinth.
4. **Android.**
   - Build: the Capacitor shell, and save slots with export and import.
   - Check the Threat cost on a real phone.
   - Prepare the store listing, with credits: SRD 5.2 (CC BY 4.0), game-icons.net (CC BY 3.0), Kenney's sounds (CC0).

   *Done when* the APK, installed on a phone in airplane mode, takes a new Hero to Floor 3 smoothly, and its save survives the app being killed mid-fight.

   **The shell came early, 2026-10-10,** at the owner's ask. `apps/android` is a Capacitor 8.5 project around the solo build:
   - the dragon icon and a dark splash
   - "Тёмный уголок" as its name on Russian phones
   - portrait only
   - edge to edge: dark system bars with light icons, and the top bar padded below the status bar
   - the phone's back button: it closes the open sheet, card or fight, else goes back a screen, and on the first screen puts the game away

   `npm run apk -w @dark/android` builds a debug APK, and `npm run open -w @dark/android` opens the project in Android Studio.

   **Tested on an emulator, 2026-10-10:** a Pixel 7 image with Android 16, in airplane mode.
   - A new Fighter went through the gate, won fights in the fight scene, wore a dropped saber, answered two riddles, came back to the City and reached level 2.
   - The app was force-stopped twice: in the City, and in the middle of a turn-by-turn fight. Each time the Save came back unchanged, and the fight went on from the same turn.
   - The log showed no errors.
   - The emulator draws with a software GPU, so it says nothing about speed.

   Still to do in Phase 4:
   - **Fonts in the app:** the Google Fonts stylesheet still needs the network.
   - **Save export and import.**
   - **A release key:** the owner's, kept out of the repo.
   - **Speed on a real phone:** the Threat cost, and fights. Each request also deep-copies the World: once for the request's undo, and once for each `$transaction`. That cost grows with the Save. A World copied only where it changes would make it small.
   - **The store listing.**

   **Before friends install it**, the owner confirms the app id, `world.ugolok.darkcorner`. A Save belongs to the app id: changing the id later leaves every Save behind.

## 7. Gotchas

- **`new Date()` is all over the services.** Every call that means game time must go through the Clock, or days break. *(Phase 1: the solo copies call `gameNow()`; keep new code on it too.)*
- **The job queue can't be fast-forwarded.** The API's daily jobs reschedule from the real clock, so `runDueJobs` with a future time loops forever. *(Phase 1: in solo every job reschedules from the game clock, and jobs queued during a pass wait for the next one.)*
- **Camps.** A Camp rest waits four hours of in-game time, which never pass while the clock stands still. Until Phase 3 makes sleeping in a Camp end the Day, only a night at the Tavern moves the clock.
- **Two copies of the scenarios.** `packages/solo/test` holds copies of `apps/api/test`. An engine or content change that needs a server scenario updated (new portrait ids, say) needs the same update in the solo copy.
- **Android Studio's own Java is too new.** Capacitor 8 pins Gradle 8.14.3, which fails on Studio's bundled Java 25. Build with JDK 21: set Studio's Gradle JDK to `JAVA_HOME` (Settings → Build, Execution, Deployment → Build Tools → Gradle). The command-line build uses `JAVA_HOME` already.
- **Keep manual fights as a seed plus choices.** They are stored that way and replayed on every turn. That is what makes a fight come back the same after the app is killed.
- **Pick the balance numbers by who fights.** With a Companion, Duo balance applies (`alone = false`). Without one, the extra difficulty from Floor 3 (`floorMight`) does.
- **Text.** Strings for removed screens can go. Everything that stays keeps both `en` and `ru`.
- **Docs.** The decisions are in design.md's "The solo game" and the new terms in CONTEXT.md. As each one is built, rewrite the design.md sections it changes in the same pull request (Seasons, Duos, Social, the Market, Notifications, the Scope).
