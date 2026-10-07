import { useEffect, useState } from 'react';
import type { LabyrinthView } from '@dark/shared';
import type { Route } from '../../components/map/route';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { formatDuration, useNow } from '../../time';

const GOAL_KEY = 'dc.route';

/**
 * The Room a Route leads to on this Floor (docs/design.md → Routes). Kept for the tab, so a
 * fight on the way, which takes the Room's screen away, doesn't forget it.
 */
export function useRouteGoal(floor: number): [number | null, (room: number | null) => void] {
  const read = (): number | null => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(GOAL_KEY) ?? 'null') as { floor: number; room: number } | null;
      return saved && saved.floor === floor ? saved.room : null;
    } catch {
      return null;
    }
  };
  const [goal, setGoal] = useState<number | null>(read);
  // A new Floor starts without one.
  useEffect(() => setGoal(read()), [floor]);
  const set = (room: number | null) => {
    setGoal(room);
    try {
      if (room === null) sessionStorage.removeItem(GOAL_KEY);
      else sessionStorage.setItem(GOAL_KEY, JSON.stringify({ floor, room }));
    } catch { /* Private windows can refuse storage: the Route then lasts while this screen does. */ }
  };
  return [goal, set];
}

/** What comes back to a done Room, by its type, and the line that says when. */
const BACK: Partial<Record<string, MessageKey>> = {
  fight: 'route.back.fight', miniboss: 'route.back.fight', boss: 'route.back.fight', treasure: 'route.back.treasure', hidden: 'route.back.treasure',
  event: 'route.back.event', twin: 'route.back.twin', oathstone: 'route.back.oathstone',
};

/** Under the Map: the Room picked as a Route's goal, how it stands, what the walk there asks, and the walk. */
export function RoutePanel({ view, goal, route, busy, onWalk, onClear }: {
  view: LabyrinthView; goal: number | null; route: Route | null; busy: boolean; onWalk: () => void; onClear: () => void;
}) {
  const { t } = useI18n();
  const now = useNow();
  if (goal === null) return <p className="m-0 text-sm text-muted">{t('route.hint')}</p>;
  const room = view.map?.rooms.find((r) => r.id === goal);
  if (!room) return null;
  const here = goal === view.room?.id;
  const back = room.visited && room.cleared && room.back && room.type ? BACK[room.type] : undefined;
  const state = here ? t('route.here')
    : !room.visited ? t('route.unknown')
    : back ? t(back, { time: formatDuration(t, new Date(room.back!).getTime() - now) })
    : !room.free ? t('route.waitsHere')
    : null;
  const costs = route && [
    t('route.length', { n: route.rooms.length }),
    route.stamina === 0 ? t('route.free') : t('route.stamina', { n: route.stamina }),
    ...(route.keys > 0 ? [t('route.keys', { n: route.keys })] : []),
  ].join(' · ');
  return (
    <section className="grid gap-1.5 rounded-[3px] border border-[#77613b] bg-[#1d1a14] p-2.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-head text-[15px] font-bold text-bone">{room.type ? t(`room.${room.type}`) : t('route.unknownRoom')}</span>
        <button type="button" className="btn btn-small" onClick={onClear}>{t('route.clear')}</button>
      </div>
      {state && <span className="text-[13px] text-muted">{state}</span>}
      {!here && (route ? (
        <>
          <span className="text-[13px]">{costs}</span>
          {route.waits > 0 && <span className="text-[13px] text-[#f0b25a]">{t('route.waits')}</span>}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onWalk}>{t('route.walk')}</button>
        </>
      ) : <span className="text-[13px] text-[#ff9a8a]">{t('route.none')}</span>)}
    </section>
  );
}
