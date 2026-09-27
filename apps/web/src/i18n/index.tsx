import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@dark/shared';
import { en, type MessageKey } from './en';
import { ru } from './ru';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ru };

/** `?lang=` wins (the hub passes it along), then the browser's language. */
function initialLocale(): Locale {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'ru' || fromUrl === 'en') return fromUrl;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = dictionaries[locale].brand;
  }, [locale]);

  const t = useCallback<I18n['t']>(
    (key, vars) => {
      const text = dictionaries[locale][key] ?? en[key];
      return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
