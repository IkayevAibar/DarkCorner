import type { LocalizedText } from '@dark/shared';
import { BLESSINGS, type BlessingId } from '@dark/engine';

/**
 * Solo wording for what the server counts in hours (docs/plan-solo-offline.md →
 * Days). The game's clock stands still until the Hero sleeps, so what lasts a few
 * hours online lasts until the night here.
 */
const BLESSING_TEXT: Record<BlessingId, LocalizedText> = {
  fortune: { en: '+25% magic find until you sleep.', ru: '+25% к удаче в добыче до ночи.' },
  greed: { en: '+50% gold find until you sleep.', ru: '+50% к золоту до ночи.' },
  oathbroken: {
    en: 'Half the gold and −25% magic find until you sleep: the price of a cracked Oathstone.',
    ru: 'Вдвое меньше золота и −25% к удаче в добыче до ночи: цена расколотого Камня клятв.',
  },
  providence: { en: 'Your Bad-luck meter fills twice as fast until you sleep.', ru: 'Счётчик невезения до ночи наполняется вдвое быстрее.' },
};

/** What a Blessing (or a curse) does, in Days. */
export const blessingText = (id: BlessingId): LocalizedText => BLESSING_TEXT[id] ?? BLESSINGS[id].description;
