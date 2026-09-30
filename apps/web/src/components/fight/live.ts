import type { FightEventView, FightReplay, LiveFight } from '@dark/shared';
import { advance, initialFrame, type Frame } from './replay';

export type BoardFight = Omit<LiveFight, 'turn'> & { turn: LiveFight['turn'] | null; outcome: FightReplay['outcome'] | null };
export const liveBoard = (live: LiveFight): BoardFight => ({ ...live, outcome: null });
export const endedBoard = (replay: FightReplay): BoardFight => ({ ...replay, turn: null, mine: false, deadline: null, auto: true });
export const asReplay = (fight: BoardFight): FightReplay => ({ ...fight, outcome: fight.outcome ?? 'victory' });

export interface Timeline { events: FightEventView[]; frames: Frame[] }
export function startTimeline(fight: BoardFight): Timeline {
  return appendTimeline({ events: [], frames: [initialFrame(asReplay(fight))] }, fight.events);
}
/** Polling replaces JSON objects. Keep accepted events/frames stable so an in-flight cue never restarts. */
export function appendTimeline(timeline: Timeline, incoming: FightEventView[]): Timeline {
  if (incoming.length <= timeline.events.length) return timeline;
  const events = [...timeline.events], frames = [...timeline.frames];
  for (const event of incoming.slice(events.length)) {
    events.push(event);
    frames.push(advance(frames[frames.length - 1]!, event));
  }
  return { events, frames };
}

/** Initial combatants are stable across polls and the final result; another fight gets a fresh stage. */
export const boardKey = (fight: BoardFight) => JSON.stringify([fight.map, fight.hero, fight.ally, fight.monsters]);
