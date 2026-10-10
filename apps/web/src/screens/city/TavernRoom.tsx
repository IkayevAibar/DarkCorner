import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { TavernView, HallEntry, SeasonView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { Token } from '../../components/Token';
import { OmenNote } from '../../components/OmenNote';
import { useText } from '../../components/items/text';
import { formatClock, formatDuration, useNow } from '../../time';
import { TavernMark, feedSymbol, useTavernCopy } from './tavernArt';
import './tavern.css';

type Tab = 'feed' | 'rankings' | 'hall';
export function TavernRoom({ view, hall, lodging, bounties, rankings, initialTab = 'feed', hallError = false, onRetryHall }: {
  view: TavernView; hall: HallEntry[] | null; lodging: ReactNode; bounties: ReactNode; rankings: ReactNode;
  initialTab?: Tab; hallError?: boolean; onRetryHall?: () => void;
}) {
  const { t } = useI18n(), copy = useTavernCopy();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [servicesOpen] = useState(() => matchMedia('(min-width:700px)').matches);
  return <section className="tavern-room" data-tavern>
    <NavLink to="/city" className="tavern-back">← {t('tab.city')}</NavLink>
    <header className="tavern-hearth">
      <img src="/art/city/tavern-interior.webp" alt="" width="1200" height="800" fetchPriority="low" />
      <div><span><TavernMark kind="fire" />{copy.hearth}</span><h1>{t('city.tavern')}</h1></div>
    </header>
    <SeasonNotice season={view.season} />
    <nav className="tavern-tabs" aria-label={t('city.tavern')}>
      {/* Solo, Rankings are the Player's own Records: its best Hero of the Chapter on each. */}
      {(['feed', 'rankings', 'hall'] as const).map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} data-tavern-tab={key}>
        <TavernMark kind={key === 'feed' ? 'notice' : key === 'rankings' ? 'crown' : 'stone'} /><span>{t(`tavern.${key}`)}</span>
      </button>)}
    </nav>
    {tab === 'feed' && <>
      {!__SOLO__ && <Patrons online={view.online} />}
      <div className="tavern-columns"><aside className="tavern-services">
        <details open={servicesOpen}><summary><TavernMark kind="stairs" />{t('lodging.title')}</summary>{lodging}</details>
        <details open={servicesOpen}><summary><TavernMark kind="hunt" />{t('bounty.title')}</summary>{bounties}</details>
      </aside><Feed entries={view.entries} /></div>
    </>}
    {tab === 'rankings' && rankings}
    {tab === 'hall' && (hallError ? <div className="tavern-empty"><p>{t('error')}</p><button className="btn" onClick={onRetryHall}>{t('retry')}</button></div> : <Hall entries={hall} />)}
  </section>;
}

function Patrons({ online }: { online: TavernView['online'] }) {
  const { t } = useI18n(), text = useText(), copy = useTavernCopy();
  return <section className="tavern-patrons"><h2>{t('tavern.online', { n: online.length })}</h2>
    {online.length === 0 ? <div className="tavern-empty"><TavernMark kind="fire" /><p>{t('tavern.nobody')}<small>{copy.quiet}</small></p></div>
      : <ul>{online.map(o => <li key={o.name}>
        <div className="tavern-face"><Token art={o.portraitUrl} ring={o.banner ?? '#64533f'} label={o.hero ?? o.name} size={54} />
          {o.level !== null && <span aria-label={t('hero.level', { n: o.level })}>{o.level}</span>}</div>
        <div><strong>{o.hero ?? o.name}</strong>{o.title && <em>{text(o.title)}</em>}
          <small>{o.hero ? o.name : copy.making}</small><span>{text(o.where)}</span></div>
      </li>)}</ul>}
  </section>;
}

