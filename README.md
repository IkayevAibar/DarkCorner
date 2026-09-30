# Floor map review — 7db324d

Evidence only. This orphan branch must never be merged into main.

The implementation is on `codex/floor-map`, based on main `c5456c1`.

## Rebase onto main b8b99b8

Implementation head is now `0e4c1d7`. Only the two news conflicts needed resolution: every entry retained its literal id, the Map entry remains newest, and `LATEST_NEWS_ID` matches. Map drawings and fixtures are unchanged from these screenshots.

Typecheck, build, all 27 web tests and 209 engine tests pass. The API suite passed 135/136 initially: the unchanged Fallen champion test at `apps/api/test/lair.test.ts:89` expected one loot Item and got two. Its isolated rerun passed, as did the later full 136-test API run during Class-effects work.

See `rebase-bundle.json` for the updated baseline. Combined initial JS + CSS shrinks from 501,062 to 501,004 bytes; gzip 161,512 → 161,494. The new lazy CSS reference adds 31 bytes to the initial JS manifest, while initial CSS drops 89 bytes. No new runtime dependency.

## Fixtures

Each screenshot includes the full Floor map and its 104 px mini-map. The four fixtures were checked at 375 and 1280 px, in English and Russian, with ordinary and reduced motion (32 combinations). Fixed app navigation is hidden in fixture screenshots so it does not obscure the captured card.

| Fixture | English, 375 px | Russian, 375 px | Desktop |
| --- | --- | --- | --- |
| Fresh Floor | [View](fresh-en-375.png) | [View](fresh-ru-375.png) | [View](fresh-en-1280.png) |
| Half explored, all Door kinds | [View](half-en-375.png) | [View](half-ru-375.png) | [View](half-en-1280.png) |
| Nearly full 10×10 Floor | [View](full-en-375.png) | [View](full-ru-375.png) | [View](full-en-1280.png) |
| Revealed path to the Dragon | [View](lair-en-375.png) | [View](lair-ru-375.png) | [View](lair-en-1280.png) |

[Legend](legend-en-375.png) · [Russian legend](legend-ru-375.png) · [Mini-map motion recording](mini-map-motion.webm)

## Real API

[Before](live-map-before.png) · [After](live-map-after.png) · [Recording](real-map-move.webm)

The actual Labyrinth screen moved a Fighter from Room 70 to 60 when the Map Room was tapped. Uses the local API and isolated `dark_corner_test` database; no network response stubs. See `live-api-check.json`.

## Checks

- `npm run typecheck`, `npm test` (127 API + 27 web + 192 engine = 346), `npm run build`: pass.
- `browser-checks.json`: no horizontal overflow, unique SVG definitions, keyboard movement, mini-map opens the full Map, localized legend, 52 px or taller exit controls, immediate full Map and reduced-motion suppression.
- `bundle.json`: initial JS 439,989 → 439,987 bytes; gzip 146,826 → 146,819. Initial CSS 45,359 → 45,270 bytes; gzip 9,986 → 9,954. Map code/styles/translations load with the Labyrinth. No added dependency.
- Desktop Chrome at phone dimensions is an emulation check, not a physical-phone performance claim.

## Integration for Claude

The full Map replaces the existing stand-in. The new `components/map/MiniMap.tsx` is demonstrated in the sandbox, as requested by task 04. Mount it in the Room stage with `key={floor.number}`, passing `map`, `current`, `banner`, `exits`, and `onOpen` to open the Map. The key fades in on a new Floor even when Room ids repeat. Keep it clear of monsters and Door arrows.
