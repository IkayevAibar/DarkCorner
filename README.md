# Task 18: Trust and greed — visual review

Implementation: `codex/trust-greed`, commit `15bfe959e8b57b65feec2100920813aa06379cdb`, rebased on main `494426d`.

This is a separate **orphan evidence branch**. Never merge it into main. The implementation changes only `apps/web`.

## Connected settlement flow

Both contract payloads are connected. An action or partner look with `oath` opens the paired reveal with the receiving Player's exact choices and original notices. A `closedChest` result holds the final tray through its confirmed Item flights before the report, even though `view.chest` is already null. The previous Room and portraits remain available when the result has moved the Duo home or ended it. An initial-load receipt without history shows all assigned Items going to the supplied sides; a missing former partner uses a neutral portrait.

Incoming results queue behind the current picture, then join the report without losing rewards or notices. Old completion callbacks cannot skip the next picture. Empty subsequent looks do not replay one-shot receipts. Unclaimed Items stay behind. The final manual pick keeps its loot in the report; non-final picks use the tray as their receipt. Auto and Manual fights keep their existing scenes and show their last blows before their report.

No contract, API, engine or gameplay rule changes are included.

## Current recording and screenshots

- [24-second live-screen phone recording in Russian](trust-greed-live-phone-ru.webm): the actual `/labyrinth` route submits an oath, reveals it, receives a cracked oath through partner news, shows a normal Chest pick, then the partner's final pick with `view.chest: null`, its flight and the report. Desktop Chrome at 375 × 900 (VP8 encodes 374 × 900), sound disabled. API responses are intercepted contract-shaped fixtures; this is not a physical-device or full server end-to-end recording. No sandbox presentation controls drive these scenes.
- [Settled oath on a short 375 × 667 phone](live-settled-oath-ru.png), [complete final tray on the short phone](live-last-pick-ru.png).
- [Kept oath](live-oath-reveal-phone-ru.png), [cracked oath](live-oath-cracked-phone-ru.png), [partner's final Item in flight](live-final-flight-phone-ru.png).
- [Closing after going home and ending the Duo](live-closed-chest-desktop-en.png): English desktop, previous partner retained, unclaimed Items labelled "Left behind".
- [Waiting oath](live-oath-wait-ru.png), [normal confirmed pick](live-chest-pick-ru.png), [Curse in Loot](loot-curse-ru.png), [Curse in the Temple](temple-curse-ru.png).
- [Three Tavern oath symbols](tavern-oaths-ru.png), [Room stage](phone-room-ru.png), [choice card](phone-oath-ru.png).

The older `trust-greed-phone-ru.webm` and `phone-*` / `desktop-*` screenshots remain as original sandbox evidence; use the **live-screen recording above** to review the completed integration.

## Validation

All required root commands pass:

```text
npm run typecheck
npm test              458 tests: API 158, web 57, engine 243
npm run build
```

API tests used the isolated local PostgreSQL database `dark_corner_codex_twin_test` to avoid the owner's concurrent tests resetting the same data.

- [Live settlement browser checks](live-settlement-checks.json): EN/RU × 320/375/1440 px × normal/reduced motion, all 12 configurations pass. Covers initiating POST and partner news, all four oath combinations, original notices/rewards, duplicate taps, null `view.chest`, both flight destinations, retained portraits after home/disband, initial-load catch-up, left-behind Items, no repeated receipts, short-phone bounds, and no page errors.
- [Fight regression checks](fight-regression.json): actual Labyrinth Auto replay before report; Manual ending retains the same board, finishes its events, then shows the report with XP preserved.
- Thirteen new unit cases cover receipt sequencing, queued news, duplicate callbacks, both fight modes and confirmed ownership changes.
- [Existing API boundary checks](api-ui-checks.json), rerun after integration: secret partner oath, one POST after rapid double taps, normal pick/poll updates, Curse in Loot/Temple, correct negative luck values.
- [Original presentation browser checks](browser-checks.json): all four sandbox outcomes, keyboard focus, silent/spent stones, Item inspection, expiry, full Bags, and both languages/motion settings.

These are desktop browser checks with phone-sized viewports, not physical-phone performance measurements.

## First-load bundle

[Production asset comparison](bundle-comparison.json), against unmodified main `494426d`:

| Initial asset | Main | Branch | Change |
| --- | ---: | ---: | ---: |
| JavaScript | 495,512 B | 491,930 B | −3,582 B |
| CSS | 45,994 B | 45,970 B | −24 B |
| Total | 541,506 B | 537,900 B | **−3,606 B** |

The gzip total is also smaller by 1,154 B. Oath/Chest copy loads with the Labyrinth rather than the initial dictionaries. News entries keep their literal ids; `LATEST_NEWS_ID` matches the top entry. The 91,880 B Oathstone prop loads only when shown.

## Art

Built-in imagegen produced the transparent Oathstone, optimized to 640 × 640 WebP with alpha preserved: `apps/web/public/art/props/oathstone.webp`. [Exact prompt and mode](oathstone-prompt.txt). Hands, fractures, shard, Chest and symbols use native SVG/CSS; Items reuse Item chips/details, Tier sounds and reduced motion.
