import { useCallback, useState } from 'react';

/** Run an async write and keep its error message for inline display (no blocking alerts). */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);
  return { error, run };
}
