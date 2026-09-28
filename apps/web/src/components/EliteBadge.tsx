import type { Elite } from '@dark/shared';
import { useI18n } from '../i18n';

/** Shared by the encounter cards and fight playback. */
export function EliteBadge({ elite }: { elite: Elite }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-[2px] border px-1 font-head text-[10px] font-extrabold uppercase ${elite === 'gilded' ? 'border-gold text-gold' : 'border-tier-epic text-tier-epic'} bg-black/70`}>
      {t(`elite.${elite}`)}
    </span>
  );
}
