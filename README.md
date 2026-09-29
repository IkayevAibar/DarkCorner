# Fight polish review media

**Evidence only — never merge this branch.** These recordings and screenshots are kept outside `codex/fight-juice` and its history.

Implementation: [`a3178e5`](https://github.com/IkayevAibar/DarkCorner/commit/a3178e529a7a7887ff47fd7360d4aedbb0847f42), based on main `b66994e`.

## Recordings (375 px, English)

| Moment | Clip | Still |
| --- | --- | --- |
| Fighter slash and critical hit | [Play](fighter-crit.webm) | [Still](fighter-crit.png) |
| Goblin archer arrows | [Play](archer-arrows.webm) | [Still](archer-arrows.png) |
| Wizard bolt | [Play](wizard-bolt.webm) | [Still](wizard-bolt.png) |
| Wizard fireball and shockwave | [Play](wizard-fireball.webm) | [Still](wizard-fireball.png) |
| Cleric healing | [Play](cleric-heal.webm) | [Still](cleric-heal.png) |
| Undead crumbling | [Play](undead-crumble.webm) | [Still](undead-crumble.png) |
| Demon embers | [Play](demon-embers.webm) | [Still](demon-embers.png) |
| Hero down and rising | [Play](down-rise.webm) | [Still](down-rise.png) |
| Dragon breath | [Play](dragon-breath.webm) | [Still](dragon-breath.png) |
| Fire bomb arc | [Play](fire-bomb.webm) | [Still](fire-bomb.png) |
| Real local API fight and report | [Play](real-labyrinth.webm) | [Report](real-labyrinth-report.png) |

## Checks

- `npm run typecheck`, `npm test`, `npm run build`: pass. 335 tests (API 126, web 17, engine 192).
- [120 browser combinations](browser-checks.json): 27 real replays plus three supplemental examples, English/Russian, normal/reduced motion, all at 375 px. Also pause/log without future lines, remembered speed, focus restoration, repeated mounts, Skip while the chunk loads and no-WebGL fallback.
- [Real API check](live-api-check.json): created a test Hero, entered a generated Labyrinth and won a 16-event fight, then opened the report and full log. The API and PostgreSQL were real; only the isolated `dark_corner_test` database was used. No production account or data was touched.
- [Bundle](bundle.json): initial JS 437,794 → 437,788 bytes; gzip 146,166 → 146,160 bytes. Initial CSS unchanged: 46,160 / 10,066 gzip bytes. No new raster art or dependency; Pixi stays lazy.
- [Desktop sample](desktop-frame-sample.json): software WebGL at 375 px, 160 particles at peak. Canvas rendering is capped at 60 updates per second and stops while paused, after calm fades and at the result. The sampled RAF intervals describe this desktop, **not physical-phone performance**.

## Remaining before ready

`Combatant` has no Hero Class or spell-style field. Offensive Cleric attacks therefore retain the existing bolt; Cure wounds already uses radiant light and green healing sparkles. Claude needs to add the Class (or a spell-style discriminator) to the replay contract and fixtures so the web can distinguish Cleric attacks without guessing from names, portraits or later events.

The required 60 fps check on a physical mid-range phone remains unverified.

## Reproduce

Run the web dev server on 5187, then `node apps/web/scripts/check-fights.cjs` and `node apps/web/scripts/capture-fight-juice.cjs --record`. Set `PLAYWRIGHT_MODULE` to an installed Playwright runtime if needed. `FIGHT_OUTPUT` selects an evidence directory outside the implementation checkout.
