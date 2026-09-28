import { useEffect, useState } from 'react';
import type { BountiesView, BountyView, HallEntry, HuntView, SeasonView } from '@dark/shared';
import { api, ApiRequestError } from '../../api';
import { Building, Loading } from '../../components/Building';
import { ItemChip, ItemDetails, useText } from '../../components/items/ItemChip';
import { Meter } from '../../components/Meter';
import { OmenNote } from '../../components/OmenNote';
import { useSheet } from '../../components/Sheet';
import { describeError } from '../../errors';
import { useLoad, useRefresh } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { formatDuration, useNow } from '../../time';
import { Rankings } from './Rankings';

/**
 * The Tavern: the Season, the Feed, who's online, the Rankings, and the Hall of Fame.
 * Stand-in until Codex's Tavern lands (docs/tasks/codex-08-tavern-hall.md).
 */
export function Tavern() {
  const { t } = useI18n();
  const text = useText();
  const [tab, setTab] = useState<'feed' | 'rankings' | 'hall'>('feed');
  const tavern = useLoad(api.tavern);
  const hall = useLoad(api.hall);
  useRefresh(tavern.reload, 25_000);
  if (!tavern.data) return <Loading failed={tavern.failed !== null} onRetry={() => void tavern.reload()} />;
  const { season, online, entries } = tavern.data;

  return (
    <Building title={t('city.tavern')} blurb={t('tavern.blurb')} hero={null}>
      <SeasonCard season={season} />
      <Bounties />

      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className={`btn btn-small ${tab === 'feed' ? 'btn-primary' : ''}`} onClick={() => setTab('feed')}>{t('tavern.feed')}</button>
        <button type="button" className={`btn btn-small ${tab === 'rankings' ? 'btn-primary' : ''}`} onClick={() => setTab('rankings')}>{t('tavern.rankings')}</button>
        <button type="button" className={`btn btn-small ${tab === 'hall' ? 'btn-primary' : ''}`} onClick={() => setTab('hall')}>{t('tavern.hall')}</button>
      </div>

      {tab === 'feed' && (
        <>
          <section className="grid gap-1.5">
            <span className="sub-heading">{t('tavern.online', { n: online.length })}</span>
            {online.length === 0 ? <p className="m-0 text-sm text-muted italic">{t('tavern.nobody')}</p> : online.map((o) => (
              <div key={o.name} className="flex justify-between gap-3 text-sm">
                <span className="truncate font-bold">{o.hero ?? o.name} <span className="font-normal text-muted">({o.name})</span></span>
                <span className="shrink-0 text-muted">{text(o.where)}</span>
              </div>
            ))}
          </section>
          <section className="grid gap-1.5">
            <span className="sub-heading">{t('tavern.feed')}</span>
            {entries.length === 0 ? <p className="m-0 text-sm text-muted italic">{t('tavern.quiet')}</p> : entries.map((e) => (
              <p key={e.id} className="m-0 text-[15px]" style={e.tier ? { color: `var(--color-tier-${e.tier})` } : undefined}>
                {text(e.text)}
              </p>
            ))}
          </section>
        </>
      )}

      {tab === 'rankings' && <Rankings />}
      {tab === 'hall' && <Hall entries={hall.data?.entries ?? null} />}
    </Building>
  );
}

