# Season 0 build plan

**Goal:** Season 0 opens on **Friday 2026-11-06** at `dark.ugolok.world` for 5–15 friends. What's in it is listed under "Scope" in [design.md](design.md#scope).
**Time:** 6 weeks starting Monday 2026-09-28. About 10 hours a week from the owner; Claude and Codex write most of the code. Every Sunday we check what got done and adjust the next week.

## How we work

- **Rules first, screens second.** Game rules go in `packages/engine` as pure code with a fixed random seed, so every result can be replayed and tested. Screens come after. Economy bugs (duplicated Items, wrong odds) are the ones that can ruin a season.
- **Deploy early.** A bare version goes live at the end of week 2. That proves login, cookies and the VPS long before launch.
- **Play every week.** From week 3 on, the owner plays on a phone for an hour. What they notice decides the next week.
- **Data format first.** Before Codex builds a screen, Claude publishes the data it needs in `packages/shared`. Example: the fight replay format is defined on Monday of week 3, before Codex starts the fight scene.
- **The Season buys time.** Nobody can reach the Boss before day 14, and the Wipe comes weeks later. The Dragon, the Finale and the Wipe can therefore land after launch if needed.
- **Branches and pull requests.** Each task gets its own branch and pull request, and the owner merges (see [AGENTS.md](../AGENTS.md)).

## Weeks at a glance

| Week | Dates | Focus | Playable at the end |
|---|---|---|---|
| 1 | Sep 28 – Oct 4 | Foundation | Sign in locally and see the City shell in look B |
| 2 | Oct 5 – 11 | Heroes, Items, first deploy | Create a Hero on `dark.ugolok.world` (admins only) |
| 3 | Oct 12 – 18 | Labyrinth and fights | Walk Rooms, fight, die, leave a Grave, portal home |
| 4 | Oct 19 – 25 | Loot and economy | Drops, Chests, identifying, Forge, Shops, Market |
| 5 | Oct 26 – Nov 1 | Season, social, admin | The whole Season loop, Broadcasts, the Dragon |
| 6 | Nov 2 – 6 | Test season and launch | Season 0 opens on Friday |

## Week 1: Foundation (Sep 28 – Oct 4)

**Claude**
- Monorepo using npm workspaces: `apps/api`, `apps/web`, `packages/shared`, `packages/engine`. Strict TypeScript, vitest, local Postgres 17 in Docker Compose. `npm run dev` starts everything.
- Prisma schema v1: Player, Season, Hero, Item, roll log, scheduled job, Feed event.
- Sign-in:
  - a copy of the hub's `sso.ts`, plus the session code
  - a login for local development only
  - admin approval of Players
  - `GET /api/sso/summary`
- Engine basics, all with tests:
  - a random number generator that takes a seed
  - dice, with advantage/disadvantage and 4d6-drop-lowest
  - Checks
- Web shell in look B: top bar, tab bar, bottom sheet, RU/EN switch.
- CI on GitHub Actions: type check, tests, build.

**Codex**
- Rebuild the look-test Item tile and Item card as React components on a `/sandbox` page. They cover every Tier, plus Radiant and Unidentified.

**Owner**
- Create a private GitHub repo and send Claude the URL.
- Set up Codex on the repo (it reads AGENTS.md).
- Review and merge the setup pull request, then try the local login.

**Done when:** `npm run dev` works on the owner's PC, the local login shows the City shell in look B, and CI passes.

## Week 2: Heroes, Items, first deploy (Oct 5 – 11)

**Claude**
- Creating a Hero: Race, Class, ability roll (3 rerolls, the 65 minimum), hit points, origin Talents, portrait, name, banner color. Also Retiring.
- Items in the engine: bases, Tiers, Quality, Bonus stats, Radiant, Unidentified, Relic serial numbers. Tests check the odds.
- Worn gear, Bag, Storage and the Starter kit, plus the Heroes screen and character sheet.
- Deployment:
  - production Docker Compose
  - a deploy script on a systemd timer, like MC's
  - the Caddy site file
  - nightly backups
  - a step-by-step deploy guide for the steps only the owner can do

**Codex**
- Hero creation screens: Race, Class and portrait pickers, and the 4d6 dice animation.

**Owner**
- Follow the deploy guide: the DNS record for `dark.ugolok.world`, secrets on the VPS, the Caddy file in Aetherbound's repo.
- Create a Discord webhook in the channel that should receive Broadcasts.
- Generate 32 Hero portraits (4 Races × 4 Classes × 2) from Claude's prompts.

**Done when:** on `dark.ugolok.world`, an approved admin signs in through the hub and creates a Hero with rolled stats and a Starter kit.

## Week 3: Labyrinth and fights (Oct 12 – 18)

**Claude**
- Labyrinth generator, seeded per Season:
  - 10 Floors of about 100 Rooms each
  - Doors with Clues (20% of them lie)
  - Stairs, Waypoints, Camps and Special rooms
- Moving:
  - Stamina and the personal Map
  - Town Portals and entering at Waypoints
  - Heroes waiting where they were left
- Fights: monsters by Floor, initiative, attacks against Armor Class, critical hits, first-version class abilities. The fight replay format in `packages/shared` comes first, on Monday.
- Death saves, Graves (48 h), and waking at the Temple.

**Codex**
- The fight scene in PixiJS, built from the replay format: tokens, damage numbers, d20 moments, death saves.
- The Floor map with unexplored Rooms hidden and Clues on Doors.

