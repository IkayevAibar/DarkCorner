import { type SoloSettings, api } from '../api';
import { useI18n } from '../i18n';
import { useAction } from './useAction';
import { useLoad } from './useLoad';

const DIFFICULTIES = ['story', 'normal', 'hard'] as const;

/**
 * The solo build's Save settings (docs/plan-solo-offline.md, decisions 5 and 6):
 * Story, Normal or Hard, and Iron mode. Chosen before the first Hero, on the
 * screen that makes it; afterwards `summary` shows them, fixed, in the Account.
 */
export function SaveSettings({ summary = false }: { summary?: boolean }) {
  const { t } = useI18n();
  const { data, setData } = useLoad(api.soloSettings);
  const { busy, error, run } = useAction();
  if (!data) return null;
  if (summary) {
    return (
      <div className="grid gap-1">
        <span className="sub-heading">{t('save.title')}</span>
        <p className="m-0 text-sm">
          {t('save.difficulty')}: {t(`save.difficulty.${data.difficulty}`)} · {t('save.iron')}: {data.iron ? t('account.on') : t('account.off')}
        </p>
        <p className="m-0 text-xs text-muted">{t(data.locked ? 'save.fixed' : 'save.choose')}</p>
      </div>
    );
  }
  // The choice is made: the first Hero has been made.
  if (data.locked) return null;
  const choose = (next: Omit<SoloSettings, 'locked'>) => void run(async () => setData(await api.setSoloSettings(next)));

  return (
    <div className="grid gap-2 rounded-sm border border-bone/15 bg-black/20 p-3">
      <div className="grid gap-0.5">
        <span className="sub-heading">{t('save.title')}</span>
        <p className="m-0 text-xs text-muted">{t('save.choose')}</p>
      </div>
      <span className="text-sm">{t('save.difficulty')}</span>
      <div className="flex flex-wrap gap-2">
        {DIFFICULTIES.map((d) => (
          <button key={d} type="button" className={`btn btn-small ${d === data.difficulty ? 'btn-primary' : ''}`} aria-pressed={d === data.difficulty}
            disabled={busy} onClick={() => choose({ difficulty: d, iron: data.iron })}>
            {t(`save.difficulty.${d}`)}
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-muted">{t(`save.difficulty.${data.difficulty}.about`)}</p>
      <span className="text-sm">{t('save.iron')}</span>
      <div className="flex gap-2">
        {([false, true] as const).map((iron) => (
          <button key={String(iron)} type="button" className={`btn btn-small ${iron === data.iron ? 'btn-primary' : ''}`} aria-pressed={iron === data.iron}
            disabled={busy} onClick={() => choose({ difficulty: data.difficulty, iron })}>
            {iron ? t('account.on') : t('account.off')}
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-muted">{t('save.iron.about')}</p>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
