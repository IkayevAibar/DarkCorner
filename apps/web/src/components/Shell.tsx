import { NavLink, Outlet, useMatch } from 'react-router';
import type { Locale } from '@dark/shared';
import { Guide, useFirstVisitGuide } from './Guide';
import { InstallCard } from './InstallCard';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { markNewsRead, newsUnread } from '../newsState';
import { useSession } from '../session';
import { setSoundOn, useSoundOn } from '../sound';
import { Icon, type IconName } from './Icon';
import { useSheet } from './Sheet';

const TABS: { to: string; icon: IconName; label: MessageKey }[] = [
  { to: '/city', icon: 'city', label: 'tab.city' },
  { to: '/labyrinth', icon: 'labyrinth', label: 'tab.labyrinth' },
  { to: '/loot', icon: 'loot', label: 'tab.loot' },
  { to: '/heroes', icon: 'heroes', label: 'tab.heroes' },
];

/** Top bar, the current screen, and the tab bar a thumb can reach. */
export function Shell() {
  const city = useMatch('/city');
  const sandbox = useMatch('/sandbox');
  const wide = !!city || !!sandbox;
  return (
    <div className={`relative mx-auto min-h-dvh ${wide ? 'max-w-[920px]' : 'max-w-[560px]'} pb-[calc(var(--nav-h)+24px+env(safe-area-inset-bottom))]`}>
      <TopBar />
      <main className="screen-in px-4 pt-3 pb-4">
        <Outlet />
      </main>
      <TabBar wide={wide} />
    </div>
  );
}

function TopBar() {
  const { t, locale } = useI18n();
  const { session, changeLocale } = useSession();
  const { openSheet } = useSheet();
  const other: Locale = locale === 'en' ? 'ru' : 'en';
  const player = session.state === 'signedIn' ? session.player : null;
  useFirstVisitGuide(player !== null);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-[rgb(11_10_9/0.92)] px-4 py-2.5 backdrop-blur-md">
      <span className="truncate font-head text-[21px] font-extrabold tracking-wide text-[#e8cf9a] [text-shadow:0_0_18px_rgb(224_184_106/0.25)]">
        {t('brand')}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="chip" onClick={() => changeLocale(other)}>
          {other.toUpperCase()}
        </button>
        {player && (
          <NavLink
            to="/news"
            className="chip relative size-[34px] justify-center rounded-full p-0 no-underline"
            aria-label={t('news.title')}
            title={t('news.title')}
            onClick={markNewsRead}
          >
            <Icon name="news" className="size-[18px]" />
            {newsUnread() && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-black bg-tier-mythic" />}
          </NavLink>
        )}
        <button
          type="button"
          className="chip size-[34px] justify-center rounded-full p-0 font-head text-base font-extrabold"
          aria-label={t('guide.title')}
          onClick={() => openSheet({ title: t('guide.title'), body: <Guide /> })}
        >
          ?
        </button>
        {player && (
          <button
            type="button"
            className="chip size-[34px] justify-center overflow-hidden rounded-full p-0"
            aria-label={t('account.title')}
            onClick={() => openSheet({ title: t('account.title'), body: <AccountSheet /> })}
          >
            {player.avatarUrl ? <img src={player.avatarUrl} alt="" className="size-full object-cover" /> : <Icon name="user" className="size-5" />}
          </button>
        )}
      </div>
    </header>
  );
}

/** The SRD's attribution statement, kept word for word in both languages as its license asks. */
const SRD_ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

function AccountSheet() {
  const { t, locale } = useI18n();
  const { session, signOut, changeLocale } = useSession();
  const { closeSheet } = useSheet();
  const soundOn = useSoundOn();
  if (session.state !== 'signedIn') return null;
  const { player } = session;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span className="font-head text-xl font-extrabold">{player.name}</span>
        <span className="chip">{t(`status.${player.status}`)}</span>
      </div>
      <div className="grid gap-2">
        <span className="sub-heading">{t('account.language')}</span>
        <div className="flex gap-2">
          {(['en', 'ru'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`btn btn-small ${l === locale ? 'btn-primary' : ''}`}
              onClick={() => changeLocale(l)}
            >
              {l === 'en' ? 'English' : 'Русский'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="sub-heading">{t('account.sound')}</span>
        <div className="flex gap-2">
          {([true, false] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              className={`btn btn-small ${value === soundOn ? 'btn-primary' : ''}`}
              onClick={() => setSoundOn(value)}
            >
              {value ? t('account.on') : t('account.off')}
            </button>
          ))}
        </div>
      </div>
      <InstallCard />
      {player.isAdmin && (
        <NavLink to="/admin" className="btn text-center no-underline" onClick={closeSheet}>
          {t('account.admin')}
        </NavLink>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => {
          closeSheet();
          void signOut();
        }}
      >
        {t('signOut')}
      </button>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-head font-bold text-bone">{t('account.credits')}</summary>
        <div className="mt-2 grid gap-2">
          <p className="m-0">{t('credits.icons')}</p>
          <p className="m-0">{t('credits.sounds')}</p>
          <p className="m-0"><strong className="text-bone">{t('credits.srdTitle')}.</strong> {SRD_ATTRIBUTION}</p>
        </div>
      </details>
    </div>
  );
}

function TabBar({ wide }: { wide: boolean }) {
  const { t } = useI18n();
  return (
    <nav className={`fixed bottom-0 left-1/2 z-30 grid h-[calc(var(--nav-h)+env(safe-area-inset-bottom))] w-full ${wide ? 'max-w-[920px]' : 'max-w-[560px]'} -translate-x-1/2 grid-cols-4 border-t border-brass-dim bg-[#0e0c0a] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(0_0_0/0.6)]`}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-[3px] font-head text-xs font-bold no-underline ${
              isActive ? 'text-gold [&_svg]:drop-shadow-[0_0_6px_rgb(224_184_106/0.7)]' : 'text-[#857560]'
            }`
          }
        >
          <Icon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
