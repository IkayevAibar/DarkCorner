# Dark Corner: Architecture

Status: weeks 1–5 of the [Season 0 plan](plan-season-0.md) are built: sign-in and admin approval, Heroes and Items, the Labyrinth and fights, loot and the economy (Shops, Forge, Market, Temple, Event rooms), the Season's life (Boss gate, the Dragon, Vaults, Relics, the Wipe, the Hall of Fame), the Feed and Broadcasts, admin tools, and the production deployment ([deploy.md](deploy.md)). The solo, offline version is under way ([plan-solo-offline.md](plan-solo-offline.md); how it runs: [The solo build](#the-solo-build)). For gameplay rules, see [design.md](design.md). For terms, see [CONTEXT.md](../CONTEXT.md).

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
  android/    the Android app: a Capacitor project around the web app's solo build
packages/
  shared/     the contract: zod schemas and types for API payloads, fight replays, item views
  engine/     pure, deterministic game rules and content: dice, fights, loot, Labyrinth generation, Forge odds
  solo/       the solo build's local backend: the API's services on an in-memory World, saved on the device
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

## Duos

Two Heroes point at each other (`Hero.partnerId`, `apps/api/src/services/duo.ts`). Every Labyrinth action loads the pair with `loadActors()`, which locks both Hero rows in id order, so two Players acting at once wait for each other instead of deadlocking; `activePartner()` then ends a Duo whose Heroes are apart or whose partner has been away 30 minutes, and refuses to act for one away 2 minutes (a stricter "online" than the Tavern's: seen in the last 2 minutes). What an action brings the partner (its fight replay, loot, notes) is tallied into its Run at once and left on its Hero as `duoNews`, which the partner's next Labyrinth response takes and shows (`respond()` merges it). While in a Duo the web looks again every 4 seconds (`useRefresh`), which also keeps the Player "online". A Duo fight has `ally` set in its input; the partner's replay is the same events turned around (`forAlly`), and each Hero is paid by `settle()` from its own side (its gold and drop dice carry an `:ally` suffix).

## Fights played turn by turn

The engine splits a Hero's decision from the dice: `playFight(rng, input, { manual, choices })` runs until a hand-played Hero's turn has no choice left and returns what it can do (`PausedFight`), or runs to the end. The AI that plays automatic fights is the other decider, so `simulateFight` (no manual Heroes) is unchanged and the 30 solo fixture fights stay byte-for-byte the same. A Room fight is a `Fight` row (`apps/api/src/services/liveFights.ts`): the seed, the input as it stood, the manual Heroes and every choice so far. Every look replays it from the first die (fights are small, a few milliseconds); `advance()` first gives a Duo turn older than 30 seconds to the AI, then plays a new choice, and at the end pays both Heroes with `settle()` and deletes the row. `lockHero()` and the Labyrinth actions refuse everything else while a Hero has a `Fight` (`in_fight`), since its health, uses and Bag belong to the fight until it ends.

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
| Web, solo build (`npm run dev:solo -w @dark/web`; no API needed) | 5181 |
| API | 4100 |
| Postgres (Docker Compose project `dark-corner-dev`) | 5433 |

## Environment variables

Listed with comments in `apps/api/.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `API_PORT`, `API_HOST`, `PUBLIC_WEB_URL`, `SSO_SECRET`, `ACCOUNT_ORIGIN`, `ADMIN_DISCORD_IDS`, `DISCORD_WEBHOOK_URL`, `SERVER_TIMEZONE`, and the optional `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

## The solo build

The offline game ([plan-solo-offline.md](plan-solo-offline.md)) answers the web's API calls on the device. `vite --mode solo` sets `__SOLO__`, and `request()` in `apps/web/src/api.ts` then asks `apps/web/src/solo.ts` instead of `fetch`. The normal build leaves all of it out.

- **The services are the server's, copied.** `packages/solo/src/services` and `routes` are `apps/api/src`'s, ported once (as of `9969d96`, the last change there): `new Date()` became the game clock, and a small router stands in for Fastify. They now change on their own; the server's stay as they are. The solo versions of push and the hub sign-in do nothing.
- **The World** (`world.ts`) is a Save: the server's tables, a clock and the Save's settings, written as JSON (Dates and BigInts tagged).
- **The in-memory database** (`db/memdb.ts`) is the slice of Prisma's client the services use, typed as Prisma's own client, so the services compile unchanged. It keeps Postgres's habits where the services can tell:
  - Reads are copies.
  - NULL matches no `not`, `in` or comparison, and never clashes in a unique key.
  - Json is stored as JSON.
  - A throwing `$transaction` is undone.
  - Row locks do nothing.

  `db/schema.gen.ts` describes the tables. It is generated from `apps/api/prisma/schema.prisma` by `npm run gen:schema -w @dark/solo`.
- **The game clock** (`gameClock.ts`): in `'days'` mode in-game time stands still until the Hero sleeps, then jumps to the next morning, 08:00 UTC. Jobs come due over nights and run before each request. `'real'` mode follows the device's clock, as the server does.
- **The solo game's own rules** live in the copies, each with its reason beside it (design.md → The solo game):
  - Days: a night's rest in `services/sleep.ts`, free Lodging, `sleepHere` in `services/labyrinth.ts` (a Camp's full rest, or a rough night anywhere else), and wording for what lasts until the night in `services/days.ts`.
  - Chapters: the early Boss gate and the gate-based weakening in `services/chapters.ts`; the Dragon's fall in `services/boss.ts` ends the Chapter.
  - The Save's settings: `settings.ts` holds the loaded World's, as `gameClock.ts` holds its clock. Difficulty is `services/difficulty.ts`; Iron mode is in `die` in `services/fights.ts`.
  - Alone: the Hunt sized for one Hero, the Daily Delve's Chests by Rooms won, and no Free market Omen.
  - The Companion: `services/companion.ts`.
    - A Companion is a Hero owned by a Player of its own, `COMPANION_PLAYER`. That Player is never online, approved or ranked, so the Records, the Hunt and the Vaults pass it by. The Duo code walks, fights and shares with it as with a friend's Hero.
    - Where a Companion differs, the Duo services ask `isCompanion`. It has no Stamina, loot, events or Deeds of its own; the AI plays all its turns; it runs with its Hero (`follows` on the engine's `AllyInput`); it goes through a Town Portal; and it waits at the door of the Dragon's lair.
    - `tendCompanion` runs in `loadActors` before every action: the morning's wage, its level kept to the Hero's, a fallen Companion back, and back beside its Hero.
    - Its wage, Loyalty and fall live in the World's `Setting` table under `companion`, so the server's schema stays as it is.
  - The routes the server lacks: `routes/solo.ts` (the Save's settings), `routes/companion.ts` (`/api/companion…`, and `POST /api/labyrinth/chest/all` to take a whole Duo Chest), and `POST /api/labyrinth/sleep`.
- **The backend** (`backend.ts`) runs one request at a time. A request that throws leaves the World as it was. After any change it saves: IndexedDB in a browser, falling back to memory.
- **The screens follow the World,** not the device:
  - `src/solo.ts` hands the World's clock to `src/time.ts`. Countdowns, `useNow` and `useAt` count in game time, and redraw when the Hero sleeps. Code that needs the time for a countdown takes it from `useNow()` or `clockNow()`, never from `Date.now()`.
  - Nothing polls. `useRefresh` does nothing offline, and every `useLoad` loads again when the day turns.
  - The Duo card, push settings, Sign out, the approval status and the Market are left out of the solo build.
  - A Duo's partner is always the Companion offline. The Duo strip drops the online mark and the Leave button, the Tavern has a Companion card (`screens/city/Companion.tsx`), and gear in the Bag gets a "Give to" button. The trust scenes' lines say how a Companion swears and picks (`screens/labyrinth/trust/messages.ts`).
  - `src/i18n/solo.ts` lays the solo build's own lines over `en` and `ru`: nights instead of hours, Chapters instead of Seasons, one Player instead of many. A line that reads differently offline goes there, in both languages.
- **Tests:** `packages/solo/test` runs the server's API scenarios on the solo backend (a `solo_player` cookie plays several Players at once there), plus the in-memory database's own tests and `backend.test.ts` for Saves and Days.
- **The bots:** `npm run playtest -w @dark/solo [-- days]` plays the server's playtest bots (`apps/api/scripts/playtest.ts`, moved to Days) on the solo backend: a World each, a Day's Stamina, then bed in a Camp or at the Tavern, or a rough night where it stands. `PLAYTEST_CLASSES=cleric,ranger` plays only those, `PLAYTEST_TRACE_DAY=N` prints each step of that Day, and `PLAYTEST_COMPANION=1` has each bot hire a Companion and dress it, pick at Duo Chests and swear at Oathstones. A bot that still cannot sleep is a finding in the report.
- **The Android app** (`apps/android`) is Capacitor 8 around the solo build: the WebView serves `apps/web/dist-solo` from the APK at `https://localhost`, and the Save lives in that WebView's IndexedDB.
  - `npm run apk -w @dark/android` builds the web app, copies it in and builds a debug APK with the Gradle wrapper. Use JDK 21: Android Studio's own Java 25 is too new for the pinned Gradle.
  - `npm run open -w @dark/android` opens the project in Android Studio.
  - `npm run icons -w @dark/android` remakes the launcher icons and splash screens from the web app's icons with ffmpeg.
  - `apps/android/android` is the native project. Capacitor generated it; the edits are the app name in `values-ru`, the portrait lock, the splash and window colour, and edge to edge with dark system bars in `MainActivity`. Build output and the copied web app stay out of git.
  - **The back button** is `apps/web/src/native.ts`, which only the app loads. It sends Escape to the topmost `role="dialog"`; with no dialog open it goes back a screen, and on the first screen it puts the app away. So every dialog, sheet and full-screen scene needs `role="dialog"` and an Escape handler, or Back walks past it.
  - **On an emulator:** install with `adb install -r`. A debug build's WebView answers Chrome DevTools: open `chrome://inspect`, or run `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`. Under the emulator's software GPU, `adb` screenshots can smear the sticky header; the page itself draws correctly.
