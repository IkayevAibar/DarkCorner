# Twin doors visual review

Implementation: `codex/twin-doors`, commit `2b7695f9dff9bef5af863a27983cbd476dc2e437`, based on main `287df6b`.

This is an orphan evidence branch. **Do not merge it into main.** It contains no application source.

## Before and after

Before: main had letter portraits for the Wardens, no resurrection effect, a locked-Door-style arrow for Twin doors, two-dot map placeholders, the generic ring Item icon and an unaccented bonded line.

After: the Wardens have matching dawn/shadow stone portraits in the Sandbox; a light thread arrives before the fallen token stands, with a stone-creak/reveal sound and a bilingual round-end rule. A shared split-ring seal marks Doors, Rooms, Bond rings and Twin Feed entries. Bonded portraits have a warm connecting glow.

## Recording and screenshots

- [Wardens fight, Russian, 375 × 900, 1×](wardens-phone-ru.webm): 25 seconds, includes the first defeat, resurrection and final victory. Screen recording is muted; the implementation calls the existing sound system at contact.
- [Room stage, Duo strip and Bag](phone-room-ru.png)
- [Floor map and Twin door seal](phone-map-ru.png)
- [Bond ring details](phone-ring-ru.png)
- [Tavern Feed entry](phone-feed-ru.png)
- [Live scene at the resurrection](phone-live-rise-ru.png)
- [Auto fight, English](phone-rise-en-hero.png)
- [Auto fight from the Partner's side, Russian](phone-rise-ru-ally.png)
- [Desktop scene](rise-width-1440.png)

Chrome desktop emulation, not a physical phone. Component-only screenshots hide the app's sticky header/navigation during capture. The recording uses the normal page.

## Validation

- `npm run typecheck`: pass.
- `npm test`: pass, 427 tests (151 API, 44 web, 232 engine).
- `npm run build`: pass.
- Web typecheck and all 44 web tests repeated after the final test-only amendment.
- [32 browser scenarios](browser-checks.json): EN/RU; both Players' perspectives; 1×/2×; reduced motion; full Manual replays and the short live cut; Duo entry, blocked solo entry, solo exit; joined/unjoined Bond rings; Item details; Map and legend; scene widths 320/375/1440.
- The fallen token remains at 0 HP and its fallen pose before the thread arrives, then shows the server's 15 HP; both Wardens end fallen. Pausing the Fight log holds the animation. Reduced motion has no particles or tilt.
- Root tests used the separate `dark_corner_codex_twin_test` database because another checkout was running tests against the default database. The generated Prisma client was refreshed from main before validation. No API, engine or contract source changed.
- [Bundle measurements](bundle.json): initial JS 476,720 → 476,718 bytes; initial CSS identical at 45,746 bytes. Gzip JS 157,557 → 157,566 bytes (+9 bytes from generated chunk names/dependency order and news metadata). After normalizing those build references and the news id, initial JS is identical. New effects, copy and assets load with the relevant screens.

## Art handoff

Painted with the built-in imagegen tool; [exact prompts](prompts.md). Final assets are transparent 384 × 384 WebP:

- `apps/web/public/art/tokens/dawn-warden.webp`
- `apps/web/public/art/tokens/dusk-warden.webp`

Claude still needs to set the monsters' `art` fields to `/art/tokens/dawn-warden.webp` and `/art/tokens/dusk-warden.webp` in `packages/engine/src/content/monsters.ts`. Production uses the provided `Combatant.art` value, so it keeps letter tokens until that handoff. The Sandbox adds only portrait paths to the real replays; their events and raw fixture JSON remain unchanged.