/** The Hero's bounties: today's three and this week's one, with progress and rewards. */
function Bounties() {
  const { t } = useI18n();
  const now = useNow(60_000);
  const [data, setData] = useState<BountiesView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'noHero' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.bounties().then((b) => { setData(b); setState('ready'); }).catch((e) => {
      setState(e instanceof ApiRequestError && e.body?.error === 'no_hero' ? 'noHero' : 'failed');
    });
  }, []);
  if (state === 'noHero') return <p className="panel m-0 p-3.5 text-sm text-muted">{t('bounty.noHero')}</p>;
  if (!data) return null;
  const midnight = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
  const swap = async (id: string) => {
    setError(null);
    try {
      setData(await api.swapBounty(id));
    } catch (e) {
      setError(describeError(t, e));
    }
  };
  return (
    <section className="panel grid gap-3 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-head text-xl font-extrabold">{t('bounty.title')}</span>
        <span className="text-xs text-muted">{t('bounty.resets', { time: formatDuration(t, midnight - now) })}</span>
      </div>
      <p className="m-0 text-sm text-muted">{t('bounty.hint')}</p>
      {data.hunt && <HuntCard hunt={data.hunt} />}
      <span className="sub-heading">{t('bounty.daily')}</span>
      {data.daily.map((b) => <BountyCard key={b.id} bounty={b} onSwap={() => void swap(b.id)} />)}
      {data.weekly && (
        <>
          <span className="sub-heading">{t('bounty.weekly')}</span>
          <BountyCard bounty={data.weekly} onSwap={() => {}} />
        </>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}

/** The week's Hunt: everyone's kills against one kin, and who leads. */
function HuntCard({ hunt }: { hunt: HuntView }) {
  const { t } = useI18n();
  const text = useText();
  const now = useNow(60_000);
  return (
    <div className={`grid gap-1.5 rounded-[2px] border p-2.5 ${hunt.done ? 'border-tier-uncommon/60' : 'border-tier-epic/50'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-head text-lg font-extrabold ${hunt.done ? 'text-tier-uncommon' : 'text-tier-epic'}`}>{hunt.done ? '✓ ' : ''}{text(hunt.title)}</span>
        {!hunt.done && <span className="text-xs text-muted">{t('hunt.ends', { time: formatDuration(t, new Date(hunt.endsAt).getTime() - now) })}</span>}
      </div>
      <Meter label={t('hunt.server')} value={hunt.total} max={hunt.target} kind="stamina" />
      <span className="text-sm">{t('hunt.mine', { n: hunt.mine, min: hunt.min })}</span>
      {hunt.top.length > 0 && (
        <span className="text-sm text-muted">{t('hunt.top', { list: hunt.top.map((h) => `${h.hero} ${h.count}`).join(', ') })}</span>
      )}
      <span className="text-xs text-muted">{hunt.done ? t('hunt.done') : t('hunt.reward', { min: hunt.min })}</span>
    </div>
  );
}

function BountyCard({ bounty, onSwap }: { bounty: BountyView; onSwap: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  const item = bounty.reward.item;
  return (
    <div className={`grid gap-1.5 rounded-[2px] border p-2.5 ${bounty.done ? 'border-tier-uncommon/60' : 'border-bone/20'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`font-bold ${bounty.done ? 'text-tier-uncommon' : ''}`}>{bounty.done ? '✓ ' : ''}{text(bounty.title)}</span>
        {bounty.canSwap && <button type="button" className="chip shrink-0" onClick={onSwap}>{t('bounty.swap')}</button>}
      </div>
      {!bounty.done && bounty.target > 1 && <Meter label="" value={bounty.progress} max={bounty.target} kind="stamina" />}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[#f1c75b]">{t('bounty.reward', { n: bounty.reward.gold })}</span>
        {item && <ItemChip item={item} size={34} onClick={() => openSheet({ title: text(item.name), body: <ItemDetails item={item} /> })} />}
        {bounty.done && <span className="ml-auto font-head text-xs font-bold text-tier-uncommon">{t('bounty.done')}</span>}
      </div>
    </div>
  );
}

function SeasonCard({ season }: { season: SeasonView }) {
  const { t } = useI18n();
  const now = useNow(30_000);
  const until = (iso: string) => formatDuration(t, new Date(iso).getTime() - now);
  const gateOpen = season.bossGateAt !== null && new Date(season.bossGateAt).getTime() <= now;
  return (
    <section className="panel grid gap-1 p-3.5">
      <span className="font-head text-xl font-extrabold">{t('tavern.season', { n: season.number })} · {t(`season.${season.status}`)}</span>
      {season.status === 'planned' && <span className="text-sm text-muted">{t('tavern.notStarted')}</span>}
      {season.bossGateAt && (
        <span className="text-sm">{gateOpen ? t('tavern.gateOpen') : t('tavern.gateIn', { time: until(season.bossGateAt) })}</span>
      )}
      {season.weakening > 0 && <span className="text-sm text-[#ff9a8a]">{t('tavern.weakened', { n: Math.round(season.weakening * 100) })}</span>}
      {season.omen && <OmenNote omen={season.omen} />}
      {season.wipeAt && <span className="text-sm text-gold">{t('tavern.wipeIn', { time: until(season.wipeAt) })}</span>}
      {season.podium.map((p) => (
        <span key={p.place} className="font-head font-bold text-gold">{t(`tavern.place.${p.place as 1 | 2 | 3}`)}: {p.hero} ({p.player})</span>
      ))}
      <span className="text-xs text-muted">{t('tavern.relicsLeft', { n: season.relicsLeft })}</span>
    </section>
  );
}

const HALL_ORDER: HallEntry['kind'][] = ['champion', 'second', 'third', 'relic', 'best-drop', 'deepest', 'highest-level'];

function Hall({ entries }: { entries: HallEntry[] | null }) {
  const { t } = useI18n();
  const text = useText();
  if (!entries) return <p className="text-center text-muted">{t('loading')}</p>;
  if (entries.length === 0) return <p className="m-0 text-muted italic">{t('tavern.hallEmpty')}</p>;
  const seasons = [...new Set(entries.map((e) => e.season))];
  return (
    <div className="grid gap-3">
      {seasons.map((n) => (
        <section key={n} className="panel grid gap-1 p-3">
          <span className="sub-heading">{t('tavern.season', { n })}</span>
          {entries
            .filter((e) => e.season === n)
            .sort((a, b) => HALL_ORDER.indexOf(a.kind) - HALL_ORDER.indexOf(b.kind))
            .map((e, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span className="font-head font-bold">{t(`hall.${e.kind}`)}</span>
                <span className="truncate text-right">{e.hero} ({e.player}){e.detail ? ` · ${text(e.detail)}` : ''}</span>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
