# Codex task 20: the goblin's cups

**Branch:** `codex/goblin-cups`, based on `main` once `claude/goblin-cups` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

The Goblin gambler now also plays cups, the shell game (docs/design.md → Event rooms). The stake goes down first. Then he shows a gem under one of three cups and shuffles: more swaps and quicker ones deeper down. The Player picks the gem's cup, or calls his cheat: a quarter of the time he palms the gem and no cup holds it, and a Rogue's eye catches that. A right cup or a caught cheat pays double.

It works today with a plain stand-in, `apps/web/src/screens/labyrinth/Cups.tsx`: three domes that slide. The `/sandbox` page has it against fake games (Floor 1 or 10, palmed or not, a Rogue or not). Make it the street hustle it is: a grinning goblin, quick hands, cups that clack, and a reveal that stings when the gem was up his sleeve.

## Contract (already in `packages/shared`)

- `EventView` of kind `gambler` has `cups: CupsView`: `maxBet`, and `game`, null until a stake is down.
- `game`: `bet`; `start` (the place, 0–2 left to right, of the cup the gem goes under); `swaps` (each `[a, b]` trades the cups standing at places `a` and `b`, and the gem moves with its cup); `swapMs` (how long each swap takes on screen); `palmed` (true or false for a Rogue, null for anyone else); `end`, null until picked, then `{ gem, won }` with `gem` the place it was (null: up his sleeve).
- `POST /api/labyrinth/event { action: 'cups-bet', amount }` puts the stake down; the game comes back in the view. `{ action: 'cups-pick', pick }` with `pick` a place (0–2) or `'cheat'` settles it: the result's notices say what happened and `gold` what was won.
- The game only shows once the stake is down, and the stand-in plays the shuffle once, for a stake put down while it was on screen. Seen again (a reload, or coming back), the cups stand where the shuffle left them. Keep that: the shuffle can't be watched twice.
- The stand-in's props: `{ cups: CupsView; busy: boolean; onBet: (amount: number) => void; onPick: (pick: number | 'cheat') => void }`. Keep them, so the swap is one file.

## What to build

1. **The table:** the goblin behind three cups, the gem shown under its cup before the shuffle.
2. **The shuffle:** each swap an arc of two cups crossing, timed by `swapMs`, with a clack (`tick` or a fitting CC0 sound; ask the owner before downloading anything).
3. **The pick:** cups lift on a tap. A win lifts the gem's cup; a palmed gem shows his empty hands, then the gem drawn from his sleeve; a cheat called right, his sleeve shaken out.
4. **The Rogue's eye:** when `palmed` isn't null, a quick glint or close-up of his hand before the pick.

## Done when

- The shuffle can be followed (not easily deep down) and a cup picked, on a phone held upright.
- With reduced motion, the swaps still happen (they are the game), without arcs or shake.
- `npm run typecheck`, `npm test` and `npm run build` pass, and the first-load bundle doesn't grow.
- The PR has a short screen recording (kept out of the branch).
