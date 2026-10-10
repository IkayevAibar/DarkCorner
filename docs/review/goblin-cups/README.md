# The goblin's cups

Review evidence only; never merge this branch.

- [Recording](goblin-cups.webm)
- [Gem shown before the shuffle, Russian, 375 px](shallow-win-show-ru.png)
- [Crossing cups](deep-loss-shuffle-ru.png)
- [Win](shallow-win-end-ru.png)
- [Gem up his sleeve](sleeve-loss-end-ru.png)
- [Rogue catches the cheat](rogue-caught-end-ru.png)
- [Paid game on return](resumed-en.png)
- [Reduced-motion shuffle](reduced-shuffle.png)

Before: three sliding domes. After: the existing painted goblin behind a wooden table, two moving hands, brass-bound cups arcing through exactly the supplied swaps, and distinct gem/sleeve reveals. Reduced motion retains linear swaps and immediate reveals.

Four outcomes captured in both languages at 375 × 812 with no overflow or browser errors. Final positions checked against known fixture permutations (`[1,0,2]` and `[2,1,0]`). Returning to a paid game neither shows the gem nor repeats the shuffle. A StrictMode harness also verifies that polling fresh copies of the same game does not restart the timer, two same-turn clicks submit one pick, and unmount succeeds.

Root typecheck, test (186 API / 61 web / 306 engine), and build passed. Final web typecheck/build and all browser checks passed after fixture/presentation adjustments. Initial JS remains 515.85 kB / 169.80 kB gzip; CSS is 47.69 kB / 10.41 kB gzip (down from 48.48 / 10.52). No asset downloads or contract changes.

For the behavior check, temporarily put the harness at `apps/web/cups-review-harness.tsx`, serve Vite on 5184, and run `behavior.cjs`; remove it afterward. Adjust the local Playwright path in the scripts for another machine.
