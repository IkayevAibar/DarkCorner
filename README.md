# Dark Corner (Тёмный уголок)

A season-based dark-fantasy browser game for a small group of friends. It lives at `dark.ugolok.world`, and players sign in through the ugolok.world hub.

- **What the game is:** [docs/design.md](docs/design.md). Words the game uses: [CONTEXT.md](CONTEXT.md).
- **How it's built:** [docs/architecture.md](docs/architecture.md).
- **What's next:** a solo, offline version for Android: [docs/plan-solo-offline.md](docs/plan-solo-offline.md). Season 0's plan: [docs/plan-season-0.md](docs/plan-season-0.md); launch week step by step: [docs/launch.md](docs/launch.md).
- **Running it:** [docs/deploy.md](docs/deploy.md) (the server, and running a Season from the admin page).
- **For Claude and Codex:** [AGENTS.md](AGENTS.md).

## Run it locally

You need Node 22+ and Docker.

```bash
cp apps/api/.env.example apps/api/.env
npm run setup
npm run dev
```

Open <http://localhost:5180>. The dev login lets you sign in as anyone. Tick "admin" for the first account, then use a second browser profile to be a friend waiting for approval. The Labyrinth opens once an admin starts the Season: account sheet → Admin → Season → Start the Season. The Grant tab gives testers gold and Items.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the database, the API (:4100) and the web app (:5180) |
| `npm run dev:solo -w @dark/web` | Starts the solo, offline game (:5181): no database, no API, the Save in the browser |
| `npm run apk -w @dark/android` | Builds the solo game as an Android debug APK (needs the Android SDK and JDK 21) |
| `npm run open -w @dark/android` | Opens the Android project in Android Studio |
| `npm test` | Runs every package's tests. API tests use their own database, `dark_corner_test` |
| `npm run typecheck` | Type-checks every package |
| `npm run build` | Builds the API bundle and the web app |
| `npm run db:down` | Stops the local database. Your data stays in a Docker volume |

## Credits

- Icons by Lorc, Delapouite, Willdabeast and DarkZaitzev from [game-icons.net](https://game-icons.net), CC BY 3.0.
- Sound effects from Kenney's [RPG Audio](https://kenney.nl/assets/rpg-audio) and [Casino Audio](https://kenney.nl/assets/casino-audio), CC0. Thank you, Kenney.
- This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

The same credits are in the game: account sheet → Credits. [docs/art/icons-and-sounds.md](docs/art/icons-and-sounds.md) lists every icon and sound file.
