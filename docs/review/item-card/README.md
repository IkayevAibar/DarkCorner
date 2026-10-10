# Item tiles and cards

Review-only evidence branch; never merge.

- [Tile grid and 62/76/84 px sizes, Russian, 375 px](tiles-ru.png)
- [Relic card](card-relic-ru.png) and [actual bottom sheet](sheet-relic-ru.png)
- [Radiant card](card-radiant-ru.png) and [sheet](sheet-radiant-ru.png)
- [Unidentified card](card-unidentified-ru.png) and [sheet](sheet-unidentified-ru.png)
- [Stackable](card-potion-en.png)
- [Quality explanation](quality-explanation-en.png)
- [Reduced motion](reduced-relic.png)

Every fixture is captured in EN and RU. Isolated card captures hide the fixed navigation during the screenshot so long cards show their full contents; the sheet and page captures show the actual phone layout.

Before: small ItemChip/ItemDetails stand-ins. After: approved Crypt-style art, Tier frames, Legendary/Mythic pulse, rotating Relic border and serial, Radiant shimmer/stamp, and dim unidentified art with mystery lines. All consumers now use ItemTile/ItemCard; no stand-in references remain. Passive tiles no longer create nested buttons.

Validation: all 11 fixtures parse as ItemView; 62/76/84 sizes; one shared Item stylesheet; unknown fields remain hidden; stackables have quantity and description without Quality; gear damage and Armor Class comparisons; tappable explanations; actual sheets; identify timing; Chest Spin completion; reduced motion; no horizontal overflow or browser errors. Additional browser checks cover the four new caster Classes and Monk's DEX explanation.

Root typecheck, tests (186 API / 61 web / 306 engine), and build passed. Final web build passed after adjusting the Tier burst origin to the larger art.

Initial JS + CSS totals 563.74 kB / 180.29 kB gzip, down from 564.33 / 180.33. Individually JS is 515.94 / 169.85 (dependency-map overhead +0.09 / +0.04); CSS is 47.80 / 10.44 (−0.68 / −0.08). Item styles are inserted once when Item UI mounts. The language helper no longer pulls in card presentation code.
