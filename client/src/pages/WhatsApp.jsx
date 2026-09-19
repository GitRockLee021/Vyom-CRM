import { useCallback, useEffect, useState } from 'react';
import { usePerm } from '../hooks/usePerm.js';
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
  testWhatsAppConnection,
  getWhatsAppMessages,
} from '../api/whatsapp.js';

const REQUIRED_TEMPLATES = [
  { name: 'invoice_notice', label: 'Invoice Notice' },
  { name: 'overdue_payment_reminder', label: 'Overdue Payment Reminder' },
  { name: 'payment_confirmation', label: 'Payment Confirmation' },
  { name: 'client_message', label: 'Custom Client Message' },
];

const TEMPLATE_LABELS = Object.fromEntries(REQUIRED_TEMPLATES.map((t) => [t.name, t.label]));

const PAGE_SIZE = 50;

const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1 uppercase';

function statusChip(status) {
  const value = String(status || 'pending');
  if (value === 'sent') {
    return <span className="px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] text-[11px] font-medium border border-[#BBF7D0]">Sent</span>;
  }
  if (value === 'failed') {
    return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-medium border border-red-200">Failed</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">Pending</span>;
}

function templateStatus(template, list) {
  const found = list.find((t) => t.name === template.name);
  if (!found) return { state: 'missing', detail: 'Not found in your Meta account' };
  if (found.status === 'APPROVED') return { state: 'approved', detail: 'Approved' };
  return { state: 'other', detail: `Status: ${found.status}` };
}

function TemplateTile({ template, list }) {
  const { state, detail } = templateStatus(template, list);
  const dot =
    state === 'approved' ? 'bg-green-600' : state === 'missing' ? 'bg-red-500' : 'bg-amber-500';
  const text =
    state === 'approved' ? 'text-[#166534]' : state === 'missing' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} title={detail} />
        <span className="font-body-md text-body-md text-on-surface truncate">{template.label}</span>
      </div>
      <code className="font-data-mono text-data-mono text-xs text-on-surface-variant truncate">{template.name}</code>
      <span className={`font-label-sm text-label-sm shrink-0 ${text}`}>{detail}</span>
    </div>
  );
}

