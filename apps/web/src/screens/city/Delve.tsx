import { useEffect, useState } from 'react';
import type { BoonId, DelveResult, DelveRow, DelveRun, DelveView, FightReplay, LocalizedText, Stance } from '@dark/shared';
import { api } from '../../api';
import { Building, Loading } from '../../components/Building';
import { EliteBadge } from '../../components/EliteBadge';
import { FightScene, preloadFightScene } from '../../components/fight/FightScene';
import { useText } from '../../components/items/text';
import { useSheet } from '../../components/Sheet';
import { ThreatChip } from '../../components/ThreatChip';
import { BOSS_RING, MONSTER_RING, Token } from '../../components/Token';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { formatDuration, useNow } from '../../time';
import { FightLog } from '../labyrinth/FightLog';
import { NeedHero } from './NeedHero';

const STANCE_ORDER: Stance[] = ['bold', 'steady', 'wary'];

/**
 * The Well: the Daily Delve (docs/design.md → The Daily Delve). Six Rooms a day,
 * the same for everyone, a Boon between them, and a board for who went deepest.
 */
export function Delve() {
  const { t } = useI18n();
  const { data, setData, failed, reload } = useLoad(api.delve);
  const { busy, error, run } = useAction();
  const [playing, setPlaying] = useState<DelveResult | null>(null);
  const [shown, setShown] = useState<DelveResult | null>(null);
  useEffect(() => { void preloadFightScene().catch(() => { /* Playback retries or shows its fallback. */ }); }, []);

  if (!data) return failed === 'no_hero' ? <NeedHero /> : <Loading failed={failed !== null} onRetry={() => void reload()} />;
  const view = data.view;

  const act = (call: () => Promise<DelveResult>) => void run(async () => {
    const next = await call();
    if (next.fight) setPlaying(next);
    else {
      setData(next);
      setShown(next);
    }
  });

  return (
    <Building title={t('delve.title')} blurb={t('delve.blurb')} hero={null}>
      {view.prize && <PrizeCard view={view} busy={busy} onClaim={() => act(api.delveClaim)} />}
      {shown && (shown.notices.length > 0 || shown.loot.length > 0) && <Notices result={shown} />}
      <TodayCard view={view} busy={busy} act={act} onStance={(s) => void run(async () => {
        await api.setStance(s);
        setData(await api.delve());
      })} />
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      <Board title={t('delve.board')} rows={view.board} empty={t('delve.boardEmpty')} />
      {view.yesterday.length > 0 && <Board title={t('delve.yesterday')} rows={view.yesterday} />}
      {playing?.fight && (
        <FightScene
          replay={playing.fight}
          onDone={() => {
            play(playing.fight!.outcome === 'victory' ? 'reveal' : 'door', { rate: 0.8 });
            setData(playing);
            setShown(playing);
            setPlaying(null);
          }}
        />
      )}
    </Building>
  );
}

function Notices({ result }: { result: DelveResult }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet } = useSheet();
  return (
    <div className="panel grid gap-1.5 p-3">
      {result.notices.map((n: LocalizedText, i) => <p key={i} className="m-0 text-[15px]">{text(n)}</p>)}
      {result.loot.map((item) => <p key={item.id} className="m-0 text-[15px] text-gold">{t('delve.received', { item: text(item.name) })}</p>)}
      {result.fight && (
        <button type="button" className="btn btn-small w-fit" onClick={() => openSheet({ title: t('report.fightLog'), body: <FightLog replay={result.fight as FightReplay} /> })}>
          {t('report.fightLog')}
        </button>
      )}
    </div>
  );
}

function PrizeCard({ view, busy, onClaim }: { view: DelveView; busy: boolean; onClaim: () => void }) {
  const { t } = useI18n();
  const prize = view.prize!;
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 border-gold p-3">
      <span className="text-[15px]">{t('delve.prize', { place: prize.place, chest: t(`delve.chest.${prize.chest}`) })}</span>
      <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={onClaim}>{t('delve.claim')}</button>
    </div>
  );
}

/** Today's Delve: the rules and the way down, the Rooms under way, or how it ended. */
function TodayCard({ view, busy, act, onStance }: {
  view: DelveView; busy: boolean; act: (call: () => Promise<DelveResult>) => void; onStance: (s: Stance) => void;
}) {
  const { t } = useI18n();
  const now = useNow(30_000);
  const closes = formatDuration(t, new Date(view.closesAt).getTime() - now);
  const run = view.run;
  return (
    <section className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="sub-heading">{t('delve.today')}</span>
        <span className="text-xs text-muted">{t('delve.closes', { time: closes })}</span>
      </div>
      {!run ? (
        <div className="panel grid gap-3 p-3">
          <p className="m-0 text-[15px]">{t('delve.start.floor', { floor: view.floor, deepest: Math.min(10, view.floor + 2), rooms: view.rooms })}</p>
          <ul className="m-0 grid list-disc gap-1 pl-5 text-sm marker:text-brass">
            <li>{t('delve.rule.safe')}</li>
            <li>{t('delve.rule.boons')}</li>
            <li>{t('delve.rule.score')}</li>
            <li>{t('delve.rule.fall')}</li>
            <li>{t('delve.rule.prizes')}</li>
          </ul>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(api.delveStart)}>{t('delve.descend')}</button>
        </div>
      ) : run.end ? (
        <Ended run={run} rooms={view.rooms} />
      ) : (
        <UnderWay view={view} run={run} busy={busy} act={act} onStance={onStance} />
      )}
    </section>
  );
}

