import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { CreationOptions, MyHeroResponse } from '@dark/shared';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { CharacterSheet } from './CharacterSheet';
import { CreateHero } from './CreateHero';
import { QuickStart } from './QuickStart';

/** The Heroes tab: create a Hero if there is none, otherwise the character sheet. */
export function Heroes() {
  const { t } = useI18n();
  const [state, setState] = useState<MyHeroResponse | null>(null);
  const [options, setOptions] = useState<CreationOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const custom = params.has('custom');

  const load = useCallback(async () => {
    try {
      const [me, opts] = await Promise.all([api.myHero(), options ? Promise.resolve(options) : api.heroOptions()]);
      setState(me);
      setOptions(opts);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [options]);

  // Loads once on mount; later reloads come from the children's callbacks.
  useEffect(() => {
    void load();
  }, []);

  if (failed) {
    return (
      <div className="panel grid gap-3 p-4 text-center">
        <p className="m-0">{t('error')}</p>
        <button type="button" className="btn" onClick={() => void load()}>{t('retry')}</button>
      </div>
    );
  }
  if (!state || !options) return <p className="text-center text-muted">{t('loading')}</p>;

  if (state.hero) {
    return <CharacterSheet hero={state.hero} canRetire={state.canRetire} options={options} onChanged={() => void load()} />;
  }
  if (state.canCreate) {
    // A Player who has rolled abilities already is building their own.
    if (!custom && !state.draft) {
      return <QuickStart onCreated={() => navigate('/labyrinth')} onCustom={() => setParams({ custom: '1' })} />;
    }
    return <CreateHero options={options} initialDraft={state.draft} onCreated={() => void load()} />;
  }
  return <p className="text-center text-muted">{t('hero.retireUsed')}</p>;
}
