# Codex task 08: the Tavern and the Hall of Fame

**Branch:** `codex/tavern`, based on `main`.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The Tavern is where Players see each other ([design.md → Feed and broadcasts](../design.md#feed-and-broadcasts)): who's online, what just happened in the Labyrinth, and how the Season stands. The Hall of Fame is the only thing that survives a Wipe, so it should feel like carved stone. Claude's stand-in works; make it a place.

## Contract

`GET /api/tavern` → `TavernView` and `GET /api/hall` → `HallView` (`packages/shared/src/season.ts`):

- `season`: status (`planned`, `active`, `finale`, `ended`), `bossGateAt`, `weakening` (0–0.4), `wipeAt` (set once someone beats the Boss), the `podium`, and `relicsLeft`.
- `online`: Players seen in the last 10 minutes, their Hero and where it is.
- `entries`: the Feed, newest first. Each line comes ready in both languages (`text`) with a `tier` when it is about an Item (color it with `--color-tier-*`). `kind` says what happened: `drop`, `chest`, `identify`, `relic`, `upgrade10`, `market-sale`, `death`, `depth`, `vault`, `vault-announced`, `boss-attempt`, `boss-kill`, `gate-open`, `weaken`.
- `HallView.entries`: per Season, `champion`, `second`, `third`, `relic`, `deepest`, `highest-level`, with the Player and Hero names and a `detail` line.
- `GET /api/tavern/rankings` → `RankingsView`: one board per `RANKINGS` kind (see [design.md → Rankings](../design.md#rankings)). Each has its top ten `rows` and `me`, the Player's own row when it is lower. A row has `rank` (ties share it), the Player, the Hero with `portraitUrl` and `banner`, the `value`, the `item` on the finest board, and `me`.

Refresh the Tavern every 20–30 seconds while it is on screen (no websockets in Season 0).

## Look

- The Tavern: warm light in the ink style, the Season card like a notice nailed to a post (countdown to the gate or the Wipe), faces of who's here as small tokens, and the Feed as a scrolling board. Relic and Mythic lines stand out; deaths are grim.
- The Rankings: a podium per board, the winner tallest in the middle. Claude's stand-in shows the layout.
- The Hall of Fame: one carved panel per Season, the Champion's name largest, Relic finders with the Relic's name in its gold.

## Where

- Claude's stand-in: `apps/web/src/screens/city/Tavern.tsx` (Feed, Rankings and Hall of Fame tabs), with the Rankings in `Rankings.tsx`. Replace it in place or split the Hall of Fame into its own route (`/city/hall`) and link it from the Tavern.
- Fixtures on `/sandbox`: a quiet Tavern, a busy one mid-Season, one in the Finale, and a Hall of Fame with two Seasons.
- Text via `t()`, in both `en.ts` and `ru.ts`; reuse the `tavern.*`, `season.*` and `hall.*` keys.

## Done when

- The fixtures and the real Tavern read well at 375 px wide and on a desktop, in English and Russian.
- `npm run typecheck` and `npm run build` pass.
- The pull request has screenshots of the Tavern in the Finale and of the Hall of Fame.
