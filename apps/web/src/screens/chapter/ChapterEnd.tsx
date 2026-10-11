import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api';
import { Loading } from '../../components/Building';
import { Token } from '../../components/Token';
import { useText } from '../../components/items/text';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { Hall } from '../city/TavernRoom';
import './chapter.css';

/** The Chapter in numbers, in the order the screen shows them. */
const NUMBERS = [
  'days', 'heroes', 'deepest', 'level', 'minibosses', 'rooms', 'banked', 'hoards', 'legendary', 'relics', 'deeds', 'deaths',
] as const;

/**
 * Solo: the Chapter's end (docs/design.md → The solo game → Chapters). Once the Dragon has
 * fallen it comes up by itself, once; after that the City and the Tavern lead back to it.
 * Before the fall it tells the Chapter so far.
 */
export function ChapterEnd() {
  const { t, locale } = useI18n();
  const text = useText();
  const navigate = useNavigate();
  const { data, failed, reload } = useLoad(api.chapter);
  // Seen once, it no longer comes up by itself.
  const unseen = data?.complete === true && !data.seen;
  useEffect(() => {
    if (unseen) void api.chapterSeen().catch(() => undefined);
  }, [unseen]);
  if (!data) return <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const { end, tally } = data;

  return (
    <section className="chapter-end" data-complete={end ? '' : undefined}>
      <header className="chapter-end-head">
        <img className="chapter-end-dragon" src="/art/tokens/dragon.webp" alt="" width="512" height="512" />
        <span className="chapter-end-kicker">{t('tavern.season', { n: data.number })}</span>
        <h1>{end ? t('chapterEnd.fallen') : t('chapterEnd.goesOn')}</h1>
        <p>{end
          ? t('chapterEnd.story', { day: end.day, hero: end.hero.name, level: end.level, cls: t(`class.${end.hero.class}`) })
          : t('chapterEnd.waiting', { day: data.day })}</p>
        {end && <p className="chapter-end-tries">{end.gateDay === null ? t('chapterEnd.triesOnly', { n: end.tries }) : t('chapterEnd.tries', { n: end.tries, gate: end.gateDay })}</p>}
      </header>

      {end && (
        <section className="chapter-end-champion">
          <Token art={end.hero.portraitUrl} label={end.hero.name} ring={end.hero.banner} size={84} />
          <div>
            <span className="chapter-end-label">{t('chapterEnd.champion')}</span>
            <strong>{end.hero.name}</strong>
            {end.hero.title && <em>{text(end.hero.title)}</em>}
            <small>{t('duo.partnerLine', { level: end.level, cls: t(`class.${end.hero.class}`) })}</small>
          </div>
        </section>
      )}

      <section className="chapter-end-numbers">
        <span className="sub-heading">{t(end ? 'chapterEnd.numbers' : 'chapterEnd.numbersSoFar')}</span>
        <dl>
          {NUMBERS.map((key) => (
            <div key={key}>
              <dt>{t(`chapterEnd.${key}` as MessageKey)}</dt>
              <dd>{tally[key].toLocaleString(locale)}</dd>
            </div>
          ))}
        </dl>
        {tally.finest && (
          <p className="chapter-end-finest">
            {t('chapterEnd.finest')}:{' '}
            <span style={{ color: `var(--color-tier-${tally.finest.tier})` }}>
              {text(tally.finest.name)}{tally.finest.upgrade > 0 ? ` +${tally.finest.upgrade}` : ''}
            </span>
          </p>
        )}
      </section>

      {data.hall.length > 0 && <Hall entries={data.hall} />}

      <section className="chapter-end-next">
        <span className="sub-heading">{t('chapterEnd.next')}</span>
        <p>{end ? t('chapterEnd.world') : t('chapterEnd.worldSoFar')}</p>
        {end && <p className="text-muted">{t('chapterEnd.chapter2')}</p>}
        <button type="button" className="btn btn-primary" onClick={() => navigate(end ? '/city' : '/labyrinth')}>
          {end ? t('chapterEnd.keepPlaying') : t('chapterEnd.toLabyrinth')}
        </button>
      </section>
    </section>
  );
}
