# The game's card on the ugolok.world hub

The hub (`D:\ugolok.world-site`, its own repo) shows each game as a card: on the signed-in account page and on the public landing page. This is the change that adds Dark Corner, written out so it can be reviewed before anyone touches that repo. The design asks for it (docs/design.md → Players, access and platform), and the plan has the owner merge it in week 5.

**Dark Corner's side is done:** `GET https://dark.ugolok.world/api/sso/summary` answers with the shared cookie, CORS allows `ACCOUNT_ORIGIN` (`https://account.ugolok.world`) with credentials, and the answer has the same `{ registered, profile }` shape as the other two games, plus `profile.hero`:

```ts
{ registered: boolean,
  profile: { name: string, status: 'pending' | 'approved' | 'banned',
             hero: { name: string, level: number, bestFloor: number,
                     bestItem: { name: { en: string, ru: string }, tier: string } | null } | null } | null }
```

**Before deploying the hub:** add `DARK_ORIGIN=https://dark.ugolok.world` to the hub's server `.env` (`/opt/ugolok/.env`). Vite bakes origins in at build time, and without it the card would point at `http://localhost:5180`.

## apps/account (the dashboard card)

`src/config.ts`, after the Minecraft origins:

```ts
/** Dark Corner. Same origin for its API and site; nginx there proxies /api. */
export const DARK_API = clean(import.meta.env.VITE_DARK_ORIGIN ?? 'http://localhost:5180');

export const DARK_ORIGIN = DARK_API;
```

`src/api.ts`: import `DARK_API`, add the type, and a third fetch next to the other two:

```ts
/** The slice of Dark Corner's summary this page shows. */
export interface DarkProfile {
  name: string;
  status: 'pending' | 'approved' | 'banned';
  hero: {
    name: string;
    level: number;
    bestFloor: number;
    bestItem: { name: { en: string; ru: string }; tier: string } | null;
  } | null;
}

  darkCorner: () => json<Summary<DarkProfile>>(`${DARK_API}/api/sso/summary`),
```

`src/App.tsx`:
- Widen `GameCard`'s `variant` to `'aether' | 'mc' | 'dark'`.
- Import `DARK_ORIGIN` and `DarkProfile`.
- Add the card, after `MinecraftCard`:

```tsx
function DarkCornerCard({
  data,
  state,
  onRetry,
}: {
  data: Summary<DarkProfile> | null;
  state: Load;
  onRetry: () => void;
}) {
  const { t, n, lang } = useLang();
  const profile = data?.profile ?? null;
  const hero = profile?.hero ?? null;
  const href = `${DARK_ORIGIN}/?lang=${lang}`;
  const access = profile?.status === 'approved' ? 'good' : profile?.status === 'banned' ? 'bad' : 'warn';

  return (
    <GameCard variant="dark" kicker={t.darkKicker} title={t.darkTitle}>
      <CardState state={state} onRetry={onRetry}>
        {profile ? (
          <>
            {hero && (
              <div className="stats">
                <Stat label={t.darkLevel} value={n(hero.level)} />
                <Stat label={t.darkFloor} value={n(hero.bestFloor)} />
              </div>
            )}

            <div className="rows">
              <div className="row">
                <span className="muted">{t.darkHero}</span>
                {hero ? <strong>{hero.name}</strong> : <span className="pill warn">{t.darkNoHero}</span>}
              </div>
              {hero?.bestItem && (
                <div className="row">
                  <span className="muted">{t.darkBestItem}</span>
                  <strong>{hero.bestItem.name[lang]}</strong>
                </div>
              )}
              <div className="row">
                <span className="muted">{t.darkAccess}</span>
                <span className={`pill ${access}`}>
                  {access === 'good' ? t.darkApproved : access === 'bad' ? t.darkBanned : t.darkPending}
                </span>
              </div>
            </div>

            {profile.status === 'pending' && <p className="hint">{t.darkPendingHint}</p>}

            <a className="cta solid" href={href}>
              {t.darkOpen} <span aria-hidden="true">→</span>
            </a>
          </>
        ) : (
          <NotPlaying text={t.darkEmpty} cta={t.darkEmptyCta} href={href} />
        )}
      </CardState>
    </GameCard>
  );
}
```

- State and loader next to Minecraft's (same pattern as `loadMinecraft`):

```tsx
const [dark, setDark] = useState<Summary<DarkProfile> | null>(null);
const [darkState, setDarkState] = useState<Load>('loading');

const loadDarkCorner = useCallback(() => {
  setDarkState('loading');
  api
    .darkCorner()
    .then((data) => {
      setDark(data);
      setDarkState('ready');
    })
    .catch(() => setDarkState('error'));
}, []);
```

- In the session effect call `loadDarkCorner()` after `loadMinecraft()`, and add it to the dependency list.
- Render `<DarkCornerCard data={dark} state={darkState} onRetry={loadDarkCorner} />` after `MinecraftCard`.

