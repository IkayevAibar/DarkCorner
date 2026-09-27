import { type FormEvent, type ReactNode, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';

/** Everything a Player sees before they are let in: loading, sign-in, waiting, banned. */
export function GateFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="m-0 font-head text-4xl font-extrabold text-[#e8cf9a] [text-shadow:0_0_24px_rgb(224_184_106/0.3)]">
          {t('brand')}
        </h1>
        <p className="mt-2 text-muted italic">{t('tagline')}</p>
      </div>
      {children}
    </div>
  );
}

export function Loading() {
  const { t } = useI18n();
  return (
    <GateFrame>
      <p className="text-center text-muted">{t('loading')}</p>
    </GateFrame>
  );
}

export function LoadError() {
  const { t } = useI18n();
  const { reload } = useSession();
  return (
    <GateFrame>
      <div className="panel grid gap-3 p-4 text-center">
        <p className="m-0">{t('error')}</p>
        <button type="button" className="btn" onClick={() => void reload()}>
          {t('retry')}
        </button>
      </div>
    </GateFrame>
  );
}

export function SignIn() {
  const { t } = useI18n();
  const { session, reload } = useSession();
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(true);
  const [busy, setBusy] = useState(false);
  if (session.state !== 'signedOut') return null;
  const { auth } = session;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.devLogin({ name, admin });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateFrame>
      <div className="panel grid gap-4 p-5">
        <h2 className="sub-heading m-0">{t('signin.title')}</h2>
        {auth.sso && auth.loginUrl && (
          <a className="btn btn-primary text-center no-underline" href={auth.loginUrl}>
            {t('signin.sso')}
          </a>
        )}
        {auth.devLogin && (
          <form className="grid gap-3" onSubmit={submit}>
            <p className="m-0 text-sm text-muted">{t('signin.devHint')}</p>
            <label className="grid gap-1 text-sm">
              {t('signin.devName')}
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={32} required />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
              {t('signin.devAdmin')}
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 2}>
              {t('signin.devSubmit')}
            </button>
          </form>
        )}
      </div>
    </GateFrame>
  );
}

export function Waiting({ banned }: { banned: boolean }) {
  const { t } = useI18n();
  const { signOut, reload } = useSession();
  return (
    <GateFrame>
      <div className="panel grid gap-3 p-5 text-center">
        <h2 className="m-0 font-head text-2xl font-extrabold">{t(banned ? 'banned.title' : 'pending.title')}</h2>
        <p className="m-0 text-muted">{t(banned ? 'banned.body' : 'pending.body')}</p>
        <div className="flex justify-center gap-2">
          {!banned && (
            <button type="button" className="btn" onClick={() => void reload()}>
              {t('retry')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => void signOut()}>
            {t('signOut')}
          </button>
        </div>
      </div>
    </GateFrame>
  );
}
