import type { LocalizedText } from '@dark/shared';
import { useI18n } from '../../i18n';

/** Content text without loading an Item card's presentation or comparison code. */
export function useText() {
  const { locale } = useI18n();
  return (text: LocalizedText) => text[locale];
}
