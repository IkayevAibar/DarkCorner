# Class effects review — 4c520bc

Evidence only. This orphan branch must never merge into main.

The implementation is `codex/class-effects`, branched from main `b8b99b8`. All three fixtures are the unchanged engine replays on main.

## Effects

| Effect | Recording | Still | Reduced motion |
| --- | --- | --- | --- |
| Rage: roar, ember aura, swing pulses, softened incoming hits | [Play](barbarian-rage.webm) | [Roar](barbarian-rage-rage.png) · [Swing](barbarian-rage-rage-swing.png) · [Shrug](barbarian-rage-rage-shrug.png) | [Static aura](barbarian-rage-rage-reduced.png) |
| Hunter's mark: rotating reticle and transfer from fallen quarry | [Play](ranger-mark-moves.webm) | [Reticle](ranger-mark-moves-mark.png) | [Static reticle](ranger-mark-moves-mark-reduced.png) |
| Relentless: stagger, plant and red flare | [Play](bearheart-relentless.webm) | [Flare](bearheart-relentless-relentless.png) | [Still](bearheart-relentless-relentless-reduced.png) |

Recordings seek through earlier events to the relevant moment, then play normally at 1×. Screenshots and recordings use desktop Chrome at 375 px; they are not a physical-phone performance measurement. Audio uses the existing game sound hooks; review recordings are muted.

## Logs

The sandbox now keeps the report's shared Fight log after dismissing a replay.

- [Barbarian playback log](barbarian-rage-log-en.png), [report](barbarian-rage-report-en.png), [Russian report](barbarian-rage-report-ru.png).
- [Ranger playback log](ranger-mark-moves-log-en.png), [report](ranger-mark-moves-report-en.png), [Russian report](ranger-mark-moves-report-ru.png).
- [Relentless playback log](bearheart-relentless-log-en.png), [report](bearheart-relentless-report-en.png), [Russian report](bearheart-relentless-report-ru.png).

## Checks

- `npm run typecheck`, `npm test` (136 API + 27 web + 209 engine = 372), `npm run build`: pass.
- Four new tests cover recorded Rage lifetime/HP, explicit mark transfers, all three 1 HP Relentless refusals, and bilingual descriptions.
- `browser-checks.json`: 48 full replays (3 fixtures × 375/1280 px × EN/RU × 1×/2× × normal/reduced motion). Actual Pixi canvases, state through every event, no horizontal overflow, particle cap, teardown, and equal playback/report log content verified.
- `bundle.json`: initial JS 455,277 → 455,274 bytes (gzip 151,449 → 151,448); initial CSS unchanged at 45,785 bytes (gzip 10,063). No dependencies or art downloads added. Drawing code remains in the lazy Pixi stage.
- The existing API test `test/lair.test.ts:89` failed once during the Floor-map rebase because the Fallen champion returned two loot Items. Its targeted rerun and the subsequent complete suite passed. No API code was changed.
