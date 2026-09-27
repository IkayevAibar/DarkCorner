import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../api';

/**
 * Looks again every `ms` while the screen is open (there are no websockets in Season 0),
 * but not while the tab is hidden; coming back to the tab looks at once.
 */
export function useRefresh(reload: () => Promise<void>, ms: number) {
  useEffect(() => {
    // Tabs can flicker visible and back; a look within the last 10 seconds is fresh enough.
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < Math.min(ms, 10_000)) return;
      last = Date.now();
      void reload();
    };
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reload, ms]);
}

/** Loads a screen's data once, with a reload for after actions and the error code if it failed. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const latest = useRef(load);
  latest.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await latest.current());
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof ApiRequestError ? (e.body?.error ?? 'error') : 'error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, failed, reload };
}
