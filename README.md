# Dark Corner (Тёмный уголок)

A season-based dark-fantasy browser game for a small group of friends. It lives at `dark.ugolok.world`, and players sign in through the ugolok.world hub.

- **What the game is:** [docs/design.md](docs/design.md). Words the game uses: [CONTEXT.md](CONTEXT.md).
- **How it's built:** [docs/architecture.md](docs/architecture.md).
- **What's next:** [docs/plan-season-0.md](docs/plan-season-0.md); launch week step by step: [docs/launch.md](docs/launch.md).
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
| `npm test` | Runs the engine and API tests. API tests use their own database, `dark_corner_test` |
| `npm run typecheck` | Type-checks every package |
| `npm run build` | Builds the API bundle and the web app |
| `npm run db:down` | Stops the local database. Your data stays in a Docker volume |
