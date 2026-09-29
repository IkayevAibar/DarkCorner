# Fight polish review media

**Evidence only — never merge this branch.** These recordings and screenshots are kept outside `codex/fight-juice` and its history.

Implementation: [`c5456c1`](https://github.com/IkayevAibar/DarkCorner/commit/c5456c1732d6e22f680ba9fd7f0dd6aa086a3068), stacked on PR #8 (`3739b61`) over main `c322a4d`.

## Recordings (375 px, English)

| Moment | Clip | Still |
| --- | --- | --- |
| Fighter slash and critical hit | [Play](fighter-crit.webm) | [Still](fighter-crit.png) |
| Goblin archer arrows | [Play](archer-arrows.webm) | [Still](archer-arrows.png) |
| Wizard bolt | [Play](wizard-bolt.webm) | [Still](wizard-bolt.png) |
| Wizard fireball and shockwave | [Play](wizard-fireball.webm) | [Still](wizard-fireball.png) |
| Cleric attack: descending radiant light | [Play](cleric-radiance.webm) | [Still](cleric-radiance.png) |
| Cleric healing | [Play](cleric-heal.webm) | [Still](cleric-heal.png) |
| Undead crumbling | [Play](undead-crumble.webm) | [Still](undead-crumble.png) |
| Demon embers | [Play](demon-embers.webm) | [Still](demon-embers.png) |
| Hero down and rising | [Play](down-rise.webm) | [Still](down-rise.png) |
| Dragon breath | [Play](dragon-breath.webm) | [Still](dragon-breath.png) |
| Fire bomb arc | [Play](fire-bomb.webm) | [Still](fire-bomb.png) |
| Real local API fight and report | [Play](real-labyrinth.webm) | [Report](real-labyrinth-report.png) |

## Checks

- `npm run typecheck`, `npm test`, `npm run build`: pass. 342 tests (API 127, web 23, engine 192).
- [120 browser combinations](browser-checks.json): 27 real replays plus three supplemental examples, English/Russian, normal/reduced motion, all at 375 px. Also pause/log without future lines, remembered speed, focus restoration, repeated mounts, Skip while the chunk loads and no-WebGL fallback.
- [Real API check](live-api-check.json): created a test Cleric Hero, entered a generated Labyrinth and won a 30-event fight, then opened the report and full log. The API and PostgreSQL were real; only the isolated `dark_corner_test` database was used. No production account or data was touched.
- [Bundle](bundle.json): compared with rebased PR #8, initial JS 439,994 → 439,989 bytes; gzip 146,829 → 146,826 bytes. Initial CSS unchanged: 45,359 / 9,986 gzip bytes. No new raster art or dependency; Pixi stays lazy.
- [Desktop sample](desktop-frame-sample.json): software WebGL at 375 px, 160 particles at peak. Canvas rendering is capped at 60 updates per second and stops while paused, after calm fades and at the result. The sampled RAF intervals describe this desktop, **not physical-phone performance**.

## Phone review and contract

Combatant.class now drives the spell effect: Cleric attacks descend as golden light; Wizard attacks remain flying bolts. A miss lands beside the target. Reduced motion uses a brief colored fade. Healing keeps its own color.

The owner is testing on a physical phone. The review page measures RAF cadence and collects the phone model, visual feedback, viewport, particle peak and render count. No physical-phone result has been received yet; desktop harness calibration rows are excluded from phone evidence.

Each news entry now has a literal ID. The latest fight entry is `2026-09-30-juice`; the Chest entry `2026-09-30-chest-spin`, Camp entry and every older entry remain intact.

## Reproduce

Run the web dev server on 5187, then `node apps/web/scripts/check-fights.cjs` and `node apps/web/scripts/capture-fight-juice.cjs --record`. Set `PLAYWRIGHT_MODULE` to an installed Playwright runtime if needed. `FIGHT_OUTPUT` selects an evidence directory outside the implementation checkout.
