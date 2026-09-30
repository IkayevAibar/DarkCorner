# Tavern and Hall of Fame — review evidence

Implementation: 0a8778377a8560ac8accb44237950bb29744b7b4, from main 455ebc9.
This evidence branch has no parent and must never merge into main.

## Screenshots

- Mid-Season: [desktop, English](busy-1280-en.webp), [375 px, Russian](busy-375-ru.webp)
- Finale, 30% weaker Dragon: [desktop, English](finale-1280-en.webp), [375 px, Russian](finale-375-ru.webp)
- Hall of Fame, two Seasons: [desktop, Russian](hall-1280-ru.webp), [375 px, Russian](hall-375-ru.webp)
- [Quiet Tavern](quiet-375-en.webp)
- [Rankings](rankings-375-ru.webp)
- [Real API Bounties after the swap](real-bounties-ru.webp)

These are screenshots of the implemented components. Persistent app navigation was hidden only for the full component captures so it would not cover content partway through a tall image. Images are lossless WebP conversions. All phone checks are desktop Chrome emulation, not a physical handset.

## Checks

- Four fixtures, each at 375/1280 px and in EN/RU: 16 cases. All 10 Rankings boards in each configuration: 40 additional views. No horizontal overflow or browser errors. All fixture data validates against shared schemas.
- [Real API checks](real-api-checks.json): independent EN and RU Players bought Lodging (600 -> 550 gold; Stamina 7 -> 20; two short rests restored), swapped one Bounty, and opened every Rankings board. Real API on an isolated test database; production was not used.
- [Browser results](browser-checks.json)
- [Bundle comparison](bundle.json): initial JS + CSS 521701 -> 521583 bytes, 118 bytes smaller. Gzip 167128 -> 167116. Tavern CSS, code and room art are lazy.
- Root typecheck and build passed; 31 web tests and 222 engine tests passed. Full npm test has inherited intermittent API failures: Manual solo test timeout at manual.test.ts:86; a separate full API run instead failed lair.test.ts:89 on two loot drops. No engine, shared contract, API or API test files changed.

## Art

The warm ink Tavern illustration was generated with the built-in image_gen tool and saved in the implementation branch at apps/web/public/art/city/tavern-interior.webp (1200 x 800, 207248 bytes). [Exact generation prompt](tavern-interior.prompt.txt).
