import { useEffect, useRef, useState } from 'react';
import type { FightReplay, HeroActionKind, HeroActionView, TurnOptionsView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { LiveFightScene } from '../../components/fight/LiveFightScene';
import { endedBoard, type BoardFight } from '../../components/fight/live';
import { framesFor } from '../../components/fight/replay';
import { FightLog } from '../labyrinth/FightLog';
import { REAL_FIGHTS } from './fightExamples';

const TEXT = {
  en: { title: 'Manual fights', note: 'Preview: choices reveal the next recorded turn; they never reroll the fight.', partner: 'Partner chooses (preview)', restart: 'Restart', done: 'Report' },
  ru: { title: 'Бой по ходам', note: 'Пример: выбор показывает следующий записанный ход, не меняя броски.', partner: 'Выбор напарника (пример)', restart: 'Сначала', done: 'Отчёт' },
};
const EXAMPLES = ['wizard-burst', 'cleric-heals', 'barbarian-rage', 'ranger-mark-moves', ...Object.keys(REAL_FIGHTS).filter(key => key.startsWith('duo-'))];
function stops(replay: FightReplay) {
  return replay.events.flatMap((e, i) => {
    const actor = 'actor' in e ? e.actor ?? 'hero' : '';
    return (actor === 'hero' || actor === 'ally') && (['attack', 'heal', 'revive'].includes(e.type) || e.type === 'feature' && ['rage', 'mark', 'help', 'guard', 'dodge'].includes(e.feature)) ? [i] : [];
  });
}
export function previewBoard(replay: FightReplay, n: number): BoardFight {
  if (n >= replay.events.length) return endedBoard(replay);
  const frame = framesFor(replay)[n]!, event = replay.events[n];
  const actor = event && 'actor' in event ? event.actor ?? 'hero' : 'hero';
  const who = actor === 'ally' ? replay.ally! : replay.hero;
  const targetKeys = replay.monsters.filter(m => !frame.fighters[m.key]!.fallen && !frame.fighters[m.key]!.fled).map(m => m.key);
  const actions: HeroActionKind[] = ['attack', 'potion', 'dodge'];
  if (!replay.ally) actions.push('escape');
  else { actions.push('help', 'guard'); if (frame.fighters[actor === 'ally' ? 'hero' : 'ally']!.fallen) actions.push('revive'); }
  if (who.class === 'wizard') actions.push('burst');
  if (who.class === 'cleric') actions.push('cure');
  if (who.class === 'fighter') actions.push('second-wind');
  const turn: TurnOptionsView = { hero: actor === 'ally' ? 'ally' : 'hero', round: 1 + Math.floor(n / 8), continuing: false,
    actions, targets: targetKeys, cure: replay.ally ? ['hero', 'ally'] : ['hero'],
    rage: who.class === 'barbarian' && !frame.fighters[actor]!.raging,
    mark: who.class === 'ranger', attacks: 1, spells: 2, heals: 2, potions: 3 };
  return { ...replay, events: replay.events.slice(0, n), outcome: null, turn, mine: actor === 'hero', auto: false,
    deadline: replay.ally ? new Date(Date.now() + 30_000).toISOString() : null };
}
export function TurnPreview() {
  const { locale } = useI18n(), text = TEXT[locale];
  const [id, setId] = useState(EXAMPLES[0]!), [run, setRun] = useState(0);
  return <section className="grid gap-3" data-turn-preview>
    <h2 className="sub-heading m-0">{text.title}</h2><p className="m-0 text-sm text-muted">{text.note}</p>
    <label className="grid gap-1">{text.title}<select data-turn-fixture className="input" value={id} onChange={e => setId(e.target.value)}>{EXAMPLES.map(name => <option key={name}>{name}</option>)}</select></label>
    <button className="btn btn-small" type="button" onClick={() => setRun(n => n + 1)}>{text.restart}</button>
    <RecordedTurns key={`${id}:${run}`} replay={REAL_FIGHTS[id]!} />
  </section>;
}
function RecordedTurns({ replay }: { replay: FightReplay }) {
  const { locale } = useI18n(), text = TEXT[locale], points = stops(replay);
  const [fight, setFight] = useState(() => previewBoard(replay, points[0] ?? 0));
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [choice, setChoice] = useState<HeroActionView | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const next = () => setFight(previous => previewBoard(replay, points.find(n => n > previous.events.length) ?? replay.events.length));
  const choose = (action: HeroActionView) => {
    setChoice(action); setBusy(true);
    timer.current = window.setTimeout(() => { if (action.kind === 'auto') setFight(endedBoard(replay)); else next(); setBusy(false); }, 650);
  };
  return <div data-turn-choice={JSON.stringify(choice)}>
    {done ? <details className="panel p-3" open data-turn-report><summary>{text.done}</summary><FightLog replay={replay} /></details>
      : <LiveFightScene fight={fight} at={undefined} busy={busy} onChoose={choose} onDone={() => setDone(true)} />}
    {!fight.mine && !fight.outcome && <button type="button" className="btn mt-2" data-partner-choose disabled={busy} onClick={next}>{text.partner}</button>}
  </div>;
}
