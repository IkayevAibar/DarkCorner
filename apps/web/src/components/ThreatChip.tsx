import type { Threat } from '@dark/shared';
import { useI18n } from '../i18n';

/** Each Threat's border and text color, from harmless grey to Mythic red. */
export const THREAT_TONE: Record<Threat, string> = {
  trivial: 'border-line text-muted',
  easy: 'border-tier-uncommon text-tier-uncommon',
  risky: 'border-gold text-gold',
  dangerous: 'border-tier-legendary text-tier-legendary',
  deadly: 'border-tier-mythic text-tier-mythic',
};

export function ThreatChip({ threat }: { threat: Threat }) {
  const { t } = useI18n();
  return <span className={`chip bg-[rgb(22_18_14/0.9)] font-head font-extrabold ${THREAT_TONE[threat]}`}>{t(`threat.${threat}`)}</span>;
}
