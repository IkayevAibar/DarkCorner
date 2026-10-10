import { useState } from 'react';
import type { AbilitySetView } from '@dark/shared';
import { AbilityRoll } from '../../components/dice/AbilityRoll';
import { useI18n } from '../../i18n';

export const ABILITY_SETS: AbilitySetView[] = [
  { rolls: {
    str: { dice: [6, 3, 5, 4], dropped: 1, total: 15 }, dex: { dice: [2, 4, 4, 5], dropped: 0, total: 13 },
    con: { dice: [6, 6, 1, 4], dropped: 2, total: 16 }, int: { dice: [2, 3, 4, 1], dropped: 3, total: 9 },
    wis: { dice: [3, 3, 3, 3], dropped: 2, total: 9 }, cha: { dice: [5, 6, 6, 6], dropped: 0, total: 18 },
  }, scores: { str: 15, dex: 13, con: 16, int: 9, wis: 9, cha: 18 }, total: 80 },
  { rolls: {
    str: { dice: [1, 1, 1, 1], dropped: 3, total: 3 }, dex: { dice: [6, 6, 6, 6], dropped: 1, total: 18 },
    con: { dice: [5, 4, 3, 6], dropped: 2, total: 15 }, int: { dice: [6, 5, 5, 4], dropped: 3, total: 16 },
    wis: { dice: [5, 2, 4, 5], dropped: 1, total: 14 }, cha: { dice: [4, 3, 2, 1], dropped: 3, total: 9 },
  }, scores: { str: 3, dex: 18, con: 15, int: 16, wis: 14, cha: 9 }, total: 75 },
];

export function DicePreview() {
  const { t } = useI18n();
  const [roll, setRoll] = useState(0);
  return <section className="grid gap-3" data-dice-preview>
    <h2 className="sub-heading m-0">{t('create.roll')}</h2>
    <AbilityRoll key={roll} set={ABILITY_SETS[roll % ABILITY_SETS.length]!} />
    <button type="button" className="btn" onClick={() => setRoll(n => n + 1)}>{t('create.roll')}</button>
  </section>;
}
