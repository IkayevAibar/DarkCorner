import { NavLink } from 'react-router';
import { useI18n } from '../../i18n';

/** Shown by screens that need a Hero when the Player has none yet. */
export function NeedHero() {
  const { t } = useI18n();
  return (
    <div className="panel grid gap-3 p-4 text-center">
      <p className="m-0">{t('lab.noHero')}</p>
      <NavLink to="/heroes" className="btn btn-primary no-underline">{t('lab.createHero')}</NavLink>
    </div>
  );
}
