import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayer } from '@dark/shared';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';

const STATUS_STYLE: Record<AdminPlayer['status'], string> = {
  pending: 'text-gold border-gold/60',
  approved: 'text-tier-uncommon border-tier-uncommon/60',
  banned: 'text-tier-mythic border-tier-mythic/60',
};

export function Admin() {
  const { t } = useI18n();
  const { session, reload: reloadSession } = useSession();
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPlayers((await api.adminPlayers()).players);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: 'approve' | 'ban' | 'reset') => {
    setBusy(id);
    try {
      await api.decidePlayer(id, decision);
      await load();
      if (session.state === 'signedIn' && session.player.id === id) await reloadSession();
    } finally {
      setBusy(null);
    }
  };

  const me = session.state === 'signedIn' ? session.player.id : null;

  return (
    <section className="grid gap-3">
      <h1 className="sub-heading m-0">{t('admin.title')}</h1>
      {players?.length === 0 && <p className="text-muted">{t('admin.empty')}</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {players?.map((p) => (
          <li key={p.id} className="panel flex items-center gap-3 p-3">
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-head text-lg font-bold">
                {p.name}
                {p.id === me && <span className="ml-2 text-sm text-muted">({t('admin.you')})</span>}
              </span>
              <span className="truncate text-xs text-muted">{p.discordId}</span>
            </div>
            <span className={`chip ${STATUS_STYLE[p.status]}`}>{t(`status.${p.status}`)}</span>
            {p.id !== me && (
              <div className="flex gap-1">
                {p.status !== 'approved' && (
                  <button type="button" className="btn btn-primary btn-small" disabled={busy === p.id} onClick={() => void decide(p.id, 'approve')}>
                    {t('admin.approve')}
                  </button>
                )}
                {p.status !== 'banned' && (
                  <button type="button" className="btn btn-small" disabled={busy === p.id} onClick={() => void decide(p.id, 'ban')}>
                    {t('admin.ban')}
                  </button>
                )}
                {p.status !== 'pending' && (
                  <button type="button" className="btn btn-small" disabled={busy === p.id} onClick={() => void decide(p.id, 'reset')}>
                    {t('admin.reset')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
