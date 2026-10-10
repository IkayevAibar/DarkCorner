import { useState } from 'react';
import type { BountiesView, BountyView, HuntView, LodgingView } from '@dark/shared';
import { api } from '../../api';
import { Loading } from '../../components/Building';
import { ItemTile } from '../../components/items/ItemTile';
import { ItemCard } from '../../components/items/ItemCard';
import { useText } from '../../components/items/text';
import { Meter } from '../../components/Meter';
import { useSheet } from '../../components/Sheet';
import { describeError } from '../../errors';
import { useLoad, useRefresh } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { formatClock, formatDuration, useNow } from '../../time';
import { Companion } from './Companion';
import { Rankings } from './Rankings';
import { TavernRoom } from './TavernRoom';
import { TavernMark, useTavernCopy } from './tavernArt';
import './tavern.css';

/** API ownership stays here; TavernRoom also renders the same views in the Sandbox. */
export function Tavern() {
  const tavern = useLoad(api.tavern), hall = useLoad(api.hall);
  useRefresh(tavern.reload, 25_000);
  if (!tavern.data) return <Loading failed={tavern.failed !== null} onRetry={() => void tavern.reload()} />;
  return <TavernRoom view={tavern.data} hall={hall.data?.entries ?? null}
    hallError={hall.failed !== null} onRetryHall={() => void hall.reload()}
    lodging={<Lodging />} bounties={<Bounties />} rankings={<Rankings />} companion={__SOLO__ ? <Companion /> : undefined} />;
}

/** Lodging: a bed upstairs for City gold, for full Stamina and the short rests back; each night costs more. */
function Lodging() {
  const { t } = useI18n();
  const { data, setData, failed, reload } = useLoad(api.lodging);
  const [error, setError] = useState<string | null>(null);
  const [slept, setSlept] = useState(false), [busy, setBusy] = useState(false);
  if (failed === 'no_hero') return <p className="tavern-empty">{t('city.noHero')}</p>;
  if (!data) return <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const sleep = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      setData(await api.takeLodging());
      setSlept(true);
      play('coins');
    } catch (e) {
      setError(describeError(t, e));
    } finally { setBusy(false); }
  };
  return <LodgingCard data={data} busy={busy} error={error} slept={slept} onSleep={() => void sleep()} />;
}

export function LodgingCard({ data, busy = false, error = null, slept = false, onSleep }: { data: LodgingView; busy?: boolean; error?: string | null; slept?: boolean; onSleep: () => void }) {
  const { t, locale } = useI18n(), copy = useTavernCopy();
  const full = data.stamina >= data.staminaMax && data.shortRests.left >= data.shortRests.of;
  // Solo: a night is also how the Day passes, so a rested Hero may still take one.
  const rested = full && !__SOLO__;
  const tomorrow = data.availableAt !== null, short = data.gold < data.price;
  return (
    <section className="tavern-lodging" data-lodging>
      <div className="tavern-stairs"><TavernMark kind="stairs" /><span>{copy.upstairs}</span></div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-head text-xl font-extrabold">{t('lodging.title')}</span>
        <span className="text-xs text-muted">{t('lodging.state', { s: data.stamina, max: data.staminaMax, l: data.shortRests.left, of: data.shortRests.of })}</span>
      </div>
      <p className="m-0 text-sm text-muted">{t('lodging.about')}</p>
      <button type="button" className="btn btn-primary" disabled={busy || !data.inCity || tomorrow || rested || short} onClick={onSleep}>
        {t('lodging.take', { n: data.price.toLocaleString() })}
      </button>
      <span className="text-xs text-muted">
        {!data.inCity ? t('lodging.inside')
          : tomorrow ? t('lodging.tomorrow', { time: formatClock(locale, data.availableAt!) })
          : rested ? t('lodging.rested')
          : short ? t('lodging.gold', { n: data.gold.toLocaleString() })
          : full ? t('lodging.nextDay')
          : t('lodging.rising')}
      </span>
      {slept && <p className="m-0 text-sm text-tier-uncommon">{t('lodging.done')}</p>}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}

/** The Hero's bounties: today's three and this week's one, with progress and rewards. */
function Bounties() {
  const { t } = useI18n();
  const { data, setData, failed, reload } = useLoad(api.bounties);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  if (failed === 'no_hero') return <p className="tavern-empty">{t('bounty.noHero')}</p>;
  if (!data) return <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const swap = async (id: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      setData(await api.swapBounty(id));
    } catch (e) {
      setError(describeError(t, e));
    } finally { setBusy(false); }
  };
  return <BountyBoard data={data} busy={busy} error={error} onSwap={id => void swap(id)} />;
}

