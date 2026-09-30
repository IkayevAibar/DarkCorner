import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { en, type MapTextKey } from './en';
import { ru } from './ru';

/** Map copy travels with the lazy Labyrinth chunk, keeping the first load unchanged. */
export function useMapText() {
  const { locale, t: shared } = useI18n();
  return { t: (key: MapTextKey | MessageKey) => key in en
    ? (locale === 'ru' ? ru : en)[key as MapTextKey] : shared(key as MessageKey) };
}
