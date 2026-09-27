# Deploying Dark Corner

Dark Corner runs on the same Ubuntu VPS as the other ugolok.world sites (`root@92.38.49.9`, clock set to Asia/Almaty). It is a checkout of `main` in `/opt/darkcorner`, running the Docker Compose project `darkcorner` with containers prefixed `dc-`.

The live server was set up on 2026-09-27. It clones over HTTPS, which works because the repo is public; a private repo would need the deploy key.

**A fresh server:** run the setup wizard from the repo root in Git Bash: `bash scripts/setup-server.sh`. It covers:
- the DNS record
- the deploy key
- cloning the repo
- the server `.env`
- the Caddy route
- the first deploy
- the timers

## How it fits on the box

| What | Where |
|---|---|
| Web (nginx serving the app, proxying `/api` and `/auth`) | `dc-web` on `172.17.0.1:8089`, reachable by Caddy only |
| API | `dc-api` on `127.0.0.1:4002` (container port 4100) |
| Postgres 17 | `dc-postgres`, not published; volume `darkcorner_pgdata` |
| TLS and the domain | the shared Caddy (`cg-caddy`) from the Aetherbound repo, site file `docker/caddy-sites/darkcorner.caddy` |
| Secrets | `/opt/darkcorner/.env` (see `.env.production.example`); `SSO_SECRET` must equal the hub's |

Caddy reaches the web container through `host.docker.internal`, which is the Docker bridge `172.17.0.1`. Keep the web port bound there: loopback is unreachable from Caddy, and `0.0.0.0` would make the site public over plain HTTP, since ufw does not block Docker-published ports.

## Everyday operations

| Task | Command (on the server) |
|---|---|
| **Deploy** | Automatic: push to `main`. `darkcorner-deploy.timer` checks every 2 minutes and rebuilds only what changed. |
| Deploy log | `tail -f /var/log/darkcorner-deploy.log` |
| Force a full rebuild | `/opt/darkcorner/scripts/deploy.sh --force` |
| Pause deploys | `echo "why" > /opt/darkcorner/.deploy-pause`; delete the file to resume |
| API logs | `cd /opt/darkcorner && docker compose logs -f --tail 100 api` |
| Change `.env` | Edit it, then `docker compose up -d` (a restart does not re-read `.env`) |
| Backups | `darkcorner-backup.timer` runs nightly at 04:50 UTC and writes to `/opt/darkcorner/backups/daily`, keeping 14. A dump is also taken before any deploy that runs a migration. |
| Restore a backup | `gunzip -c backups/daily/darkcorner-db_<stamp>.sql.gz \| docker exec -i dc-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |

Copy backups off the box now and then: a backup on the same disk is only half a backup.

## Running a Season

Everything is on the admin page (the account sheet → Admin → **Season**). The scheduler runs inside `dc-api`, so there is nothing else to start.

| Task | How |
|---|---|
| Start a Season | **Start the Season**. Heroes made before the start keep playing; the Labyrinth opens now and the Boss gate in 14 days. |
| Broadcasts | Set `DISCORD_WEBHOOK_URL` in `.env` (then `docker compose up -d`). The Season tab warns when it is missing. |
| Test the Dragon early | **Open the Boss gate now**. |
| Test a Vault race | **Announce a Vault** with the minutes until it opens. |
| Give a tester gold or Items | the **Grant** tab (Relics can't be granted). |
| Check a disputed roll | the **Rolls** tab: every drop, fight, Chest, Forge and event roll with its seed. |
| End a Season early | **End the Season (Wipe)**. Normally the Wipe comes on its own 72 hours after the first Boss kill. |
| Stuck jobs | the Season tab lists jobs with their last error; they retry up to five times. |

## Rules that save an evening

- **New env variables:** add a variable to the server's `.env` *before* pushing code that reads it, or the API crash-loops.
- **Migrations:** never edit a committed migration, and keep `migration.sql` free of a byte-order mark. A BOM crash-looped the Minecraft site once.
- **Memory:** every service has a `mem_limit`. The Minecraft server holds about 5 GB and the OOM killer has struck before.
- **Leave the other sites alone:** never touch `/opt/hardcore`, `/opt/cardgame` or `/opt/ugolok`, or their containers and volumes, beyond the Caddy steps. Never run `docker system prune -a` or `docker volume prune`.
- **Harmless log lines:** "cannot reach origin" means GitHub didn't answer the box for a moment. The next check two minutes later tries again.
- **Caddy changes need a manual reload:** Aetherbound's deploy does not reload Caddy. After changing a site file or Caddy's environment, first validate:
  ```
  cd /opt/cardgame && docker compose run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  ```
  then apply it with `docker compose up -d caddy`.
