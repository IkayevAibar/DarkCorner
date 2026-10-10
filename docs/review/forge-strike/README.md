# Forge strike review

Evidence for brief 06. This branch is for review only and must never merge.

- Before: Upgrade results appeared as a text panel without an anvil scene.
- After: a hammer strike reveals the server result, with distinct success, failure, downgrade, protection-scroll and destruction endings. The +10 success has a larger burst.
- [Recording](forge-strikes.webm)
- [Success, Russian, 375 px](success-ru.png)
- [Protected failure](saved-ru.png)
- [Destruction](destroyed-ru.png)
- [+10](ten-ru.png)
- [Reduced motion](reduced-en.png)
- [Actual Forge sheet after success](forge-sheet-success.png)
- [Actual Forge sheet after destruction](forge-sheet-destroyed.png)

All six outcomes checked in English and Russian at 375 × 812, with no horizontal overflow or browser errors. The real Forge sheet used mocked API responses to verify protection is submitted, a second strike remains possible after success, and Upgrade actions disappear after destruction. Capture source and validation output are included.

Root `npm run typecheck`, `npm test` (186 API, 61 web, 306 engine), and `npm run build` passed. Final web typecheck/build and browser checks passed after the presentation adjustments. First-load JS remains 515.85 kB (169.81 kB gzip), CSS 48.48 kB (10.52 kB gzip).
