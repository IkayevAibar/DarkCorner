# Class power effects — review evidence

Evidence branch only: do not merge this branch. Implementation: `codex/class-power-effects`, commit `e8c3233`.

Captured on `/sandbox` in Chromium at 375 × 812, Russian. Fourteen synthetic, contract-validated Duo replays cover seven Classes from both Players' sides; all 38 real engine fixtures remain unchanged. All seven partner-side replays reached their final frame. Reduced motion, horizontal overflow and browser errors were checked (see `validation.json`).

Root `npm run typecheck`, `npm test` (180 API + 66 web + 306 engine tests), and `npm run build` pass. Tests use an isolated local database. Initial web entry remains 515.85 kB / 169.81 kB gzip; CSS remains 48.48 kB / 10.52 kB gzip. Added rendering lives in the lazy fight stage.

| Power | Phone capture |
|---|---|
| Divine smite | ![Smite](smite.png) |
| Lay on hands, reaching the Partner | ![Lay on hands](lay-on-hands.png) |
| Armor of Agathys | ![Agathys](agathys.png) |
| Hex | ![Hex](hex.png) |
| Hex changing targets | ![Hex moves](hex-moves.png) |
| Dark blessing | ![Dark blessing](dark-blessing.png) |
| Flurry of blows | ![Flurry](flurry.png) |
| Wholeness of body | ![Wholeness](wholeness.png) |
| Wild shape | ![Wild shape](wild-shape.png) |
| Beast buffer absorbing damage | ![Beast health](beast-hurt.png) |
| Beast falling away | ![Beast ends](beast-ends.png) |
| Bardic inspiration | ![Inspiration](inspiration.png) |
| Cutting words | ![Cutting words](cutting-words.png) |
| Quickened spells | ![Quickened](quickened.png) |
| Action Surge | ![Action Surge](action-surge.png) |
| Entropic ward | ![Entropic ward](entropic-ward.png) |
| Cloak of shadows | ![Cloak](cloak-of-shadows.png) |
| Eldritch beams | ![Eldritch](eldritch.png) |
| Beast claws | ![Claws](beast-claw.png) |
| Thorn whip | ![Thorn whip](thorn.png) |
| Mockery | ![Mockery](mockery.png) |
| Sorcerer fire | ![Fire](fire.png) |
| Reduced motion, partner Druid | ![Reduced motion](reduced-druid-partner.png) |
