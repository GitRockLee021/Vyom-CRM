import { useEffect, useState } from 'react';

export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api${path}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
