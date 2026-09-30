import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import type { DuoHero, DuoState } from '@dark/shared';
import { api } from '../api';
import { useI18n } from '../i18n';
import { play } from '../sound';
import { useNow } from '../time';
import { Token } from './Token';
import { useAction } from './useAction';
import { useLoad, useRefresh } from './useLoad';

/**
 * Duos (docs/design.md → Duos): walk the Labyrinth with a friend. Invite a Hero
 * whose Player is online in the City, answer an invite, or leave the Duo. Looks
 * again every few seconds, since an invite or an answer can come at any time;
 * `onChange` hears when the Duo forms or ends (the Gate reloads its view).
 */
export function DuoCard({ onChange }: { onChange?: () => void }) {
  const { t } = useI18n();
  const { data, setData, reload } = useLoad(api.duo);
  useRefresh(reload, 5_000);
  const { busy, error, run } = useAction();
  // Only a new partner (or none) matters to the screen around the card.
  const partnerId = data?.partner?.heroId ?? null;
  const known = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    if (known.current !== undefined && known.current !== partnerId) onChange?.();
    known.current = partnerId;
  }, [data, partnerId, onChange]);
  if (!data) return null;

  const update = (call: () => Promise<DuoState>, sound?: () => void) => void run(async () => {
    const next = await call();
    setData(next);
    sound?.();
  });
  const { partner, incoming, outgoing } = data;
  // Someone who has invited this Hero is answered above, not invited back.
  const candidates = data.candidates.filter((c) => !incoming.some((i) => i.from.heroId === c.heroId));

  return (
    <section className="panel grid gap-2.5 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sub-heading">{t('duo.title')}</span>
        {!partner && <span className="text-xs text-muted">{t('duo.blurb')}</span>}
      </div>

      {partner && (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={48} />
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-head text-lg leading-tight font-extrabold">{partner.name}</span>
              <span className="text-sm text-muted">
                {t('duo.partnerLine', { level: partner.level, cls: t(`class.${partner.class}`) })} ·{' '}
                <span className={partner.online ? 'text-tier-uncommon' : 'text-[#ff9a8a]'}>{partner.online ? t('duo.online') : t('duo.away')}</span>
              </span>
            </div>
          </div>
          <p className="m-0 text-sm text-muted">{data.inside ? t('duo.insideNow') : t('duo.together')}</p>
          {data.inside && <NavLink to="/labyrinth" className="btn btn-primary no-underline">{t('duo.join')}</NavLink>}
          <button type="button" className="btn btn-small justify-self-start" disabled={busy} onClick={() => update(api.duoLeave)}>
            {t('duo.leave')}
          </button>
        </div>
      )}

      {!partner && incoming.map((invite) => (
        <div key={invite.id} className="grid gap-2 rounded-[2px] border border-gold/70 bg-[rgb(224_184_106/0.08)] p-2.5">
          <div className="flex items-center gap-3">
            <Token art={invite.from.portraitUrl} label={invite.from.name} ring={invite.from.banner} size={44} />
            <span className="text-[15px] leading-snug">{t('duo.invited', { name: invite.from.name })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => update(() => api.duoAccept(invite.id), () => play('chips'))}>
              {t('duo.accept')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => update(() => api.duoDecline(invite.id))}>
              {t('duo.decline')}
            </button>
          </div>
        </div>
      ))}

      {!partner && outgoing && <Outgoing hero={outgoing.to} expiresAt={outgoing.expiresAt} busy={busy} onCancel={() => update(() => api.duoDecline(outgoing.id))} />}

      {!partner && data.inside && <p className="m-0 text-sm text-muted">{t('duo.fromCity')}</p>}

      {!partner && !outgoing && !data.inside && (
        candidates.length === 0 ? (
          <p className="m-0 text-sm text-muted">{t('duo.nobody')}</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {candidates.map((c) => (
              <li key={c.heroId} className="flex items-center gap-2.5">
                <Token art={c.portraitUrl} label={c.name} ring={c.banner} size={36} />
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-head font-bold">{c.name}</span>
                  <span className="text-xs text-muted">{t('duo.partnerLine', { level: c.level, cls: t(`class.${c.class}`) })}</span>
                </span>
                <button type="button" className="btn btn-small" disabled={busy} onClick={() => update(() => api.duoInvite(c.heroId))}>
                  {t('duo.invite')}
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}

/** An invite on its way: who to, how long it lasts, and taking it back. */
function Outgoing({ hero, expiresAt, busy, onCancel }: { hero: DuoHero; expiresAt: string; busy: boolean; onCancel: () => void }) {
  const { t } = useI18n();
  const now = useNow(15_000);
  const minutes = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
  return (
    <div className="flex items-center gap-3">
      <Token art={hero.portraitUrl} label={hero.name} ring={hero.banner} size={40} />
      <span className="grid min-w-0 flex-1 text-sm leading-snug">
        <span>{t('duo.waiting', { name: hero.name })}</span>
        <span className="text-xs text-muted">{t('duo.expires', { n: minutes })}</span>
      </span>
      <button type="button" className="btn btn-small" disabled={busy} onClick={onCancel}>{t('duo.cancel')}</button>
    </div>
  );
}
