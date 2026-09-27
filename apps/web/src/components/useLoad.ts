import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../api';

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