`src/i18n.tsx`: after `mcEmptyCta` in `en` and in `ru` (the `Copy` type makes a missing Russian key a compile error):

| Key | en | ru |
|---|---|---|
| `darkTitle` | Dark Corner | Тёмный уголок |
| `darkKicker` | Labyrinth RPG | RPG-лабиринт |
| `darkLevel` | Level | Уровень |
| `darkFloor` | Deepest Floor | Глубже всего |
| `darkHero` | Hero | Герой |
| `darkNoHero` | No Hero yet | Героя пока нет |
| `darkBestItem` | Best Item | Лучший предмет |
| `darkAccess` | Access | Доступ |
| `darkApproved` | Open | Открыт |
| `darkPending` | Waiting for approval | Ждёт одобрения |
| `darkBanned` | Closed | Закрыт |
| `darkPendingHint` | An admin has to let you in before you can create a Hero. Ask in Discord. | Админ должен впустить вас, прежде чем вы создадите героя. Спросите в Discord. |
| `darkOpen` | Open the game | Открыть игру |
| `darkEmpty` | You have not opened Dark Corner yet. | Вы ещё не заходили в «Тёмный уголок». |
| `darkEmptyCta` | Enter Dark Corner | Войти в «Тёмный уголок» |

Also update the copy that says "both games": `accountSubtitle` ("One Discord sign-in, every game." / «Один вход через Discord — все игры.») and `signedOutBody` (name all three games), and the `index.html` meta description.

`src/styles.css`: a tint for the card (blood red, from Dark Corner's look):

```css
:root {
  --dark: #b3322f;
}
.gamecard.dark {
  --tint: var(--dark);
}
```

`.cards` is `repeat(auto-fit, minmax(320px, 1fr))` in a 980 px page, so the third card wraps onto its own row. `minmax(290px, 1fr)` would fit three across, if the Minecraft card's six stats still read well at that width.

## apps/landing (the public page)

- `src/config.ts`: `export const DARK_ORIGIN = (import.meta.env.VITE_DARK_ORIGIN ?? 'http://localhost:5180').replace(/\/+$/, '');`
- `src/App.tsx`: widen `GameCard`'s `variant` to `'aether' | 'mc' | 'dark'`, import `DARK_ORIGIN`, and add a third card after Minecraft's:

```tsx
<GameCard
  variant="dark"
  art="🐉"
  kicker={t.darkKicker}
  title={t.darkTitle}
  pitch={t.darkPitch}
  points={t.darkPoints}
  cta={t.darkCta}
  href={DARK_ORIGIN}
/>
```

- `src/i18n.tsx`, after `mcCta`:

| Key | en | ru |
|---|---|---|
| `darkTitle` | Dark Corner | Тёмный уголок |
| `darkKicker` | Labyrinth RPG | RPG-лабиринт |
| `darkPitch` | A D&D-style Hero, one huge labyrinth shared with your friends, and loot you can lose. A Season ends when someone slays the Dragon. | Герой в духе D&D, один огромный лабиринт на всех друзей и добыча, которую можно потерять. Сезон кончается, когда кто-то сразит дракона. |
| `darkPoints` | ["Roll your Hero and choose your Doors", "Tiers, Relics and a Forge that can shatter your gear", "Seasons with a Champion, then a Wipe"] | ["Бросьте кости за героя и выбирайте двери", "Ранги, реликвии и кузница, которая может всё разбить", "Сезоны с чемпионом, а потом вайп"] |
| `darkCta` | Enter Dark Corner | Войти в «Тёмный уголок» |

- Update "Two games" copy: `tagline`, `intro`, `howTitle`, `howBody` (en and ru), and the meta description in `index.html`.
- `src/styles.css`: the same `--dark` color in `:root` and a `.gamecard.dark { --tint: var(--dark); }` rule next to the other two. The landing page fits three cards across already.

## Build and deploy

- `Dockerfile`: in both `landing-build` and `account-build`, add `ARG VITE_DARK_ORIGIN=http://localhost:5180` and `ENV VITE_DARK_ORIGIN=$VITE_DARK_ORIGIN`.
- `docker-compose.yml`: in both the landing and account `args`, add `VITE_DARK_ORIGIN: ${DARK_ORIGIN:-http://localhost:5180}`.
- `.env.example`:
  - Add Dark Corner's `.env` (`/opt/darkcorner`) to the list of places that need the same `SSO_SECRET`.
  - Add `DARK_ORIGIN` to the "Where everything lives" table (dev: 5180) and `# DARK_ORIGIN=https://dark.ugolok.world` to the production examples.
- `apps/api/src/sso.ts`: add Dark Corner's copy (`apps/api/src/lib/sso.ts`) to the COPY NOTICE.
- `README.md`: add the project row (`browser-game`, `/opt/darkcorner`, `dark.ugolok.world`) and update "both games" wording where it lists them.
- Nothing else changes: the hub's API, CI, `docker-compose.prod.yml` and `deploy.sh` don't list games.