export function BountyBoard({ data, busy = false, error = null, onSwap }: { data: BountiesView; busy?: boolean; error?: string | null; onSwap: (id: string) => void }) {
  const { t } = useI18n(), now = useNow(60_000);
  const midnight = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
  return (
    <section className="tavern-bounties" data-bounties>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-head text-xl font-extrabold">{t('bounty.title')}</span>
        <span className="text-xs text-muted">{t('bounty.resets', { time: formatDuration(t, midnight - now) })}</span>
      </div>
      <p className="m-0 text-sm text-muted">{t('bounty.hint')}</p>
      {data.hunt && <HuntCard hunt={data.hunt} />}
      <span className="sub-heading">{t('bounty.daily')}</span>
      {data.daily.map((b) => <BountyCard key={b.id} bounty={b} busy={busy} onSwap={() => onSwap(b.id)} />)}
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
  const text = useText(), copy = useTavernCopy();
  const now = useNow(60_000);
  return (
    <div className={`tavern-hunt ${hunt.done ? 'is-done' : ''}`}><div className="tavern-wanted"><TavernMark kind="hunt" />{copy.wanted}</div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-head text-lg font-extrabold ${hunt.done ? 'text-tier-uncommon' : 'text-tier-epic'}`}>{hunt.done ? '✓ ' : ''}{text(hunt.title)}</span>
        {!hunt.done && <span className="text-xs text-muted">{t('hunt.ends', { time: formatDuration(t, new Date(hunt.endsAt).getTime() - now) })}</span>}
      </div>
      <Meter label={t('hunt.server')} value={hunt.total} max={hunt.target} kind="stamina" />
      {/* Solo, the bar is the Hero's own kills: no one else's count, and no one to lead. */}
      {!__SOLO__ && <span className="text-sm">{t('hunt.mine', { n: hunt.mine, min: hunt.min })}</span>}
      {!__SOLO__ && hunt.top.length > 0 && (
        <span className="text-sm text-muted">{t('hunt.top', { list: hunt.top.map((h) => `${h.hero} ${h.count}`).join(', ') })}</span>
      )}
      <span className="text-xs text-muted">{hunt.done ? t('hunt.done') : t('hunt.reward', { min: hunt.min })}</span>
    </div>
  );
}

function BountyCard({ bounty, busy = false, onSwap }: { bounty: BountyView; busy?: boolean; onSwap: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  const item = bounty.reward.item;
  return (
    <div className={`tavern-bounty ${bounty.done ? 'is-done' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`font-bold ${bounty.done ? 'text-tier-uncommon' : ''}`}>{bounty.done ? '✓ ' : ''}{text(bounty.title)}</span>
        {bounty.canSwap && <button type="button" className="chip shrink-0" disabled={busy} onClick={onSwap}>{t('bounty.swap')}</button>}
      </div>
      {!bounty.done && bounty.target > 1 && <Meter label="" value={bounty.progress} max={bounty.target} kind="stamina" />}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[#f1c75b]">{t('bounty.reward', { n: bounty.reward.gold })}</span>
        {item && <ItemTile item={item} size={34} onClick={() => openSheet({ title: text(item.name), body: <ItemCard item={item} /> })} />}
        {bounty.done && <span className="ml-auto font-head text-xs font-bold text-tier-uncommon">{t('bounty.done')}</span>}
      </div>
    </div>
  );
}
