import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: (update: T | ((prev: T | undefined) => T)) => void;
}

/** Load data with a stable `{ data, loading, error, refresh }` shape. Re-runs when `deps` change. */
export const useAsync = <T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> => {
  const [data, setDataState] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loadRef.current();
      if (gen === generation.current) setDataState(value);
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((update: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof update === "function" ? (update as (p: T | undefined) => T)(prev) : update));
  }, []);

  return { data, loading, error, refresh, setData };
};
