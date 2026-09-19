import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

let _cache = null;
let _promise = null;
let _fetchedAt = 0;
const TTL = 60_000;

export function useTeam() {
  const [team, setTeam] = useState(_cache ?? { members: [] });

  useEffect(() => {
    // Share an in-flight request so two mounts don't double-fetch.
    if (_promise) {
      _promise.then((d) => setTeam(d));
      return;
    }
    // Serve from cache while it is fresh; otherwise refetch.
    if (_cache && Date.now() - _fetchedAt < TTL) {
      setTeam(_cache);
      return;
    }
    _promise = fetch('/api/team', { headers: authHeaders() })
      .then((r) => r.json().catch(() => null))
      .then((d) => { _cache = d; _fetchedAt = Date.now(); return d; })
      .catch(() => ({ members: [] }))
      .finally(() => { _promise = null; });
    _promise.then((d) => setTeam(d));
  }, []);

  return team;
}

// Drop the shared team cache so the next useTeam() fetch picks up pending
// invites / membership changes (call after team mutations).
export function refreshTeam() {
  _cache = null;
  _promise = null;
  _fetchedAt = 0;
}