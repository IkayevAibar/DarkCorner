import { useI18n } from '../i18n';
import { isIos, useInstall } from '../install';
import { useSheet } from './Sheet';

/** The taps that put the game on the home screen, for browsers without their own prompt. */
function InstallSteps() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <p className="m-0">{t('install.why')}</p>
      <ol className="m-0 grid list-decimal gap-1.5 pl-5 marker:text-brass">
        {isIos ? (
          <>
            <li>{t('install.ios.1')}</li>
            <li>{t('install.ios.2')}</li>
            <li>{t('install.ios.3')}</li>
          </>
        ) : (
          <>
            <li>{t('install.android.1')}</li>
            <li>{t('install.android.2')}</li>
          </>
        )}
      </ol>
      {isIos && <p className="m-0 text-sm text-muted">{t('install.ios.only')}</p>}
    </div>
  );
}

/**
 * An offer to put Dark Corner on the home screen: the browser's own prompt where
 * there is one, the steps where there isn't. Nothing once it opens from there.
 */
export function InstallCard({ onDismiss }: { onDismiss?: () => void }) {
  const { t } = useI18n();
  const { openSheet } = useSheet();
  const install = useInstall();
  if (install.installed) return null;
  const go = () => {
    if (install.canPrompt) void install.prompt();
    else openSheet({ title: t('install.title'), body: <InstallSteps /> });
  };
  return (
    <section className="panel flex items-center gap-3 p-3">
      <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-[10px]" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-head leading-tight font-bold">{t('install.title')}</span>
        <span className="text-xs text-muted">{t('install.body')}</span>
      </div>
      <button type="button" className="btn btn-small btn-primary shrink-0" onClick={go}>
        {install.canPrompt ? t('install.button') : t('install.how')}
      </button>
      {onDismiss && (
        <button type="button" className="chip size-8 shrink-0 justify-center rounded-full p-0" aria-label={t('close')} onClick={onDismiss}>
          ×
        </button>
      )}
    </section>
  );
}
