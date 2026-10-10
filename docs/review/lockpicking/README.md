# Lockpicking review

Review-only evidence branch; never merge.

- [Recording: three locks in EN/RU](lockpicking.webm)
- [Floor 1, Russian, 375 px](shallow-ru.png)
- [Floor 10](deep-ru.png)
- [A broken pick](miss-shallow-ru.png)
- [Final turn](opening-rogue-ru.png)
- [Reduced motion](reduced.png)

Before: a plain bar and numeric pick count. After: three brass pins, the active pin illuminated, a shared-function sweep, visible spare/broken picks, and a final turn before the report. The final tap is sent immediately; EventPanel waits at least 650 ms before presenting its result (zero for reduced motion).

Browser checks: Floor 1, Floor 10, Rogue; successful opening after one miss; EN/RU at 375 × 812; no overflow/errors. Reduced motion preserves the marker sweep and removes the pin transitions. StrictMode timing harness checks exact 350 ms and 120 ms submissions, unchanged sweep during same-view polling, duplicate-tap protection, keyboard input, and unmount. EventPanel's actual callback is checked with a mocked API response to confirm immediate submission and delayed report.

Root typecheck, test (186 API / 61 web / 306 engine), and build passed. The first test run hit the existing random Duo Chest loot assertion (`trust.test.ts:155`, expected 1, got 2); its isolated retry and a full root rerun passed. No API files changed.

First-load JS: 515.85 kB / 169.80 kB gzip (unchanged size, gzip down 0.01 kB). CSS: 47.83 kB / 10.41 kB gzip, down from 48.48 / 10.52. The scene's styles remain with its lazy route.

To repeat browser checks, temporarily copy `lock-review-harness.tsx` to `apps/web/`, run Vite on port 5184, and run `capture.cjs` and `event.cjs` with the local Playwright path adjusted. Remove the harness afterward.
