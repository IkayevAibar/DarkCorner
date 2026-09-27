import { useI18n } from '../i18n';

/**
 * Codex builds visual components here against @dark/shared types with fake
 * data, before they are wired to the API. Only reachable in development builds.
 */
export function Sandbox() {
  const { t } = useI18n();
  return (
    <section className="grid gap-3">
      <h1 className="sub-heading m-0">{t('sandbox.title')}</h1>
      <p className="m-0 text-muted">{t('sandbox.body')}</p>
    </section>
  );
}