function Feed({ entries }: { entries: TavernView['entries'] }) {
  const { t, locale } = useI18n(), text = useText(), copy = useTavernCopy();
  return <section className="tavern-feed"><header><TavernMark kind="notice" /><div><span>{copy.board}</span><h2>{t('tavern.feed')}</h2></div></header>
    {entries.length === 0 ? <div className="tavern-empty"><TavernMark kind="notice" /><p>{t('tavern.quiet')}</p></div> : <ol>
      {entries.map(e => <li key={e.id} data-feed-kind={e.kind} className={`feed-${e.kind} ${e.tier ? `feed-${e.tier}` : ''}`} style={e.tier ? { '--entry-ink': `var(--color-tier-${e.tier})` } as React.CSSProperties : undefined}>
        <TavernMark kind={feedSymbol(e.kind)} /><div>{e.kind === 'announcement' && <strong className="tavern-notice-label">{copy.notice}</strong>}<p>{text(e.text)}</p>
          <time dateTime={e.at} title={new Date(e.at).toLocaleString(locale)}>{formatClock(locale, e.at, t)}</time></div>
      </li>)}
    </ol>}
  </section>;
}

function SeasonNotice({ season }: { season: SeasonView }) {
  const { t } = useI18n(), now = useNow(30_000);
  const until = (iso: string) => formatDuration(t, Date.parse(iso) - now);
  const gateOpen = season.bossGateAt !== null && Date.parse(season.bossGateAt) <= now;
  return <section className={`tavern-season ${season.status === 'finale' ? 'is-finale' : ''}`}>
    <div className="season-name"><TavernMark kind={season.status === 'finale' ? 'crown' : 'notice'} /><div><h2>{t('tavern.season', { n: season.number })}</h2><span>{__SOLO__ && season.podium.length > 0 ? t('chapter.complete') : t(`season.${season.status}`)}</span></div></div>
    <div className="season-notice">
      {season.status === 'planned' && <p>{t('tavern.notStarted')}</p>}
      {season.wipeAt && <strong className="season-countdown">{t('tavern.wipeIn', { time: until(season.wipeAt) })}</strong>}
      {season.bossGateAt && <p className={!season.wipeAt ? 'season-countdown' : ''}>{gateOpen ? t('tavern.gateOpen') : t('tavern.gateIn', { time: until(season.bossGateAt) })}</p>}
      {season.weakening > 0 && <span className="season-weakening">{t('tavern.weakened', { n: Math.round(season.weakening * 100) })}</span>}
      {season.omen && <OmenNote omen={season.omen} />}
      <small>{t('tavern.relicsLeft', { n: season.relicsLeft })}</small>
    </div>
    {season.podium.length > 0 && <ol className="season-podium">{[...season.podium].sort((a,b) => a.place-b.place).map(p => <li key={p.place}>
      <span>{t(`tavern.place.${p.place as 1 | 2 | 3}`)}</span><strong>{p.hero}</strong>{!__SOLO__ && <small>{p.player}</small>}
    </li>)}</ol>}
  </section>;
}

const HALL_ORDER: HallEntry['kind'][] = ['champion', 'second', 'third', 'relic', 'best-drop', 'deepest', 'highest-level'];
export function Hall({ entries }: { entries: HallEntry[] | null }) {
  const { t } = useI18n(), text = useText(), copy = useTavernCopy();
  if (!entries) return <p role="status">{t('loading')}</p>;
  const seasons = [...new Set(entries.map(e => e.season))].sort((a,b) => b-a);
  return <section className="tavern-hall" data-hall><header><TavernMark kind="stone" /><span>{copy.stone}</span><h2>{t('tavern.hall')}</h2><p>{copy.hall}</p></header>
    {entries.length === 0 && <p className="tavern-empty">{t('tavern.hallEmpty')}</p>}
    {seasons.map(season => <article className="hall-slab" key={season}>
      <h3><span>{copy.chronicle}</span>{t('tavern.season', { n: season })}</h3>
      {entries.filter(e => e.season === season).sort((a,b) => HALL_ORDER.indexOf(a.kind)-HALL_ORDER.indexOf(b.kind)).map((e,i) => <div className={`hall-record hall-${e.kind}`} key={i}>
        {e.kind === 'champion' && <TavernMark kind="crown" />}
        <span className="hall-kind">{t(`hall.${e.kind}`)}</span><div><strong>{e.hero}</strong>{!__SOLO__ && <small>{e.player}</small>}{e.detail && <p>{text(e.detail)}</p>}</div>
      </div>)}
    </article>)}
  </section>;
}
