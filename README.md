# Manual fights and Duos — review evidence

Implementation: ce332fb73c89a3d13dc644fc144bd15092a62e6f, based on main 455ebc9.
This parentless evidence branch must never merge into main.

- [Solo Manual fight, real API](solo-manual.webm)
- [Duo Manual fight, two authenticated Players, real API](duo-manual.webm)
- [Phone, Russian](manual-phone.png)
- [Duo partner turn, Russian](duo-teamwork-375-ru.png)
- [Desktop Duo](duo-side-by-side-1280-en.png)
- [40 Manual preview cases](manual-browser-checks.json): 10 replays, EN/RU, 375/1280, normal/reduced motion; busy lockout, monotonic event cursor, final report, no overflow or browser errors.
- [Real API receipts](real-api-checks.json): independent sessions, attacks sent from both Players, successful POST responses and victory reports. Only the isolated test database was used.
- [Initial JS/CSS](bundle.json): 521701 -> 520989 bytes combined; 712 bytes smaller (79 bytes smaller gzipped).
- [Solo Auto comparison](solo-comparison.json): 168 frames against the previous solo reference, maximum 107 of 122500 pixels differ, maximum channel delta 10/255; minor rasterization differences. Solo placement, timings and effects retained.

Checks: root typecheck and build pass; 40 web and 222 engine tests pass. Full npm test was run repeatedly: API manual.test.ts:86 intermittently times out at 5 seconds; lair.test.ts:89 sometimes gets two drops instead of one; delve.test.ts:99 sometimes survives instead of falling. No API/test source was changed.

Upstream request: packages/engine/src/duo.ts forAlly does not swap revive actor/target or feature help/guard target. The same errors are present in all three -partner fixture families. For example duo-pulled-up event 25 stays actor ally, target hero in both views; duo-teamwork event 4 is actor ally, target ally in the partner view. The scene follows the recorded contract; correct the mapping and regenerate the fixtures before merging.

Phone checks use desktop Chrome at 375 px, not a physical handset.
