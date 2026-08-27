import { useEffect, useState } from 'react';

let cached = null;
let promise = null;

export function useSettings() {
  const [settings, setSettings] = useState(cached);

  useEffect(() => {
    if (cached) { setSettings(cached); return; }
    if (!promise) {
      promise = fetch('/api/settings')
        .then((r) => r.json().catch(() => null))
        .then((s) => { cached = s || {}; return cached; })
        .catch(() => { cached = {}; return cached; });
    }
    promise.then((s) => setSettings(s));
  }, []);

  return settings;
}
