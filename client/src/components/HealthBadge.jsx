import { useEffect, useState } from 'react';

export default function HealthBadge({ className = '' }) {
  const [status, setStatus] = useState('checking');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.status === 'ok') {
          setStatus('online');
          setDetail(`API online — database ${data.database === 'connected' ? 'connected' : data.database || 'unknown'}`);
        } else {
          setStatus('degraded');
          setDetail('API responding with an error');
        }
      } catch {
        if (!cancelled) {
          setStatus('offline');
          setDetail('API offline');
        }
      }
    }
    check();
    const t = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const dot =
    status === 'online'
      ? 'bg-green-600'
      : status === 'offline'
        ? 'bg-error'
        : status === 'degraded'
          ? 'bg-amber-500'
          : 'bg-on-surface-variant/40 animate-pulse';

  return (
    <div
      title={detail}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface-variant ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="hidden xl:inline">{status === 'checking' ? 'Checking API…' : detail}</span>
    </div>
  );
}