# Dark Corner: Architecture

Status: weeks 1–5 of the [Season 0 plan](plan-season-0.md) are built: sign-in and admin approval, Heroes and Items, the Labyrinth and fights, loot and the economy (Shops, Forge, Market, Temple, Event rooms), the Season's life (Boss gate, the Dragon, Vaults, Relics, the Wipe, the Hall of Fame), the Feed and Broadcasts, admin tools, and the production deployment ([deploy.md](deploy.md)). For gameplay rules, see [design.md](design.md). For terms, see [CONTEXT.md](../CONTEXT.md).

## Stack

The stack mostly matches the owner's Minecraft project (`D:\MS_DS_Project`), so knowledge and snippets carry over.

- **Everywhere:** TypeScript (strict, `noUncheckedIndexedAccess`), in an npm workspaces monorepo.
- **API:** Fastify 5, zod, Prisma 6, Postgres 17. Dev runs with `tsx watch`; production is one ESM bundle from `tsup`.
- **Web:** React 19, Vite 6, Tailwind 4 and react-router 7. PixiJS 8 will draw the animated scenes and Howler.js will play sound. The web app will be an installable PWA.
- **Tests:** vitest. API tests run against a separate `dark_corner_test` database.
- **Workspace packages** (`@dark/shared`, `@dark/engine`) ship TypeScript source; Vite, tsx and tsup compile them where they are used, so there is no package build step.

## Layout

```
apps/
  api/        Fastify server: sign-in, game actions, admin, scheduler, Discord webhook
  web/        React app: screens, i18n (en, ru), PixiJS scenes, /sandbox page with fake data
packages/
  shared/     the contract: zod schemas and types for API payloads, fight replays, item views
  engine/     pure, deterministic game rules and content: dice, fights, loot, Labyrinth generation, Forge odds
```

## Rules the code follows

- **The server decides.** Every random roll, fight, drop, and every change to gold or Items happens in `apps/api`, using `packages/engine`. The browser only shows results.
- **The engine is deterministic.** Engine functions take a seeded random number generator, so any fight or drop can be replayed exactly and tested. A fight returns a **replay**, a list of events that the web plays back.
- **Rolls are logged.** Every roll that matters (drops, Forge, Chests, Death saves, Escape rolls) is stored with its seed and result, so any argument about a roll can be checked.
- **Items can't be duplicated.** Every change to gold or Items runs in one Postgres transaction that starts by locking the Hero's row (`apps/api/src/services/ledger.ts`); Market listings and Graves are locked the same way. An Item has exactly one place at a time: worn, in a Bag, in Storage, on the Market, in a Grave, or destroyed. `apps/api/test/economy.test.ts` races requests against each other to prove it.
- **Contracts live in `packages/shared`.** API payloads and replay events are defined there once, and both apps import them. Changes need the owner's approval (see [AGENTS.md](../AGENTS.md)).
- **Time.** Store UTC and schedule in `Asia/Almaty` (UTC+5, Astana time).
- **Two languages.** Every player-facing string exists in both `en` and `ru`.

## The Labyrinth

- **Generated, never stored.** `generateLabyrinth(seed)` in the engine builds all 10 Floors from the Season's seed; the API caches it in memory. Changing generation means bumping `LABYRINTH_VERSION`, because a running Season must keep its Labyrinth.
- **Per Hero:** `HeroFloor` holds the Rooms a Hero has seen on a Floor (its Map) and when it last cleared each one. The Hero row holds where it stands, its Stamina clock and its abilities left until the next rest.
- **Shared:** Graves (48 hours) and `SpecialClaim` (who took a Mini-boss or Vault, and when).
- **Fights:** a Move into a monster Room runs `simulateFight` on the server with a fresh seed (kept in the roll log). The events come back as a replay, checked against `fightReplaySchema` before they leave the API, and the web plays them back. `npm run fixtures:fights -w @dark/api` writes sample replays for `/sandbox`.

## Sign-in via the ugolok.world hub

