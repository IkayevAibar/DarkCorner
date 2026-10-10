import { useState } from 'react';
import { RANKINGS, type Ranking, type RankingKind, type RankingRow, type RankingsView } from '@dark/shared';
import { api } from '../../api';
import { useText } from '../../components/items/text';
import { Token } from '../../components/Token';
import { useLoad, useRefresh } from '../../components/useLoad';
import { useI18n } from '../../i18n';

/** A ring for Players whose Hero has no banner on the podium (a Hero since retired). */
const PLAIN_RING = '#6b5a3e';

/**
 * The Tavern's Rankings: a board per record, with a podium for the first three,
 * the rest of the top ten under it, and the Player's own place when it is lower.
 */
export function Rankings() {
  const { t } = useI18n();
  const rankings = useLoad(api.rankings);
  useRefresh(rankings.reload, 60_000);
  if (!rankings.data) return <p className="text-center text-muted">{rankings.failed ? t('error') : t('loading')}</p>;
  return <RankingsBoard data={rankings.data} />;
}

export function RankingsBoard({ data }: { data: RankingsView }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<RankingKind>('deepest');
  const board = data.boards.find((b) => b.kind === kind)!;

  return (
    <section className="tavern-rankings">
      <div className="tavern-rank-tabs">
        {RANKINGS.map((k) => (
          <button
            key={k}
            type="button"
            className={`chip shrink-0 ${k === kind ? 'border-gold text-gold' : ''}`}
            aria-pressed={k === kind}
            onClick={() => setKind(k)}
          >
            {t(`rankings.${k}`)}
          </button>
        ))}
      </div>
      <p className="m-0 text-sm text-muted">{t(`rankings.${kind}.blurb`)}</p>
      {board.rows.length === 0 ? (
        <p className="panel m-0 p-4 text-center text-muted italic">{kind === 'dragon' ? t('rankings.dragon.empty') : t('rankings.empty')}</p>
      ) : (
        <Board board={board} />
      )}
    </section>
  );
}

function Board({ board }: { board: Ranking }) {
  const [first, second, third] = board.rows;
  const rest = board.rows.slice(3);
  return (
    <>
      {/* Second, first, third: the winner stands in the middle, and a tie stands as tall. */}
      <div className="tavern-podium">
        <Step row={second} kind={board.kind} />
        <Step row={first} kind={board.kind} />
        <Step row={third} kind={board.kind} />
      </div>
      {rest.length > 0 && (
        <ol className="panel m-0 grid list-none gap-0 p-0">
          {rest.map((row, i) => <Line key={i} row={row} kind={board.kind} />)}
        </ol>
      )}
      {board.me && (
        <ol className="m-0 grid list-none p-0">
          <Line row={board.me} kind={board.kind} />
        </ol>
      )}
    </>
  );
}

/** How a board's number reads: a Floor, a level, gold, a count, or the Item itself. */
function useValue() {
  const { t } = useI18n();
  const text = useText();
  return (row: RankingRow, kind: RankingKind) => {
    switch (kind) {
      case 'finest':
        return row.item && <span style={{ color: `var(--color-tier-${row.item.tier})` }}>{text(row.item.name)}</span>;
      case 'dragon':
        return t(`tavern.place.${Math.min(3, Math.max(1, row.value)) as 1 | 2 | 3}`);
      case 'richest':
        return t('hero.gold', { n: row.value.toLocaleString() });
      default:
        return t(`rankings.${kind}.value`, { n: row.value });
    }
  };
}

const STEP_HEIGHT: Record<number, number> = { 1: 88, 2: 64, 3: 48 };

/** One place on the podium: the Hero on top, its number on the step. */
function Step({ row, kind }: { row: RankingRow | undefined; kind: RankingKind }) {
  const { t } = useI18n();
  const value = useValue();
  const text = useText();
  const height = STEP_HEIGHT[row?.rank ?? 3] ?? STEP_HEIGHT[3]!;
  if (!row) {
    return (
      <div className="grid justify-items-center gap-1.5">
        <div className="grid w-full place-items-center rounded-t-[2px] border border-b-0 border-line/60 bg-panel-2/40 font-head text-xl text-muted/50" style={{ height }}>—</div>
      </div>
    );
  }
  const top = row.rank === 1;
  return (
    <div className={`tavern-podium-place ${top ? 'is-first' : ''}`}>
      <Token art={row.portraitUrl} label={row.hero} ring={row.banner ?? PLAIN_RING} size={top ? 68 : 56} />
      <div className="grid w-full min-w-0 gap-0">
        <span className={`font-head text-[15px] leading-tight font-extrabold ${row.me ? 'text-gold' : ''}`}>{row.hero}</span>
        {row.title && <span className="text-[11px] text-gold italic">{text(row.title)}</span>}
        <span className="text-xs text-muted">{row.me ? t('rankings.you') : row.player}</span>
        <span className="text-[13px] font-bold">{value(row, kind)}</span>
      </div>
      <div
        className={`tavern-podium-stone grid w-full place-items-center rounded-t-[2px] border border-b-0 font-head text-2xl font-extrabold ${
          top ? 'border-gold bg-[#3a2b14] text-gold' : 'border-brass-dim bg-panel-2 text-bone'
        }`}
        style={{ height }}
      >
        {row.rank}
      </div>
    </div>
  );
}

/** A place below the podium, or the Player's own further down. */
function Line({ row, kind }: { row: RankingRow; kind: RankingKind }) {
  const { t } = useI18n();
  const value = useValue();
  const text = useText();
  return (
    <li className={`flex items-center gap-3 border-b border-line/50 px-3 py-2 last:border-b-0 ${row.me ? 'rounded-[2px] border border-gold bg-[#2a2014]' : ''}`}>
      <span className="w-6 shrink-0 text-right font-head text-lg font-extrabold text-muted">{row.rank}</span>
      <Token art={row.portraitUrl} label={row.hero} ring={row.banner ?? PLAIN_RING} size={34} />
      <span className="grid min-w-0 flex-1">
        <span className={`font-head font-bold ${row.me ? 'text-gold' : ''}`}>{row.hero}</span>
        <span className="text-xs text-muted">
          {row.me ? t('rankings.you') : row.player}
          {row.title && <span className="text-gold italic"> · {text(row.title)}</span>}
        </span>
      </span>
      <span className="tavern-ranking-value">{value(row, kind)}</span>
    </li>
  );
}
