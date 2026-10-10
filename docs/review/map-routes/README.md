# Map Routes review

Evidence-only branch; never merge.

- [Phone recording](map-routes.webm)
- [Winding Route, Russian, 375 px](winding-ru.png)
- [Nearly full Floor](full-floor-ru.png)
- [Larger Room targets](zoomed-ru.png)
- [Picking inside the popup](popup-picked-ru.png)
- [Confirmed partial walk](walk-prefix-ru.png)
- [Arrival](walk-arrived-ru.png)
- [Reduced motion](reduced-mini.png)
- [Desktop](desktop-full.png)

Before: dots through Room glyphs, a dashed goal ring and a fade for a multi-Room walk. After: ink follows the passages and skirts the Room walls, a small flag marks the goal, and the mini-map follows the old Route only as far as the response confirms. Waiting Rooms use a diamond and exclamation; done Rooms retain their round check. Door glyphs remain above the ink.

Browser checks pass at 375 × 812 in EN/RU and at 1280 × 900. Zoom gives every Room its own 48 px target; a Room is selected with one tap in the popup. A stopped walk uses four keyframes for the confirmed prefix and keeps the remaining Route; the next walk reaches the goal. Reduced motion has no token animation. No overflow or browser errors.

Four new unit tests cover glyph clearance along bent and straight segments, missing links, early-stop prefixes, normal steps and Portal fades. Root typecheck, tests (186 API / 65 web / 306 engine), and build passed. Final web typecheck/build and browser review passed after presentation fixes. First-load JS stays 515.85 kB / 169.81 kB gzip; CSS stays 48.48 kB / 10.52 kB gzip. Route search, costs, API calls and RoutePanel are unchanged.