**Owner**
- Generate Room maps for Floors 1–6 (about 10 per theme) and monster tokens for goblins, beasts and undead.
- Play a Run on your phone and send notes.

**Done when:** a Hero can do a full Run:
- enter the Labyrinth
- move Room to Room, spending Stamina
- fight, with the fight played back on screen
- then either die (Grave, Temple) or go home by Town Portal or Waypoint

## Week 4: Loot and economy (Oct 19 – 25)

**Claude**
- Drop tables by Floor, gold, Chests and Keys, identifying.
- The Forge:
  - Upgrade, including failure and destruction, and Protection scrolls
  - Salvage and Materials
  - crafting Keys and scrolls
  - Reforge
- Shops (buy basics, sell at the Buyback price) and the Market (list, buy, 7-day expiry, 5% tax).
- The Bad-luck meter.
- Event rooms: Three chests, Shrine, Goblin gambler, Wandering merchant, Trapped corridor, Cursed altar, Locked cache.
- A balance script that simulates a Season for 10 players and checks the targets: a Legendary every 2–3 days, 1–2 Mythics per player, about 10 Relics.

**Codex**
- Chest Spin, identify reveal and Tier drop effects, ported from the look test.
- Forge Upgrade animation and the lockpicking minigame.

**Owner**
- Generate painted art for the Relics and the Legendary/Mythic uniques (about 15 images).
- Approve downloading the game-icons.net icons and a free sound pack. Claude names the exact files first.
- Play: open Chests, gamble at the Forge, sell on the Market.

**Done when:**
- loot drops at the odds in design.md
- Chests open with the Spin, and Items can be identified
- the Forge, Shops and Market move gold and Items, and a test proves Items can't be duplicated

## Week 5: Season, social and admin (Oct 26 – Nov 1)

**Claude**
- Seasons: starting a Season, plus scheduled jobs for the Boss gate on day 14, weekly weakening, the Finale and the Wipe. The Hall of Fame.
- The Dragon fight and Champion logic, Mini-bosses, Vaults with Relics, and announced Vault openings.
- The Feed, Discord Broadcasts, and the late-joiner boost.
- Admin page:
  - approve Players
  - start and stop a Season
  - grant Items and gold for testing
  - read the roll log
- A full pass over every Russian and English string.

**Codex**
- The City screen (map, pins, torches, fog, from the look test).
- The Tavern (who's online, the Feed) and the Hall of Fame page.
- Sound effects.

**Owner**
- Generate Room maps for Floors 7–10 and tokens for demons and the Dragon's kin.
- Merge the hub pull request that adds the game's card.
- Pick 2–3 friends for the test season.

**Done when:** an admin starts a Season on the real server and every Season 0 feature on the scope list works from start to finish.

## Week 6: Test season and launch (Nov 2 – 6)

The checklist for each day is in [launch.md](launch.md).

- **Mon:** start a short test season on the real server with 2–3 friends.
- **Mon–Wed:** fix what they find and tune numbers. Check on Android and iPhone. Test backups by actually restoring one.
- **Thu:** decide go or no-go, then wipe the test season.
- **Fri Nov 6:** start Season 0. The game posts the launch Broadcast.

## After launch

| When | What |
|---|---|
| Days 1–7 | Urgent fixes and number tuning; extra content for the deep Floors if they feel thin |
| Before day 14 (≈ Nov 19) | Check the Boss gate and the Dragon on the live server |
| Before the Finale (≈ early December) | Rehearse the Finale, Wipe and Hall of Fame on a copy of the database |
| During the Season | Collect notes for Season 1: PvP Encounters, Duos, Barbarian and Ranger |

**Rehearsed on 2026-10-10**, the day before Season 0's gate (day 14), on the local dev database rather than a copy of the live one:
- `apps/api/test/finale.test.ts` plays the end of a Season through the API:
  - the sealed lair, with the gate and the Wipe each run by its own job
  - a Champion from a fight played by hand
  - a full podium, where a fourth win pays only the hoard
  - a Duo turned away at the lair
  - the Dragon's first weakening
  - an empty next Season, shut until an admin starts it
- A walk through the screens on the running server showed working:
  - the sealed-gate message and the Dragon's card
  - the Victory report with its Deeds
  - the Tavern's Finale countdown and podium
  - the Wipe running on the server's own scheduler
  - the Hall of Fame chronicle, and Season 1's Quick start
- Nothing was broken.
- Left open: Season 1 would bring Season 0's Dragon back, since a new Boss for each Season isn't built yet.

## If we fall behind

Cut in this order, and ship whatever was cut as an update during the Season:

1. The lockpicking minigame
2. Vault announcements (the Vaults themselves stay)
3. The Wandering merchant and the Goblin gambler
4. Reforge
5. Radiant animation polish

These are never cut: sign-in, creating a Hero, the Labyrinth, fights, death and Graves, Tiers and identifying, Chests, the Market, Broadcasts.

## What the owner provides

| When | What |
|---|---|
| Week 1 | Private GitHub repo URL; Codex set up on it |
| Week 2 | The deploy guide steps (DNS, VPS secrets, Caddy); the Discord webhook URL |
| Weeks 2–5 | Art batches from Claude's prompts, about 100 images: 32 portraits, 35 Room maps, 15 monster tokens, 15 painted items |
| Week 4 | Permission to download the icon set and a sound pack |
| Week 5 | Merge the hub card pull request; choose testers |
| Week 6 | Go or no-go on Thursday |
