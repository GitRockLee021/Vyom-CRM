import { useEffect, useState } from 'react';
import { getWhatsAppConfig } from '../api/whatsapp.js';

export function useWhatsApp() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getWhatsAppConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ configured: false, mode: 'dev' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}