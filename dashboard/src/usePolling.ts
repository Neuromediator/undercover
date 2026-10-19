import { useCallback, useEffect, useState } from "react";

export const POLL_MS = 2000;

interface Polled<T> {
  data: T | undefined;
  error: boolean;
  reload: () => void;
}

export function usePolling<T>(
  load: () => Promise<T>,
  intervalMs: number,
): Polled<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      load()
        .then((loaded) => {
          if (!active) return;
          setData(loaded);
          setError(false);
        })
        .catch(() => {
          if (active) setError(true);
        });
    };
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, intervalMs, reloads]);

  const reload = useCallback(() => {
    setReloads((count) => count + 1);
  }, []);

  return { data, error, reload };
}
