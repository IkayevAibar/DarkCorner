# Launch week: the test Season and Season 0

Week 6 of the [Season 0 plan](plan-season-0.md): a short test Season with 2–3 friends on the real server, fixes, a go/no-go, then Season 0 on **Friday 2026-11-06**. Everything below happens on `dark.ugolok.world` and the admin page (account sheet → Admin).

## Before Monday

- [ ] Merge the week branches into `main` in order (`claude/week-1` … `claude/week-5`), plus any Codex branches that are ready. The server deploys `main` within 2 minutes.
- [ ] The server is set up (`bash scripts/setup-server.sh`, see [deploy.md](deploy.md)), and `DISCORD_WEBHOOK_URL` is in `/opt/darkcorner/.env`. The Season tab warns when it is missing.
- [ ] The hub shows the game's card: the change is written out in [hub-card.md](hub-card.md), for a pull request in the hub's own repo. `GET /api/sso/summary` already sends the Hero's level, deepest Floor and best Item.
- [ ] The testers have signed in once through the hub, and are approved on the Players tab.

## Monday: start the test Season

- [ ] Season tab → **Start the Season**. A Broadcast goes to Discord.
- [ ] Everyone creates a Hero and makes a Run.
- [ ] To reach the late game in days instead of weeks, use the admin tools:
  - **Grant** gold, Keys, Chests and gear of any Tier to testers.
  - **Announce a Vault** opening in 10 minutes and race for it.
  - **Open the Boss gate now**, grant a tester strong gear, and let them try the Dragon: the Champion, the Finale and places 2 and 3.

## Monday to Wednesday: find what breaks

Play through every part at least once, in both languages:

- [ ] Sign-in through the hub, approval, creating a Hero (rerolls, Talents, portraits).
- [ ] A full Run: Doors and Clues, fights, death saves, dying (Grave, Temple, Starter kit), looting your own Grave, Camps, Waypoints, Town Portals, the stairs both ways.
- [ ] Every Event room, the Shops, the Forge (including a destroyed Item), the Market between two Players, the Temple, Chests and identifying.
- [ ] Vaults (plain and announced), a Relic (grant a Mini-boss kill on Floor 7+ or announce Vaults until one drops), the Feed and Broadcasts.
- [ ] Phones: Android Chrome and iPhone Safari, portrait. Install it to the home screen (both), check the tab bar, the bottom sheets and the fight playback.
- [ ] Tune numbers from what testers feel: `packages/engine/src/economy.ts` (`LOOT`, prices), `content/monsters.ts`, `content/loot.ts`. Rerun `npm run balance:season -w @dark/engine`, `npm run balance:fights -w @dark/engine` and `npm run balance:par -w @dark/engine` after changes, and `npm run playtest -w @dark/api` (bots play 14 days through the API on the test database; `npm run power-check -w @dark/api` then shows what those Heroes can beat).
- [ ] **Backup drill:** on the server, `bash scripts/backup.sh`, then `bash scripts/restore-drill.sh`. It restores the newest backup into a scratch database, prints what came back, and drops it.

## Thursday: go or no-go

- [ ] Go if nothing loses Items or gold, sign-in works for everyone, and a Run works on both phones. Anything else can ship as an update during the Season (the cut list is at the end of the plan).
- [ ] Season tab → **Discard as a test Season**. It ends without Hall of Fame entries, and the next Season is numbered 0 again. The testers' Heroes stay behind in the discarded Season.

## Friday: Season 0

- [ ] Season tab → **Start the Season**. The Broadcast announces it; post the link in Discord too.
- [ ] Watch the API logs for the first hour: `cd /opt/darkcorner && docker compose logs -f --tail 100 api`.
- [ ] Day 14 (≈ Nov 20): the Boss gate opens by itself. Before then, check the Dragon on the live server.
