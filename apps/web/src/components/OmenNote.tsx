import type { OmenView } from '@dark/shared';
import { useI18n } from '../i18n';
import { useText } from './items/text';

/** Today's Omen: how the Labyrinth leans for everyone (docs/design.md → Omens). */
export function OmenNote({ omen }: { omen: OmenView }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <p className="m-0 rounded-[2px] border border-tier-epic/50 bg-[rgb(176_102_255/0.08)] px-3 py-2 text-sm">
      <span className="font-head font-bold text-tier-epic">{t('omen.today')}: {text(omen.name)}.</span> {text(omen.description)}
    </p>
  );
}
