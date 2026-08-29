import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/authHeader.js';

let cached = null;
let promise = null;

export function useSettings() {
  const [settings, setSettings] = useState(cached);

  useEffect(() => {
    if (cached) { setSettings(cached); return; }
    if (!promise) {
      promise = fetch('/api/settings', { headers: authHeaders() })
        .then((r) => r.json().catch(() => null))
        .then((s) => { cached = s || {}; return cached; })
        .catch(() => { cached = {}; return cached; });
    }
    promise.then((s) => setSettings(s));
  }, []);

  return settings;
}
