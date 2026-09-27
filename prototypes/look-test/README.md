# Look test (PROTOTYPE, throwaway)

**Question:** do the AI-generated ink art and a UI around it look right on a phone, and which UI look fits best?

**Plan:** one page with the City, the Labyrinth (a fight in a Room), Loot (every Tier, the Chest Spin, identifying) and Heroes. It comes in three UI looks, switchable with `?variant=`:

- **A · Parchment**: tabletop-book panels, ink borders, stamped item tiles.
- **B · Crypt**: dark stone, brass corners, gothic small caps.
- **C · Void**: flat modern dark UI; the art and the Tier colors do the talking.

## Run

```bash
npm run look-test
```

Then open <http://127.0.0.1:5178/?variant=B>.

- **Switch looks:** use the white pill at the bottom, or the ← → keys.
- **Open a screen directly:** add `&tab=city|fight|loot|heroes`.
- **Russian:** add `&lang=ru`, or tap RU at the top.
- **On a phone:** start it with `HOST=0.0.0.0` on the same Wi-Fi and open your PC's address. In PowerShell: `$env:HOST='0.0.0.0'; npm run look-test`.

## What is fake here

- Drop odds, crit chance and Radiant odds are boosted so the rare effects show up often. The real numbers are in `docs/design.md`.
- Common–Epic item icons are hand-drawn stand-ins for game-icons.net.
- Legendary, Mythic and Relic items all reuse the one painted sword.
- The fight is a tiny mock of the D&D rules. It isn't the engine.
- Sound is synthesized. Nothing is saved.

## Assets

`assets/` holds phone-sized copies of `art/look-test/` (5.4 MB instead of 34 MB). The originals stay in `art/look-test/`.
