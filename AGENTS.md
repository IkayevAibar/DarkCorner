# Dark Corner (Тёмный уголок)

A dark-fantasy browser dungeon game for a small group of friends that runs in seasons, at `dark.ugolok.world`. One developer (the owner) builds it with two AI agents: Claude Code and Codex.

## Read first

- `CONTEXT.md`: the glossary. Use its terms in code, UI text and commits: Hero, Labyrinth, Run, Bonus stat.
- `docs/design.md`: gameplay rules and numbers. It is the source of truth for how the game plays. Numbers tagged *(v0)* can be tuned.
- `docs/architecture.md`: the stack, the repo layout, and the rules the code follows.

## Who owns what

- **Claude Code** owns:
  - `packages/shared`, the contract
  - `packages/engine`, the rules and content
  - `apps/api`
  - connecting `apps/web` screens to the API
- **Codex** owns self-contained visual work in `apps/web`:
  - PixiJS scenes (fight playback, the Chest Spin, the identify reveal, drop effects)
  - Item cards and Tier frames
  - animations and sound hooks

  Codex builds against `packages/shared` types, using fake data on the `/sandbox` page. Codex also reviews Claude's pull requests.

  Codex's tasks are briefs in `docs/tasks/` (`codex-NN-*.md`), each naming its branch, contract and "done when". Claude leaves a working stand-in with the same props wherever a Codex component will go, so the swap is small.
- Each agent works inside its own area. If you need something from the other side, write it as a request in your pull request description.

## Working rules

- Use one branch per task: `claude/<topic>` or `codex/<topic>`. Open a pull request, and the owner merges it.
- A change to `packages/shared` needs the owner's approval in the pull request, because it is the contract between the two agents.
- The server makes every random roll and every change to gold or Items. The web shows the results.
- Every player-facing string is written in both `en` and `ru`. English capitalizes glossary terms (Stamina, Floor, Item). Russian uses one word per term: Hero герой, Floor этаж, Room комната, Door дверь, Clue подсказка, Map карта, Stamina выносливость, Run вылазка, Waypoint путевой камень, Camp лагерь, Grave могила, Bag сумка, Storage хранилище, Item предмет, Tier ранг, Chest сундук, Key ключ, Treasure room клад, Vault сокровищница, Boss gate врата босса, Blessing благословение, Broadcast оповещение, Listing объявление, Retire отправить на покой, Wipe вайп, Feed лента, Hall of Fame зал славы, Stance стойка, Threat угроза, Sneak прокрасться, Retreat отступить, Escape roll бросок побега, Bomb бомба, Elite элита, Path путь, Talent талант. Phrase anything about the Player's Hero without gendered verbs or adjectives (present tense, or restructure).
- Design screens for a phone held upright first, then widen them for desktop.
- When a gameplay rule changes, update `docs/design.md` in the same pull request. When you add a new game term, add it to `CONTEXT.md`.