function ConnectionCard({ config, onSaved }) {
  const can = usePerm();
  const editable = can('settings.edit');
  const [form, setForm] = useState({ access_token: '', phone_number_id: '', graph_version: 'v21.0' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      access_token: prev.access_token || (config.configured ? '' : ''),
      phone_number_id: config.phone_number_id || '',
      graph_version: config.graph_version || 'v21.0',
    }));
  }, [config]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSave(e) {
    e.preventDefault();
    if (!form.phone_number_id.trim()) {
      setNotice('Phone Number ID is required.');
      return;
    }
    setSaving(true);
    try {
      await saveWhatsAppSettings({
        access_token: form.access_token.trim(),
        phone_number_id: form.phone_number_id.trim(),
        graph_version: form.graph_version.trim() || 'v21.0',
      });
      setForm((prev) => ({ ...prev, access_token: '' }));
      setNotice('WhatsApp credentials saved.');
      onSaved?.();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWhatsAppConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="p-stack-md border-b border-outline-variant bg-surface-container-low">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center">
          <span className="material-symbols-outlined mr-2 text-primary">whatsapp</span>
          Connection
        </h2>
      </div>

      <div className="p-container-padding space-y-stack-md">
        {notice && (
          <div className="px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
            <span>{notice}</span>
            <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}

        {config && config.configured ? (
          <div className="px-4 py-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] font-body-md text-body-md text-[#166534] flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>
              <strong>WhatsApp is connected.</strong>{' '}
              {config.from === 'db' ? 'Credentials are stored in your CRM.' : 'Credentials are set from the server environment.'}
            </span>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 font-body-md text-body-md text-red-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>
              <strong>Not connected.</strong> WhatsApp is in dev mode — invoice and reminder buttons only log messages.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
          {editable ? (
            <form onSubmit={handleSave} className="space-y-stack-md">
              <div>
                <label className={labelCls}>Access Token {config?.configured ? '' : <span className="text-error">*</span>}</label>
                <input
                  className={`${inputCls} font-data-mono text-data-mono`}
                  type="password"
                  autoComplete="new-password"
                  placeholder={config?.configured ? `Paste a new token to replace ${config.access_token_masked || '…'}` : 'Paste your token here'}
                  value={form.access_token}
                  onChange={set('access_token')}
                />
                <p className="text-xs text-on-surface-variant mt-1">
                  {config?.configured
                    ? 'Leave blank to keep the current token.'
                    : 'From Meta: WhatsApp → API Setup → temporary/system user access token.'}
                </p>
              </div>
              <div>
                <label className={labelCls}>Phone Number ID <span className="text-error">*</span></label>
                <input
                  className={`${inputCls} font-data-mono text-data-mono`}
                  type="text"
                  placeholder="e.g. 110123456789123"
                  value={form.phone_number_id}
                  onChange={set('phone_number_id')}
                />
              </div>
              <div>
                <label className={labelCls}>Graph API Version</label>
                <input
                  className={`${inputCls} font-data-mono text-data-mono`}
                  type="text"
                  placeholder="v21.0"
                  value={form.graph_version}
                  onChange={set('graph_version')}
                />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {saving ? 'Saving…' : 'Save Connection'}
                </button>
                <button type="button" onClick={handleTest} disabled={testing} className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low disabled:opacity-50 flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${testing ? 'animate-spin' : ''}`}>
                    {testing ? 'progress_activity' : 'sync'}
                  </span>
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-2 font-body-md text-body-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              You have read-only access to WhatsApp settings.
            </div>
          )}

          <div className="space-y-stack-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                Test result
              </h3>
              {!testResult ? (
                <div className="px-4 py-6 rounded-lg border border-dashed border-outline-variant text-center font-body-md text-body-md text-on-surface-variant">
                  Run “Test Connection” to check your Meta account and templates.
                </div>
              ) : testResult.ok ? (
                <div className="space-y-stack-md">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low">
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Business</div>
                      <div className="font-body-md text-body-md text-on-surface truncate" title={testResult.business}>{testResult.business || '—'}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low">
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Phone</div>
                      <div className="font-body-md text-body-md text-on-surface truncate">{testResult.phone || '—'}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low">
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tier</div>
                      <div className="font-body-md text-body-md text-on-surface truncate" title={testResult.tier}>{testResult.tier || '—'}</div>
                    </div>
                  </div>
                  {Array.isArray(testResult.templates) && (
                    <div>
                      <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-1">Required message templates</div>
                      <div className="space-y-1">
                        {REQUIRED_TEMPLATES.map((t) => (
                          <TemplateTile key={t.name} template={t} list={testResult.templates} />
                        ))}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-2">
                        Create or fix templates in the <strong>WhatsApp Manager</strong> (Meta) under Message Templates.
                        Use the exact names above and match each with one sample parameter.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 font-body-md text-body-md text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageLogCard({ refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextOffset, append) => {
    try {
      const data = await getWhatsAppMessages({ limit: PAGE_SIZE, offset: nextOffset });
      setMessages((prev) => (append ? [...prev, ...data.messages] : data.messages));
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(0, false);
  }, [load, refreshKey]);

  function fmtTime(iso) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="p-stack-md border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center">
          <span className="material-symbols-outlined mr-2 text-primary">history</span>
          Message Log
        </h2>
        <button type="button" onClick={() => load(0, false)} className="px-3 py-1.5 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Refresh
        </button>
      </div>

      <div className="p-container-padding">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 font-body-md text-body-md text-red-700 mb-stack-md">{error}</div>
        )}

        {loading ? (
          <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
            No WhatsApp messages yet. Send an invoice or reminder to see it here.
          </div>
        ) : (
          <>
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 hidden md:table-cell">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {messages.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-low transition-colors align-top">
                      <td className="px-4 py-2.5 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">{fmtTime(m.created_at)}</td>
                      <td className="px-4 py-2.5 font-body-md text-body-md text-on-surface">{m.client_name || '—'}</td>
                      <td className="px-4 py-2.5 font-data-mono text-data-mono text-on-surface-variant">{m.phone_number}</td>
                      <td className="px-4 py-2.5 font-body-md text-body-md text-on-surface">{TEMPLATE_LABELS[m.template_name] || m.template_name || 'Text'}</td>
                      <td className="px-4 py-2.5">{statusChip(m.status)}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell font-body-sm text-body-sm text-on-surface-variant max-w-[260px]">
                        <span className="block truncate" title={m.error || m.body || ''}>{m.error || m.body || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-stack-sm pt-3">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Showing {Math.min(offset + messages.length, total)} of {total} message{total === 1 ? '' : 's'}
              </span>
              {offset + PAGE_SIZE < total && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => { setLoadingMore(true); load(offset + PAGE_SIZE, true); }}
                  className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function WhatsApp() {
  const can = usePerm();
  const canViewConfig = can('settings.view');
  const canViewLog = can('billing.view');
  const [config, setConfig] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadConfig = useCallback(() => {
    getWhatsAppSettings()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="flex-1 overflow-y-auto p-container-padding bg-background">
      <div className="max-w-[1080px] mx-auto space-y-stack-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">WhatsApp Business</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Connect your Meta WhatsApp account and see every message your firm sends.
            </p>
          </div>
          {config?.configured && (
            <span className="px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#166534] text-xs font-medium border border-[#BBF7D0] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
              Connected{config.from === 'db' ? ' · stored in CRM' : ' · from server env'}
            </span>
          )}
        </div>

        {canViewConfig && (
          <ConnectionCard config={config} onSaved={() => { loadConfig(); setRefreshKey((k) => k + 1); }} />
        )}

        {canViewLog && <MessageLogCard refreshKey={refreshKey} />}
      </div>
    </div>
  );
}