import type { LabyrinthResult, LabyrinthView } from '@dark/shared';

type Moment = 'oath' | 'chest' | 'fight' | 'ending';
export interface ResultScene {
  id: number;
  kind: Moment;
  remaining: Moment[];
  result: LabyrinthResult;
  /** The last visible Room and Duo, even if this result already moved or ended it. */
  before: LabyrinthView | null;
}
export interface ResultPresentation {
  revision: number;
  view: LabyrinthView | null;
  scene: ResultScene | null;
  report: LabyrinthResult | null;
  waiting: LabyrinthResult[];
}
export const initialPresentation: ResultPresentation = { revision: 0, view: null, scene: null, report: null, waiting: [] };
type Action = { type: 'receive'; result: LabyrinthResult; clearReport?: boolean }
  | { type: 'finish'; scene: ResultScene }
  | { type: 'dismiss' };

/** Keep each one-shot result intact until all its pictures have played, then its report. */
export function resultPresentation(state: ResultPresentation, action: Action): ResultPresentation {
  if (action.type === 'dismiss') return { ...state, report: null };
  if (action.type === 'receive') {
    return drain({ ...state, report: action.clearReport ? null : state.report, waiting: [...state.waiting, action.result] });
  }
  // A double tap or a timer from the previous picture cannot skip the next one.
  if (state.scene !== action.scene) return state;
  const { result, remaining } = action.scene;
  if (remaining.length) return { ...state, scene: { ...action.scene, kind: remaining[0]!, remaining: remaining.slice(1) } };
  return drain({ ...state, scene: null, view: result.view, report: addReport(state.report, result) });
}

function drain(state: ResultPresentation): ResultPresentation {
  while (!state.scene && state.waiting.length) {
    const result = state.waiting[0]!;
    const moments: Moment[] = [];
    if (result.oath) moments.push('oath');
    if (result.closedChest) moments.push('chest');
    if (result.fight) moments.push(state.view?.fight ? 'ending' : 'fight');
    state = { ...state, waiting: state.waiting.slice(1) };
    if (moments.length) {
      state = { ...state, revision: state.revision + 1, view: state.view ?? result.view, scene: { id: state.revision + 1, kind: moments[0]!, remaining: moments.slice(1), result, before: state.view } };
    } else {
      state = { ...state, view: result.view, report: addReport(state.report, result) };
    }
  }
  return state;
}

function addReport(open: LabyrinthResult | null, result: LabyrinthResult): LabyrinthResult | null {
  return hasNews(result) ? open ? joinReports(open, result) : result : open;
}
const hasNews = (r: LabyrinthResult) =>
  r.fight !== null || r.loot.length > 0 || r.gold > 0 || r.xp > 0 || r.levelUp !== null || r.died || r.notices.length > 0
  || r.checks.length > 0 || r.duel !== null || r.run !== null || r.deeds.length > 0 || r.oath !== null || r.closedChest !== null;

/** Reports preserve all rewards and words; only the newest view wins. */
function joinReports(a: LabyrinthResult, b: LabyrinthResult): LabyrinthResult {
  return { view: b.view, fight: b.fight ?? a.fight, loot: [...a.loot, ...b.loot], gold: a.gold + b.gold,
    xp: a.xp + b.xp, levelUp: b.levelUp ?? a.levelUp, died: a.died || b.died, notices: [...a.notices, ...b.notices],
    checks: [...a.checks, ...b.checks], duel: b.duel ?? a.duel, run: b.run ?? a.run, deeds: [...a.deeds, ...b.deeds],
    oath: b.oath ?? a.oath, closedChest: b.closedChest ?? a.closedChest };
}