- **The cookie:** the hub signs players in with Discord and sets the `ugolok_sso` cookie on `.ugolok.world`. We check that cookie with a copy of the hub's `sso.ts` (`D:\ugolok.world-site\apps\api\src\sso.ts`, identical in every ugolok repo) and the same `SSO_SECRET`. For how a game uses it, follow `D:\MS_DS_Project\apps\api\src\lib\session.ts` (`requireUser`, `resolveSsoUserId`).
- **First visit:** creates the Player record (Discord ID, name, avatar). An admin approves the Player before they can create a Hero, unless the gate is open (the `Setting` table, key `gate`).
- **Hub dashboard:** `GET /api/sso/summary` returns `{registered, profile}` for the hub's dashboard card. CORS allows the hub's account origin, with credentials.
- **Local development:** with `SSO_SECRET` blank, `POST /auth/dev-login` signs you in as any name (optionally as an admin) with our own signed `dc_session` cookie. The route does not exist in production or when SSO is on. The real hub cookie only exists on `.ugolok.world`.
- **The copied file:** `apps/api/src/lib/sso.ts` is byte-for-byte the hub's `sso.ts`; keep it that way.
- **Hub changes (in its own repo):** a card in `apps/account/src/{api,config}.ts` and on the landing page. `GET /api/sso/summary` gives the card `profile.hero`: the Hero's name, level, deepest Floor and best identified Item (name in both languages, Tier).

## Scheduled jobs

The API polls the `Job` table every 30 seconds (`apps/api/src/services/scheduler.ts`) for the Season timeline (the Boss gate opening, the weekly weakening, the Wipe at the end of the Finale), the daily Vault announcement roll, and Broadcasts. A job is claimed with `FOR UPDATE SKIP LOCKED`, retried with a growing delay up to five times, and must be idempotent, so restarting the API is always safe. Handlers register with `onJob()`; `services/jobs.ts` imports every module that has them. Admin actions run due jobs at once, and tests call `runDueJobs()` themselves.

## Discord

A one-way webhook posts Broadcasts to the friends' channel (`DISCORD_WEBHOOK_URL`), in Russian and English. `broadcast()` queues a job inside the transaction of the thing it announces, so a Broadcast only goes out if that really happened, and a Discord outage never fails a Player's action. Without a webhook, Broadcasts are skipped. There is no bot in Season 0.

## Push notifications

Web Push with VAPID (`apps/api/src/services/push.ts`, the `web-push` library to encrypt and sign; `fetch` sends). The key pair comes from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` when set, otherwise the API makes one once and keeps it in the `Setting` table (key `vapid`); changing it cuts off every device. Each device is a `PushSubscription` row; a push service answering 404 or 410 deletes it. Things that happen (a Market sale, the Boss gate) call `notify()`/`notifyAll()`, which queue a `push` job inside their transaction. Things that come due with time (full Stamina, a finished Camp rest) are found by the `push-sweep` job, which reschedules itself every 5 minutes (`startPushSweep()` makes sure one waits when the API starts) and marks what it told on the Hero (`staminaPushAt`, `campPushAt`). Quiet hours (23:00–08:00) use each device's time zone. The web's `public/sw.js` only shows notifications and opens the game on a tap; it caches nothing.

## Live data

There are no websockets in Season 0. The web checks the Feed and "who's online" (`GET /api/tavern`) every 15–30 seconds. Players are online if they made a request in the last 10 minutes (`Player.lastSeenAt`, written at most once a minute).

## Deployment

- **Server:** the same Ubuntu VPS as the other ugolok sites. The game has its own `docker-compose.yml` (api, web served by nginx, postgres) and a deploy script run by a systemd timer, like MC's.
- **Domain:** a Caddy site file for `dark.ugolok.world` goes in Aetherbound's Caddy config (`D:\RPG_DND_Game_website\docker\caddy-sites\`), plus a DNS record.
- **Backups:** nightly Postgres backups, copying MC's backup timer.
- **CI:** GitHub Actions runs type checks, tests and the build.
- **Patch notes:** a release that Players will notice adds an entry at the top of `apps/web/src/news.ts` (a new `id`, the date, and short lines in `en` and `ru`). Every entry keeps its own literal id; set `LATEST_NEWS_ID` in `apps/web/src/newsState.ts` to the new one (`news.test.ts` checks both). The navigation imports only this small metadata module; the "What's new" page loads the notes and the top bar marks it with a dot until each Player has opened it.

## Local development

| Service | Port |
|---|---|
| Web (Vite; proxies `/api` and `/auth` to the API) | 5180 |
| API | 4100 |
| Postgres (Docker Compose project `dark-corner-dev`) | 5433 |

## Environment variables

Listed with comments in `apps/api/.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `API_PORT`, `API_HOST`, `PUBLIC_WEB_URL`, `SSO_SECRET`, `ACCOUNT_ORIGIN`, `ADMIN_DISCORD_IDS`, `DISCORD_WEBHOOK_URL`, `SERVER_TIMEZONE`, and the optional `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
