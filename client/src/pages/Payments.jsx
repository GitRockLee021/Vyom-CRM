import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import WhatsAppSendAction from '../components/WhatsAppSendAction.jsx';
import Pagination from '../components/Pagination.jsx';
import NewTabLink from '../components/NewTabLink.jsx';
import { loadListState, saveListState } from '../utils/listState.js';
import { sendPaymentConfirmation } from '../api/whatsapp.js';

const PAGE_SIZE = 10;

const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
];

const METHOD_LABELS = {
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
};

const METHOD_BADGE = {
  bank_transfer: 'bg-blue-50 text-blue-700',
  upi: 'bg-purple-50 text-purple-700',
  cash: 'bg-green-50 text-green-700',
  cheque: 'bg-amber-50 text-amber-700',
  card: 'bg-indigo-50 text-indigo-700',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Payments() {
  const navigate = useNavigate();
  const can = usePerm();
  const waConfig = useWhatsApp();
  const { data, error, loading } = useFetch('/payments');

  const [listInit] = useState(() => loadListState('payments_list'));
  const [search, setSearch] = useState(listInit.search || '');
  const [methodFilter, setMethodFilter] = useState(listInit.methodFilter || '');
  const [page, setPage] = useState(listInit.page || 1);
  const [notice, setNotice] = useState('');

  const payments = Array.isArray(data) ? data : [];

  const prevFilter = useRef({ search, methodFilter });
  useEffect(() => {
    if (prevFilter.current.search === search && prevFilter.current.methodFilter === methodFilter) return;
    prevFilter.current = { search, methodFilter };
    setPage(1);
  }, [search, methodFilter]);

  useEffect(() => {
    saveListState('payments_list', { page, search, methodFilter });
  }, [page, search, methodFilter]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const metrics = useMemo(() => {
    let totalCollected = 0;
    let totalCount = payments.length;
    const byMethod = {};
    for (const p of payments) {
      totalCollected += Number(p.amount) || 0;
      const m = p.method || 'other';
      byMethod[m] = (byMethod[m] || 0) + 1;
    }
    return { totalCollected, totalCount, byMethod };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (methodFilter && p.method !== methodFilter) return false;
      if (!q) return true;
      return (
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.invoice_number || '').toLowerCase().includes(q) ||
        (p.reference_no || '').toLowerCase().includes(q)
      );
    });
  }, [payments, search, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="max-w-[1440px] mx-auto space-y-stack-lg">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Payments</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">View all recorded payments across invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          {can('billing.record_payment') && (
            <button
              type="button"
              onClick={() => navigate('/payments/new')}
              className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">payments</span>
              Record Payment
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {waConfig && waConfig.mode === 'dev' && (
        <div className="px-4 py-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] font-body-md text-body-md text-[#166534] flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>
            WhatsApp is in <strong>dev mode</strong> — messages are logged, not actually sent.
            Go to <a href="/whatsapp" className="underline underline-offset-2">WhatsApp settings</a> to connect your Meta account and go live.
          </span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Collected</span>
            <div className="w-8 h-8 rounded bg-primary-container/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-sm">currency_rupee</span>
            </div>
          </div>
          <span className="font-headline-lg text-headline-lg text-on-surface">₹{fmtCurrency(metrics.totalCollected)}</span>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Payments</span>
            <div className="w-8 h-8 rounded bg-secondary-container/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
            </div>
          </div>
          <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.totalCount}</span>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase">Bank Transfers</span>
            <div className="w-8 h-8 rounded bg-tertiary-container/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-sm">account_balance</span>
            </div>
          </div>
          <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.byMethod.bank_transfer || 0}</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card overflow-hidden flex flex-col">
        {/* Table Toolbar */}
        <div className="p-stack-md border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
            <input
              className="w-full bg-surface-container-lowest border border-outline-variant rounded pl-9 pr-3 py-1.5 font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              placeholder="Search payments..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="method-filter" className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Method:</label>
            <select
              id="method-filter"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">
              <tr>
                <th className="p-4 font-semibold uppercase tracking-wider">Client</th>
                <th className="p-4 font-semibold uppercase tracking-wider">Invoice #</th>
                <th className="p-4 font-semibold uppercase tracking-wider text-right">Amount (₹)</th>
                <th className="p-4 font-semibold uppercase tracking-wider">Method</th>
                <th className="p-4 font-semibold uppercase tracking-wider">Reference</th>
                <th className="p-4 font-semibold uppercase tracking-wider">Date</th>
                <th className="p-4 font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant bg-surface-container-lowest">
              {loading && (
                <tr>
                  <td className="p-4 text-on-surface-variant" colSpan="7">Loading payments…</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td className="p-4 text-error" colSpan="7">{error}</td>
                </tr>
              )}
              {!loading && !error && !rows.length && (
                <tr>
                  <td className="p-4 text-on-surface-variant" colSpan="7">
                    {filtered.length ? 'No payments on this page.' : payments.length ? 'No payments match your filters.' : 'No payments recorded yet. Click "Record Payment" to get started.'}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.map((p, i) => (
                <tr key={p.id} className={`hover:bg-surface-bright transition-colors ${i % 2 === 1 ? 'bg-background' : ''}`}>
                  <td className="p-4">
                    {can('clients.edit') ? (
                      <button
                        type="button"
                        className="cursor-pointer font-medium text-on-surface hover:text-secondary transition-colors"
                        onClick={() => navigate(`/clients/${p.client_id}/edit`)}
                      >
                        {p.client_name}
                      </button>
                    ) : (
                      <span className="font-medium text-on-surface">{p.client_name}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <NewTabLink
                      href={`/invoice/${p.invoice_id}`}
                      className="font-data-mono text-data-mono text-primary font-medium hover:underline cursor-pointer"
                    >
                      {p.invoice_number}
                    </NewTabLink>
                  </td>
                  <td className="p-4 font-data-mono text-data-mono text-right">{fmtCurrency(p.amount)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-md text-label-md ${METHOD_BADGE[p.method] || 'bg-gray-50 text-gray-700'}`}>
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </td>
                  <td className="p-4 text-on-surface-variant font-data-mono text-data-mono">{p.reference_no || '—'}</td>
                  <td className="p-4 text-on-surface-variant">{fmtDate(p.paid_at)}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {can('billing.record_payment') && (
                        <button
                          type="button"
                          title="Edit payment"
                          className="text-on-surface-variant hover:text-primary transition-colors px-1"
                          onClick={() => navigate(`/payments/${p.id}/edit`)}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      )}
                      {can('billing.record_payment') && (
                        <WhatsAppSendAction
                          title={
                            p.client_phone
                              ? `Send payment confirmation for ${p.invoice_number} to ${p.client_name}`
                              : `No phone number on record for ${p.client_name}`
                          }
                          disabled={!p.client_phone}
                          confirmText={`Send payment confirmation (${fmtCurrency(p.amount)}) for ${p.invoice_number} to ${p.client_name} via WhatsApp?`}
                          onSend={() => sendPaymentConfirmation(p.id)}
                          onDone={(msg) => setNotice(msg)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          label="payments"
        />
      </div>
    </div>
  );
}
