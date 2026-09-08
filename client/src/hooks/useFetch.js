import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

export function useFetch(path, options = {}) {
  const enabled = options.enabled !== false;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api${path}`, {
          headers: authHeaders(options.headers),
        });
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
  }, [path, tick, enabled]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
