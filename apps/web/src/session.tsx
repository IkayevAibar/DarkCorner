import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthStatus, Locale, PlayerView } from '@dark/shared';
import { api, ApiRequestError } from './api';
import { useI18n } from './i18n';

type Session =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'signedOut'; auth: AuthStatus }
  | { state: 'signedIn'; auth: AuthStatus; player: PlayerView };

interface SessionApi {
  session: Session;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Switches the language now and remembers it on the Player. */
  changeLocale: (locale: Locale) => void;
  setPlayer: (player: PlayerView) => void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n();
  const [session, setSession] = useState<Session>({ state: 'loading' });

  const reload = useCallback(async () => {
    try {
      const auth = await api.authStatus();
      try {
        const { player } = await api.me();
        // The hub's ?lang= beats what the Player saved last time, for this visit.
        if (player.locale && !new URLSearchParams(window.location.search).has('lang')) setLocale(player.locale);
        setSession({ state: 'signedIn', auth, player });
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) setSession({ state: 'signedOut', auth });
        else throw error;
      }
    } catch {
      setSession({ state: 'error' });
    }
  }, [setLocale]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    const { redirect } = await api.logout();
    if (redirect) window.location.href = redirect;
    else await reload();
  }, [reload]);

  const changeLocale = useCallback(
    (locale: Locale) => {
      setLocale(locale);
      if (session.state === 'signedIn') {
        api
          .updateMe({ locale })
          .then(({ player }) => setSession((s) => (s.state === 'signedIn' ? { ...s, player } : s)))
          .catch(() => {});
      }
    },
    [session.state, setLocale],
  );

  const setPlayer = useCallback((player: PlayerView) => {
    setSession((s) => (s.state === 'signedIn' ? { ...s, player } : s));
  }, []);

  return (
    <SessionContext.Provider value={{ session, reload, signOut, changeLocale, setPlayer }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
