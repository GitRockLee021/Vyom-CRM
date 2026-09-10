import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

let _cache = null;
let _promise = null;

export function useTeam() {
  const [team, setTeam] = useState(_cache);

  useEffect(() => {
    if (_cache) { setTeam(_cache); return; }
    if (!_promise) {
      _promise = fetch('/api/team', { headers: authHeaders() })
        .then((r) => r.json().catch(() => null))
        .then((d) => { _cache = d; return d; })
        .catch(() => { _cache = { members: [] }; return _cache; });
    }
    _promise.then((d) => setTeam(d));
  }, []);

  return team;
}
