import { useCallback, useState } from 'react';
import { describeError } from '../errors';
import { useI18n } from '../i18n';

/**
 * Runs one server action at a time for a screen: `busy` disables its buttons,
 * and a failure becomes a readable `error` line instead of a thrown exception.
 */
export function useAction() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(call: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await call();
    } catch (e) {
      setError(describeError(t, e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [t]);

  return { busy, error, run, setError };
}
