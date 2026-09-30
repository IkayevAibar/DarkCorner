# Codex task 08: the Tavern and the Hall of Fame

**Branch:** `codex/tavern`, based on `main` once `claude/tavern-brief` is merged (it adds faces to the online list).
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The Tavern is where Players see each other and the Season ([design.md → The City](../design.md#the-city), [Feed and broadcasts](../design.md#feed-and-broadcasts)): who's here, what just happened below, how the Season stands, and their own bounties and a bed for the night. The Hall of Fame is the only thing that survives a Wipe, so it should feel like carved stone. Claude's stand-in works, but it is plain text in panels. Make it a place.

## What the stand-in shows today

`apps/web/src/screens/city/Tavern.tsx`, from the top:

1. **The Season card** (`SeasonCard`): the Season and its status, the countdown to the Boss gate, how much the Boss has weakened, today's Omen (`OmenNote`), the countdown to the Wipe in the Finale, the podium, and the Relics left to find.
2. **Lodging** (`Lodging`): a bed upstairs for City gold, once a day, dearer each night.
3. **Bounties** (`Bounties`, `BountyCard`, `HuntCard`): three daily bounties and a weekly one, with progress and a swap, and the week's Hunt.
4. Three tabs: **the Feed** (who's online, then the Feed), **the Rankings** (`Rankings.tsx`, a podium per board) and **the Hall of Fame** (`Hall`).

Keep every number and action these have. Arrange and restyle them freely: the Hall of Fame can move to its own route (`/city/hall`) linked from the Tavern, and the tabs can become places in the room.

## Contract

`packages/shared/src/season.ts`:

- `GET /api/tavern` → `TavernView`:
  - `season`: `number`, `status` (`planned`, `active`, `finale`, `ended`), `startsAt`, `bossGateAt`, `wipeAt` (set once someone beats the Boss), `weakening` (0 to 0.4), `podium`, `relicsLeft`, and `omen` (today's, or null).
  - `online`: Players seen in the last 10 minutes. Each has `name`, the Hero's name (`hero`), the `title` it wears, `where` it is ("In the City", "Floor 4"), and now `portraitUrl`, `banner` and `level` to draw it as a token. All four are null for a Player still making a Hero.
  - `entries`: the Feed, newest first, up to 50 lines. Each line comes ready in both languages (`text`), with a `tier` when it is about an Item (color it with `--color-tier-*`). `kind` says what happened:
    - finds: `drop`, `chest`, `identify`, `relic`, `upgrade10`, `hidden`, `vault`, `grave-looted`
    - the Market: `market-sale`
    - the dark: `death`, `depth`, `boss-attempt`, `boss-kill`
    - the Season: `gate-open`, `weaken`, `vault-announced`, `omen`, and `announcement` (an admin speaking to everyone)
    - goals: `bounty`, `hunt`, `hunt-done`, `deed`, `delve-cleared`, `delve-podium`
- `GET /api/tavern/rankings` → `RankingsView`: one board per `RANKINGS` kind ([design.md → Rankings](../design.md#rankings)). Each has its top ten `rows`, and `me`: the Player's own row when it is lower. A row has `rank` (ties share it), the Player, the Hero with `portraitUrl` and `banner`, the `value`, the `item` on the finest board, and `me`.
- `GET /api/hall` → `HallView.entries`: for each Season, `champion`, `second`, `third`, `relic`, `best-drop`, `deepest` and `highest-level`, with the Player and Hero names and a `detail` line.
- Lodging (`GET` and `POST /api/tavern/lodging`) and bounties (`GET /api/tavern/bounties`, `POST /api/tavern/bounties/:id/swap`) are already wired in the stand-in: keep the calls.

The Tavern looks again every 25 seconds while it is on screen, and not while the tab is hidden (`useRefresh`). There are no websockets in Season 0.

## Look

- **The room:** warm light in the ink style. The Season card is a notice nailed to a post: the countdown to the gate or the Wipe, and the Omen.
- **Who's here:** small tokens in their banner colors, with their Titles.
- **The Feed:** a board of lines. Relic and Mythic lines stand out, deaths are grim, and an admin's announcement reads like a pinned notice.
- **Lodging** is the stair up to the rooms. Bounties are notes pinned to the board, and the Hunt is a wanted poster.
- **The Rankings:** a podium per board, the winner tallest in the middle.
- **The Hall of Fame:** one carved panel per Season, the Champion's name largest, Relic finders with the Relic's name in its gold.

## Fixtures on `/sandbox`

- a quiet Tavern: a planned Season, nobody online, an empty Feed
- a busy one mid-Season: every Feed kind at least once, six Players online (one still making a Hero), a Hunt, bounties done and not done
- one in the Finale: the Wipe countdown, a podium of three, the Boss weakened by 30%
- a Hall of Fame with two Seasons

## Done when

- The fixtures and the real Tavern read well at 375 px wide and on a desktop, in English and Russian.
- Lodging, the bounty swap and the Rankings still work against the real API.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow (the Tavern is a lazy route; keep it one).
- The pull request has screenshots of the Tavern mid-Season and in the Finale, and of the Hall of Fame.
