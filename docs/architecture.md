# Dark Corner: Architecture

Status: week 1 of the [Season 0 plan](plan-season-0.md) is built (sign-in, admin approval, dice engine, web shell). For gameplay rules, see [design.md](design.md). For terms, see [CONTEXT.md](../CONTEXT.md).

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
- **Items can't be duplicated.** Every change to gold or Items runs in one Postgres transaction with row locks. An Item has exactly one place at a time: worn, in a Bag, in Storage, on the Market, in a Grave, or destroyed.
- **Contracts live in `packages/shared`.** API payloads and replay events are defined there once, and both apps import them. Changes need the owner's approval (see [AGENTS.md](../AGENTS.md)).
- **Time.** Store UTC and schedule in `Asia/Almaty` (UTC+5, Astana time).
- **Two languages.** Every player-facing string exists in both `en` and `ru`.

## Sign-in via the ugolok.world hub

- **The cookie:** the hub signs players in with Discord and sets the `ugolok_sso` cookie on `.ugolok.world`. We check that cookie with a copy of the hub's `sso.ts` (`D:\ugolok.world-site\apps\api\src\sso.ts`, identical in every ugolok repo) and the same `SSO_SECRET`. For how a game uses it, follow `D:\MS_DS_Project\apps\api\src\lib\session.ts` (`requireUser`, `resolveSsoUserId`).
- **First visit:** creates the Player record (Discord ID, name, avatar). An admin approves the Player before they can create a Hero.
- **Hub dashboard:** `GET /api/sso/summary` returns `{registered, profile}` for the hub's dashboard card. CORS allows the hub's account origin, with credentials.
- **Local development:** with `SSO_SECRET` blank, `POST /auth/dev-login` signs you in as any name (optionally as an admin) with our own signed `dc_session` cookie. The route does not exist in production or when SSO is on. The real hub cookie only exists on `.ugolok.world`.
- **The copied file:** `apps/api/src/lib/sso.ts` is byte-for-byte the hub's `sso.ts`; keep it that way.
- **Hub changes (in its own repo):** a card in `apps/account/src/{api,config}.ts` and on the landing page.

## Scheduled jobs

The API polls a jobs table for the Season timeline (Boss gate opening, weekly weakening, end of the Finale, the Wipe) and for Vault announcements. Jobs are idempotent, so restarting the API is always safe.

## Discord

A one-way webhook posts Broadcasts to the friends' channel (`DISCORD_WEBHOOK_URL`). There is no bot in Season 0.

## Live data

There are no websockets in Season 0. The web checks the Feed and "who's online" every 15–30 seconds.

## Deployment

- **Server:** the same Ubuntu VPS as the other ugolok sites. The game has its own `docker-compose.yml` (api, web served by nginx, postgres) and a deploy script run by a systemd timer, like MC's.
- **Domain:** a Caddy site file for `dark.ugolok.world` goes in Aetherbound's Caddy config (`D:\RPG_DND_Game_website\docker\caddy-sites\`), plus a DNS record.
- **Backups:** nightly Postgres backups, copying MC's backup timer.
- **CI:** GitHub Actions runs type checks, tests and the build.

## Local development

| Service | Port |
|---|---|
| Web (Vite; proxies `/api` and `/auth` to the API) | 5180 |
| API | 4100 |
| Postgres (Docker Compose project `dark-corner-dev`) | 5433 |

## Environment variables

Listed with comments in `apps/api/.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `API_PORT`, `API_HOST`, `PUBLIC_WEB_URL`, `SSO_SECRET`, `ACCOUNT_ORIGIN`, `ADMIN_DISCORD_IDS`, `DISCORD_WEBHOOK_URL`, `SERVER_TIMEZONE`.