function Track({ run, rooms }: { run: DelveRun; rooms: number }) {
  const { t } = useI18n();
  return (
    <ol className="m-0 flex list-none items-center gap-1.5 p-0" aria-label={t('delve.progress', { n: run.rooms, of: rooms })}>
      {Array.from({ length: rooms }, (_, i) => {
        const won = i < run.rooms;
        const next = i === run.rooms && run.end === null;
        const last = i === rooms - 1;
        return (
          <li
            key={i}
            className={`grid size-7 place-items-center rounded-full border font-head text-xs font-extrabold ${
              won ? 'border-gold bg-[rgb(224_184_106/0.2)] text-gold' : next ? 'border-bone text-bone' : 'border-line text-muted'
            } ${last ? 'rounded-[4px]' : ''}`}
          >
            {won ? '✓' : last ? '☠' : i + 1}
          </li>
        );
      })}
    </ol>
  );
}

function Health({ run }: { run: DelveRun }) {
  const { t } = useI18n();
  const share = Math.max(0, Math.min(1, run.hp / run.maxHp));
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-sm">
        <span>{t('delve.hp', { hp: run.hp, max: run.maxHp })}</span>
        <span className="text-muted">{t('delve.potions', { n: run.potions })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/60">
        <div className="h-full rounded-full bg-[#a33a2e]" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

function UnderWay({ view, run, busy, act, onStance }: {
  view: DelveView; run: DelveRun; busy: boolean; act: (call: () => Promise<DelveResult>) => void; onStance: (s: Stance) => void;
}) {
  const { t } = useI18n();
  const text = useText();
  const next = run.next!;
  const threat = next.facing.threat[view.stance];
  const fight = (boon: BoonId | null) => {
    play('door', { rate: 0.7 });
    act(() => api.delveFight(boon));
  };
  return (
    <div className="panel grid gap-3 p-3">
      <Track run={run} rooms={view.rooms} />
      <Health run={run} />
      {run.boons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {run.boons.map((b, i) => <span key={i} className="chip text-xs" title={text(b.about)}>{text(b.name)}</span>)}
        </div>
      )}

      <div className="grid gap-2 border-t border-line/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-head text-lg font-extrabold">
            {t(next.facing.kind === 'miniboss' ? 'delve.guardian' : 'delve.room', { n: next.room, of: view.rooms, floor: next.floor })}
          </span>
          <ThreatChip threat={threat} />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {next.facing.monsters.map((m) => (
            <div key={m.key} className="grid w-[84px] content-start justify-items-center gap-1">
              <Token art={m.art} label={text(m.name)} ring={m.boss ? BOSS_RING : MONSTER_RING} size={m.boss ? 72 : 60} />
              <span className="line-clamp-2 max-w-full text-center font-head text-xs leading-tight font-bold">{text(m.name)}</span>
              {m.elite && <EliteBadge elite={m.elite} />}
            </div>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">{t(`threat.${threat}.hint`)}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {STANCE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-small grid gap-0.5 ${s === view.stance ? 'btn-primary' : ''}`}
              disabled={busy}
              aria-pressed={s === view.stance}
              onClick={() => s !== view.stance && onStance(s)}
            >
              <span>{t(`stance.${s}`)}</span>
              <span className="text-[11px] font-normal opacity-80">{t(`threat.${next.facing.threat[s]}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {run.offer ? (
        <div className="grid gap-2">
          <span className="sub-heading">{t('delve.pick')}</span>
          {run.offer.map((b) => (
            <button key={b.id} type="button" className="btn grid gap-0.5 text-left font-body font-normal" disabled={busy} onClick={() => fight(b.id)}>
              <span className="font-head text-base font-extrabold text-bone">{text(b.name)}</span>
              <span className="text-sm text-muted">{text(b.about)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fight(null)}>{t('delve.fight')}</button>
      )}
      {run.rooms > 0 && (
        <button type="button" className="btn" disabled={busy} onClick={() => act(api.delveStop)}>
          {t('delve.stop', { score: run.score, gold: run.gold })}
        </button>
      )}
    </div>
  );
}

function Ended({ run, rooms }: { run: DelveRun; rooms: number }) {
  const { t } = useI18n();
  return (
    <div className="panel grid gap-2 p-3">
      <Track run={run} rooms={rooms} />
      <p className="m-0 font-head text-lg font-extrabold">{t(`delve.end.${run.end!}`, { n: run.rooms })}</p>
      <p className="m-0 text-[15px]">{t('delve.result', { score: run.score, gold: run.gold })}</p>
      <p className="m-0 text-sm text-muted">{t('delve.tomorrow')}</p>
    </div>
  );
}

function Board({ title, rows, empty }: { title: string; rows: DelveRow[]; empty?: string }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <section className="grid gap-2">
      <span className="sub-heading">{title}</span>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="m-0 grid list-none gap-1.5 p-0">
          {rows.map((r) => (
            <li key={`${r.place}-${r.hero}`} className={`panel flex items-center gap-2.5 p-2 ${r.mine ? 'border-gold' : ''}`}>
              <span className={`w-6 text-center font-head text-lg font-extrabold ${r.place <= 3 ? 'text-gold' : 'text-muted'}`}>{r.place}</span>
              <Token art={r.portraitUrl} label={r.hero} ring={r.banner} size={36} />
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-head font-bold">
                  {r.hero}{r.title && <span className="font-normal text-muted"> · {text(r.title)}</span>}
                </span>
                <span className="text-xs text-muted">{t('delve.row', { level: r.level, cls: t(`class.${r.class}`), rooms: r.rooms, floor: r.floor })}</span>
              </div>
              <span className="font-head text-lg font-extrabold tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
