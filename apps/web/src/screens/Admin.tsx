import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayer, RollLogView, Tier } from '@dark/shared';
import { TIERS } from '@dark/shared';
import { api } from '../api';
import { useAction } from '../components/useAction';
import { useLoad } from '../components/useLoad';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import { formatClock } from '../time';

const STATUS_STYLE: Record<AdminPlayer['status'], string> = {
  pending: 'text-gold border-gold/60',
  approved: 'text-tier-uncommon border-tier-uncommon/60',
  banned: 'text-tier-mythic border-tier-mythic/60',
};

type Tab = 'players' | 'season' | 'grant' | 'rolls';

/** Admin tools (docs/plan-season-0.md, week 5): Players, the Season, grants for testing, the roll log. */
export function Admin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('players');
  return (
    <section className="grid gap-3">
      <h1 className="sub-heading m-0">{t('admin.title')}</h1>
      <div className="grid grid-cols-4 gap-1.5">
        {(['players', 'season', 'grant', 'rolls'] as const).map((id) => (
          <button key={id} type="button" className={`btn btn-small ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
            {t(`admin.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'players' && <Players />}
      {tab === 'season' && <SeasonPanel />}
      {tab === 'grant' && <GrantPanel />}
      {tab === 'rolls' && <RollLog />}
    </section>
  );
}

function Players() {
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
    <>
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
    </>
  );
}

function SeasonPanel() {
  const { t, locale } = useI18n();
  const { data, setData, reload } = useLoad(api.adminSeason);
  const { busy, error, run } = useAction();
  const [minutes, setMinutes] = useState('10');
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (!data) return <p className="text-muted">{t('loading')}</p>;
  const { season } = data;
  const when = (iso: string | null) => (iso ? `${new Date(iso).toLocaleDateString(locale)} ${formatClock(locale, iso)}` : '—');
  const act = (action: 'start' | 'end' | 'gate' | 'vault', mins?: number) => void run(async () => {
    setData(await api.adminSeasonAction(action, mins));
    setConfirmEnd(false);
  });

  return (
    <div className="grid gap-3">
      <div className="panel grid gap-1 p-3 text-sm">
        <span className="font-head text-lg font-extrabold">{t('admin.season.title', { n: season.number })} · {t(`season.${season.status}`)}</span>
        <span>{t('admin.season.started', { when: when(season.startsAt) })}</span>
        <span>{t('admin.season.gate', { when: when(season.bossGateAt) })}</span>
        {season.wipeAt && <span>{t('admin.season.wipe', { when: when(season.wipeAt) })}</span>}
        <span>{t('admin.season.weakening', { n: Math.round(season.weakening * 100) })} · {t('admin.season.relics', { n: season.relicsLeft })} · {t('admin.season.heroes', { n: data.heroes })}</span>
        {season.podium.map((p) => <span key={p.place}>#{p.place} {p.hero} ({p.player})</span>)}
        {!data.webhook && <span className="text-[#ff9a8a]">{t('admin.season.noWebhook')}</span>}
      </div>

      <div className="grid gap-2">
        {season.status === 'planned' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('start')}>{t('admin.season.start')}</button>
        )}
        {(season.status === 'active' || season.status === 'finale') && (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => act('gate')}>{t('admin.season.openGate')}</button>
            <div className="flex gap-2">
              <input className="field w-24" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} aria-label={t('admin.season.minutes')} />
              <button type="button" className="btn flex-1" disabled={busy} onClick={() => act('vault', Number(minutes || 0))}>{t('admin.season.vault')}</button>
            </div>
            {confirmEnd ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('end')}>{t('admin.season.endSure')}</button>
            ) : (
              <button type="button" className="btn border-[#8a1c1c] text-[#ff9a8a]" disabled={busy} onClick={() => setConfirmEnd(true)}>{t('admin.season.end')}</button>
            )}
          </>
        )}
        {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      </div>

      <section className="grid gap-1">
        <div className="flex items-center justify-between">
          <span className="sub-heading">{t('admin.season.jobs')}</span>
          <button type="button" className="chip" onClick={() => void reload()}>{t('admin.refresh')}</button>
        </div>
        {data.jobs.map((j) => (
          <div key={j.id} className={`flex justify-between gap-2 text-xs ${j.doneAt ? 'text-muted' : ''}`}>
            <span className="font-bold">{j.kind}</span>
            <span>{j.doneAt ? `✓ ${when(j.doneAt)}` : when(j.runAt)}{j.lastError ? ` · ${j.lastError}` : ''}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

const GRANT_BASES = [
  'potion', 'scroll-identify', 'scroll-portal', 'scroll-protection', 'key-iron', 'key-silver', 'key-gold', 'chest-iron', 'chest-silver',
  'chest-gold', 'scrap', 'essence', 'soulstone', 'longsword', 'greatsword', 'dagger', 'longbow', 'staff', 'mace', 'shield', 'orb', 'plate',
  'leather', 'robes', 'helm', 'boots', 'gloves', 'amulet', 'ring',
];

function GrantPanel() {
  const { t } = useI18n();
  const players = useLoad(api.adminPlayers);
  const { busy, error, run } = useAction();
  const [playerId, setPlayerId] = useState('');
  const [gold, setGold] = useState('');
  const [base, setBase] = useState('');
  const [tier, setTier] = useState<Tier>('common');
  const [quantity, setQuantity] = useState('1');
  const [identified, setIdentified] = useState(true);
  const [done, setDone] = useState(false);
  const approved = (players.data?.players ?? []).filter((p) => p.status === 'approved');

  const submit = () => void run(async () => {
    setDone(false);
    await api.adminGrant({
      playerId,
      gold: gold ? Number(gold) : undefined,
      item: base ? { base, tier, identified, quantity: Math.max(1, Number(quantity) || 1) } : undefined,
    });
    setDone(true);
  });

  return (
    <div className="panel grid gap-3 p-3">
      <p className="m-0 text-sm text-muted">{t('admin.grant.hint')}</p>
      <select className="field" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
        <option value="">{t('admin.grant.player')}</option>
        {approved.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input className="field" inputMode="numeric" placeholder={t('admin.grant.gold')} value={gold} onChange={(e) => setGold(e.target.value.replace(/\D/g, ''))} />
      <select className="field" value={base} onChange={(e) => setBase(e.target.value)}>
        <option value="">{t('admin.grant.noItem')}</option>
        {GRANT_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      {base && (
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            {TIERS.filter((x) => x !== 'relic').map((x) => <option key={x} value={x}>{t(`tier.${x}`)}</option>)}
          </select>
          <input className="field" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} aria-label={t('admin.grant.quantity')} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={identified} onChange={(e) => setIdentified(e.target.checked)} />
            {t('admin.grant.identified')}
          </label>
        </div>
      )}
      <button type="button" className="btn btn-primary" disabled={busy || !playerId || (!gold && !base)} onClick={submit}>{t('admin.grant.go')}</button>
      {done && <p className="m-0 text-sm text-tier-uncommon">{t('admin.grant.done')}</p>}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

function RollLog() {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState('');
  const [data, setData] = useState<RollLogView | null>(null);
  useEffect(() => {
    let live = true;
    void api.adminRolls(kind || undefined).then((r) => live && setData(r));
    return () => {
      live = false;
    };
  }, [kind]);
  return (
    <div className="grid gap-2">
      <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="">{t('admin.rolls.all')}</option>
        {['drop', 'fight', 'chest', 'forge', 'reforge', 'salvage', 'event', 'abilities', 'admin-grant'].map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      {data?.rolls.map((r) => (
        <details key={r.id} className="panel p-2 text-xs">
          <summary className="cursor-pointer">
            <span className="font-bold">{r.kind}</span> · {r.player ?? '—'} · {formatClock(locale, r.at)}
          </summary>
          <pre className="m-0 mt-1 overflow-x-auto whitespace-pre-wrap break-all text-muted">{JSON.stringify(r.detail, null, 1)}{'\n'}seed {r.seed}</pre>
        </details>
      ))}
      {data?.rolls.length === 0 && <p className="m-0 text-sm text-muted">{t('admin.empty')}</p>}
    </div>
  );
}

