# Sound review — task 09

Evidence only. **Do not merge this branch.** Implementation: `codex/sound`, commit `da96e9b`.

## Listen and look

- [Sound board recording](sound-board.webm): the approved sounds, then Common through Relic, then a natural 20. Captured directly from the real Web Audio output in Chrome (audio-only WebM).
- [Russian at 375 px](board-ru.png) · [English at 375 px](board-en.png) · [desktop](board-desktop.png)
- Full component: [Russian](board-full-ru.png) · [English](board-full-en.png)
- [Browser measurements](validation.json) · [reproduction script](dark-sound-capture.cjs)

The script isolates SoundPreview inside the real Shell by substituting the Sandbox module, because the existing Manual fight preview also plays sounds. Both the account sheet and the sound board use the real shared module. Full-component screenshots temporarily hide fixed navigation; viewport screenshots are unchanged. The panel's decorative corners extend 3 px, without page overflow.

## Results

- English and Russian at 375×812; desktop at 1280×900.
- All 20 current Sound identifiers play. Every one of the 27 approved OGG variants decodes in Chrome.
- No audio context or sound requests before the first tap. The first tap plays.
- Tier layer counts: Common 1, Uncommon 1, Rare 1, Epic 2, Legendary 3, Mythic 4, Relic 4.
- The account switch updates the sandbox switch, prevents sound and vibration, immediately stops active and scheduled layers, and stays off after reload.
- Vibration calls measured through a test spy. Physical Android vibration and physical iPhone playback were not tested here.
- No browser errors or horizontal page overflow.

Root `npm run typecheck`, `npm test` (186 API, 73 web, 306 engine) and `npm run build` passed on the implementation. The final actor-aware cue tests were then added: web typecheck and all **78 web tests** passed. API tests used the isolated `dark_corner_codex_visual_test` database.

Initial JS: **514.92 kB / 169.39 kB gzip**, down from 515.85 / 169.81. CSS unchanged: 48.48 / 10.52. The mixer is a separate 1.61 kB / 0.88 kB gzip chunk fetched after interaction.

## Existing integrations audited

Door and stair movement; attack, critical hit, miss, Death saves, victory and death; Check and goblin duel reports; Chest Spin and identify reveal by Tier; Forge strike and destruction; Shop buying/selling and Market purchase all already call the shipped Sound API. Added natural-20 vibration to Checks, Saves, Escape rolls, Pull up and the Partner's attacks.

Brief 09 predates the implemented sound integration. This change keeps the native Web Audio engine, existing Sound names and approved packs documented in `docs/art/icons-and-sounds.md`, instead of adding Howler or migrating all callers. The brief's `useSoundSetting` hook is available alongside the existing account hooks. No contract changes are requested. Older browsers unable to decode the approved OGG files still fail silently, as before.
