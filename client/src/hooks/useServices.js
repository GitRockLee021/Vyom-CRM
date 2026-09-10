import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

let _cache = null;
let _promise = null;

export function useServices() {
  const [services, setServices] = useState(_cache);

  useEffect(() => {
    if (_cache) { setServices(_cache); return; }
    if (!_promise) {
      _promise = fetch('/api/services', { headers: authHeaders() })
        .then((r) => r.json().catch(() => null))
        .then((d) => { _cache = Array.isArray(d) ? d : []; return _cache; })
        .catch(() => { _cache = []; return _cache; });
    }
    _promise.then((d) => setServices(d));
  }, []);

  return services;
}
