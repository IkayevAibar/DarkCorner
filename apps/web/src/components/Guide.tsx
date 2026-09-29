import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';

/** The guide's sections, in the order a new Player meets them. */
const SECTIONS = ['hero', 'moves', 'facing', 'alive', 'death', 'loot', 'grow', 'daily', 'season'] as const;

/** How to play: the game in nine short sections, from the "?" in the top bar. */
export function Guide() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      {SECTIONS.map((s) => (
        <section key={s} className="grid gap-0.5">
          <span className="sub-heading">{t(`guide.${s}.title` as MessageKey)}</span>
          <p className="m-0 text-sm leading-snug">{t(`guide.${s}.body` as MessageKey)}</p>
        </section>
      ))}
    </div>
  );
}
