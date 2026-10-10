# Dark Corner, solo and offline: a plan

**Status (2026-10-10):** the owner has ended online Seasons, because only one other person plays. Next comes an Android version that plays solo, with no server. This doc is the starting point for that work:
- what stays
- what the server does today, and what replaces it
- an architecture
- the solo game it becomes
- a plan in phases

The owner settled the decisions in section 1 on 2026-10-10, all six as recommended. Phase 1 is under way on the branch `claude/android-prep`.

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

**Days.** A day ends when the Hero sleeps, at the Tavern (Lodging) or at a Camp.
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

   **Mostly came with Phase 1.** Every service is ported, and the ported scenarios pass. What is left: walking each screen in the solo build and fixing what shows.
   - Already seen in Phase 1, for Phase 3, are texts that still speak of real time:
     - Stamina "+1 in 0:00"
     - the gate's "one point every 24 minutes"
     - a Run that took "0 minutes"
   - The Duo panel says nobody is in the City.
   - Push settings answer `push_offline`.
3. **The solo game.**
   - Build: days, the Companion, the Chronicle, records and the Hall of Fame, Chapters, and difficulty.
   - Hide what solo removes.
   - Point the bots in `apps/api/scripts/playtest.ts` at the local backend.

   *Done when* the bots play a Chapter from level 1 to the Dragon's fall without errors, and par Heroes (`balance:par`) still land where design.md says.
4. **Android.**
   - Build: the Capacitor shell, and save slots with export and import.
   - Check the Threat cost on a real phone.
   - Prepare the store listing, with credits: SRD 5.2 (CC BY 4.0), game-icons.net (CC BY 3.0), Kenney's sounds (CC0).

   *Done when* the APK, installed on a phone in airplane mode, takes a new Hero to Floor 3 smoothly, and its save survives the app being killed mid-fight.

## 7. Gotchas

- **`new Date()` is all over the services.** Every call that means game time must go through the Clock, or days break. *(Phase 1: the solo copies call `gameNow()`; keep new code on it too.)*
- **The job queue can't be fast-forwarded.** The API's daily jobs reschedule from the real clock, so `runDueJobs` with a future time loops forever. *(Phase 1: in solo every job reschedules from the game clock, and jobs queued during a pass wait for the next one.)*
- **Camps.** A Camp rest waits four hours of in-game time, which never pass while the clock stands still. Until Phase 3 makes sleeping in a Camp end the Day, only a night at the Tavern moves the clock.
- **Two copies of the scenarios.** `packages/solo/test` holds copies of `apps/api/test`. An engine or content change that needs a server scenario updated (new portrait ids, say) needs the same update in the solo copy.
- **Keep manual fights as a seed plus choices.** They are stored that way and replayed on every turn. That is what makes a fight come back the same after the app is killed.
- **Pick the balance numbers by who fights.** With a Companion, Duo balance applies (`alone = false`). Without one, the extra difficulty from Floor 3 (`floorMight`) does.
- **Text.** Strings for removed screens can go. Everything that stays keeps both `en` and `ru`.
- **Docs.** The decisions are in design.md's "The solo game" and the new terms in CONTEXT.md. As each one is built, rewrite the design.md sections it changes in the same pull request (Seasons, Duos, Social, the Market, Notifications, the Scope).
