import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

const _cache = new Map();
const CACHE_TTL = 45 * 1000;

export function useFetch(path, options = {}) {
  const enabled = options.enabled !== false;
  const cached = options.cached === true;
  const key = `/api${path}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const entry = cached ? _cache.get(key) : undefined;
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setData(entry.data);
      setError(null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    async function run() {
      try {
        const res = await fetch(key, {
          headers: authHeaders(options.headers),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
        if (cached) _cache.set(key, { data: json, ts: Date.now() });
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
  }, [key, tick, enabled, cached]);

  return {
    data,
    error,
    loading,
    reload: () => {
      if (cached) _cache.delete(key);
      setTick((t) => t + 1);
    },
  };
}