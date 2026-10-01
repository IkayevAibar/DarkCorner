# Task 18: Trust and greed — visual review

Implementation: `codex/trust-greed`, commit `0e4a0127448d2f042a217497e740e438b9b54c7c`, based on main `6d3091e`.

This is an **orphan evidence branch**. Never merge it into main. The implementation contains only `apps/web` changes and the optimized Oathstone asset.

## Status and contract handoff

The painted Oathstone, waiting choices, shared Map glyph, Duo Chest tray, ordinary confirmed pick flights, Curse panels and Tavern symbols are connected to the existing screens. The reveal component and all four choice combinations work in `/sandbox`.

**Draft: two missing payloads prevent completing the live reveal and final Chest flight.** No notice text is parsed, and no hidden choice or ownership is guessed.

1. The second oath deletes the stored choices and returns `OathView { state: 'spent', mine: null, partnerSwore: false }`. Add a structured settled-oath payload to `LabyrinthResult`, proposed `oath: { mine: 'share' | 'take', partner: 'share' | 'take' } | null`. Send it once to the initiating Player and in the partner's `duoNews`, with the two sides reversed. Keep `OathView` private while either oath is pending. `OathReveal` already accepts those choices, the two portraits and the result's original notices. Once the contract lands, connect it in `Labyrinth.present()` before showing the report and keep incoming results from interrupting it.
2. `takeTurns()` deletes a Chest immediately after its final pick or once neither Hero can carry more. `view.chest === null` loses the final `takenBy` values, especially for the polled partner and automatic picks. Add a final Chest snapshot to the action result and partner's news, proposed `closedChest: DuoChestView | null`, retaining every Item's `takenBy` from each Player's perspective. Then keep `ChestScene` mounted through its final 900 ms flights before dismissing it/showing the report. Do not reconstruct the other Player's choices from which Items disappeared. Current non-final live picks and turns already animate from the real `DuoChestView` updates.

The shared contract, API, engine and gameplay rules are unchanged in this PR.

## Review media

- [24-second phone recording in Russian](trust-greed-phone-ru.webm): Room, oath card, kept/broken/cracked reveals, alternating Chest picks, final pick and Curse. Desktop Chrome emulation at 375 × 900; VP8 encodes it at 374 × 900. Sound disabled. The reveal/final-pick portion uses explicit presentation fixtures, not live server outcomes. Sandbox-only Chest controls are hidden in the recording; the script advances the partner fixture behind the scene. Production uses the server snapshots.
- [Oathstone on the Room stage](phone-room-ru.png)
- [Unsworn choice card](phone-oath-ru.png)
- [Both Share](phone-kept-ru.png), [one Takes](phone-taken-ru.png), [both Take](phone-cracked-ru.png)
- [Duo Chest](phone-chest-ru.png), [confirmed Item in flight](phone-flight-ru.png), [final ownership](phone-chest-done-ru.png)
- [Live-screen waiting oath](live-oath-wait-ru.png), [live-screen confirmed pick](live-chest-pick-ru.png): actual Labyrinth screen against intercepted shared-shaped API responses.
- [Curse in Loot](loot-curse-ru.png), [Curse in the Temple](temple-curse-ru.png): actual screens; negative luck values render as −25%/−50%, without a spurious preceding plus.
- [Three Tavern oath symbols](tavern-oaths-ru.png): other Feed rows and fixed page chrome hidden only for this component capture.
- [Desktop Chest in English](desktop-chest-en.png), [desktop oath in English](desktop-oath-en.png)

## Validation

All required root commands pass:

```text
npm run typecheck
npm test              445 tests: API 158, web 44, engine 243
npm run build
```

API tests used the isolated local PostgreSQL database `dark_corner_codex_twin_test`, so the owner's concurrent work cannot reset the same test data.

[Browser checks](browser-checks.json): 12 configurations (EN/RU × 320/375/1440 px × normal/reduced motion). Verified hidden partner choices, sealed own choice, all four reveal combinations, both hands flipping, fracture states, keyboard focus, silent/spent stones, your/their turns, both flight destinations, Item inspection, expiry, full Bags, final pick and component bounds. The 375 px case uses a short 667 px viewport. These are browser checks, not a physical-device performance measurement. The sandbox's older unrelated sections still determine its full-page minimum width at 320 px; the new scenes fit.

[API boundary checks](api-ui-checks.json): actual Labyrinth/Loot/Temple screens with intercepted response fixtures. A rapid double tap sends one oath POST and one Chest POST, the selected `choice`/`index` are preserved, the partner's secret remains hidden, and a polled partner pick updates ownership and the next turn. All three oath Feed icons have distinct paths. No browser page errors.

## First-load bundle

Compared a production build of unmodified main `6d3091e` with the implementation:

| Initial asset | Main | Branch | Change |
| --- | ---: | ---: | ---: |
| JavaScript | 495,512 B | 491,930 B | −3,582 B |
| CSS | 45,994 B | 45,970 B | −24 B |
| Total | 541,506 B | 537,900 B | −3,606 B |

Oath/Chest copy moved from the global EN/RU dictionaries into the Labyrinth chunk. Every old news entry retains its literal id; `LATEST_NEWS_ID` points at the new top entry. The new painted prop (91,880 B) loads only when shown. It is not requested by the City first load.

## Art

Built-in imagegen produced a transparent Oathstone, resized to 640 × 640 WebP with its alpha preserved. Project path: `apps/web/public/art/props/oathstone.webp`. [Exact prompt and generation mode](oathstone-prompt.txt). The interactive hands, crack, falling shard, Chest and symbols remain native SVG/CSS. Existing Chest Spin primitives supply Item chips/details, Tier sounds and reduced-motion behavior.
