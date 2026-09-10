import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import WhatsAppSendAction from '../components/WhatsAppSendAction.jsx';
import Pagination from '../components/Pagination.jsx';
import { loadListState, saveListState } from '../utils/listState.js';
import { sendInvoiceNotice } from '../api/whatsapp.js';
import { authHeaders } from '../utils/authHeader.js';
import InvoiceDocument from '../components/InvoiceDocument.jsx';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'sent', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_BADGE = {
  draft: 'bg-surface-container-highest text-on-surface-variant',
  sent: 'bg-[#FEF3C7] text-[#92400E]',
  paid: 'bg-[#DCFCE7] text-[#166534]',
  overdue: 'bg-[#FEE2E2] text-[#991B1B]',
  cancelled: 'bg-surface-container-highest text-on-surface-variant',
};

const STATUS_LABELS = { draft: 'Draft', sent: 'Unpaid', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Billing() {
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePerm();
  const waConfig = useWhatsApp();
  const { data, error, loading, reload } = useFetch('/invoices');

  const [listInit] = useState(() => loadListState('billing_list'));
  const [search, setSearch] = useState(listInit.search || '');
  const [statusFilter, setStatusFilter] = useState(listInit.statusFilter || '');
  const [page, setPage] = useState(listInit.page || 1);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const invoices = Array.isArray(data) ? data : [];

  const prevFilter = useRef({ search, statusFilter });
  useEffect(() => {
    if (prevFilter.current.search === search && prevFilter.current.statusFilter === statusFilter) return;
    prevFilter.current = { search, statusFilter };
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    saveListState('billing_list', { page, search, statusFilter });
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice);
      window.history.replaceState({}, '');
    }
  }, []);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalInvoices = invoices.length;
    let paid = 0;
    let unpaid = 0;
    for (const inv of invoices) {
      const gst = Number(inv.gst_rate) || 0;
      const total = Number(inv.amount) * (1 + gst / 100);
      if (inv.status === 'paid') {
        paid += 1;
        totalRevenue += total;
      } else if (inv.status !== 'cancelled') {
        unpaid += 1;
      }
    }
    return { totalRevenue, totalInvoices, paid, unpaid };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter) {
        if (statusFilter === 'sent') {
          if (inv.status !== 'sent' && inv.status !== 'draft') return false;
        } else {
          if (inv.status !== statusFilter) return false;
        }
      }
      if (!q) return true;
      return (inv.client_name || '').toLowerCase().includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
    });
  }, [invoices, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  async function downloadPdf(invoice) {
    if (typeof html2pdf === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('load failed'));
          document.head.appendChild(s);
        });
      } catch {
        setNotice('PDF download is unavailable right now. Please try again.');
        return;
      }
    }
    const el = document.getElementById(`invoice-pdf-${invoice.id}`);
    if (!el) {
      setNotice('PDF download is unavailable right now. Please try again.');
      return;
    }
    html2pdf().set({
      margin: 10,
      filename: `${invoice.invoice_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setDeleteTarget(null);
      reload();
      setNotice('Invoice deleted successfully.');
    } catch (err) {
      setDeleteTarget(null);
      setNotice(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function sendReminder(invoice) {
    setNotice('');
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/remind`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setNotice(json?.message || 'Reminder sent.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <>
      {/* Page Content */}
      <div className="flex-1 overflow-y-auto p-container-padding bg-background">
          <div className="max-w-[1440px] mx-auto space-y-stack-lg">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Billing</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage and track your client billing.</p>
              </div>
              <div className="flex items-center gap-3">
                {can('billing.record_payment') && (
                  <button
                    type="button"
                    onClick={() => navigate('/payments/new')}
                    className="border border-outline-variant text-on-surface font-label-md text-label-md py-2.5 px-5 rounded-lg flex items-center gap-2 hover:bg-surface-container-low transition-colors whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Record Payment
                  </button>
                )}
                {can('billing.create') && (
                  <button
                    type="button"
                    onClick={() => navigate('/invoices/new')}
                    className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Create Invoice
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
                  Add <code className="font-data-mono text-data-mono">META_ACCESS_TOKEN</code> and{' '}
                  <code className="font-data-mono text-data-mono">META_PHONE_NUMBER_ID</code> in <code className="font-data-mono text-data-mono">server/.env</code> to go live.
                </span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Revenue</span>
                  <div className="w-8 h-8 rounded bg-primary-container/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-sm">currency_rupee</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">₹{fmtCurrency(metrics.totalRevenue)}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Invoices</span>
                  <div className="w-8 h-8 rounded bg-secondary-container/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-sm">receipt</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.totalInvoices}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Paid</span>
                  <div className="w-8 h-8 rounded bg-tertiary-container/10 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.paid}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-stack-md flex flex-col justify-between transition-shadow hover:shadow-[0_4px_12px_rgba(16,14,23,0.08)]">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Unpaid</span>
                  <div className="w-8 h-8 rounded bg-error-container/30 flex items-center justify-center text-error">
                    <span className="material-symbols-outlined text-sm">pending</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.unpaid}</span>
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
                    placeholder="Search invoices..."
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label htmlFor="status-filter" className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Filter by Status:</label>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  >
                    {STATUS_OPTIONS.map((opt) => (
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
                      <th className="p-4 font-semibold uppercase tracking-wider">Invoice #</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Client Name</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-right">Amount (₹)</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Issue Date</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Due Date</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Status</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant bg-surface-container-lowest">
                    {loading && (
                      <tr>
                        <td className="p-4 text-on-surface-variant" colSpan="7">Loading invoices…</td>
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
                          {filtered.length ? 'No invoices on this page.' : invoices.length ? 'No invoices match your filters.' : 'No invoices yet. Click "Create Invoice" to get started.'}
                        </td>
                      </tr>
                    )}
                    {!loading && !error && rows.map((inv, i) => {
                      const gst = Number(inv.gst_rate) || 0;
                      const total = Number(inv.amount) * (1 + gst / 100);
                      const isOverdue = inv.status === 'overdue';
                      return (
                        <tr key={inv.id} className={`hover:bg-surface-bright transition-colors ${i % 2 === 1 ? 'bg-background' : ''}`}>
                          <td className="p-4">
                            <a
                              href={`/invoice/${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-data-mono text-data-mono text-primary font-medium hover:underline cursor-pointer"
                            >
                              {inv.invoice_number}
                            </a>
                          </td>
                          <td className="p-4 font-medium text-on-surface">
                            {can('clients.edit') ? (
                              <button
                                type="button"
                                className="cursor-pointer hover:text-secondary transition-colors"
                                onClick={() => navigate(`/clients/${inv.client_id}/edit`)}
                              >
                                {inv.client_name}
                              </button>
                            ) : (
                              <span className="text-on-surface">{inv.client_name}</span>
                            )}
                          </td>
                          <td className="p-4 font-data-mono text-data-mono text-right">{fmtCurrency(total)}</td>
                          <td className="p-4 text-on-surface-variant">{fmtDate(inv.issued_date)}</td>
                          <td className={`p-4 ${isOverdue ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{fmtDate(inv.due_date)}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-md text-label-md ${STATUS_BADGE[inv.status] || STATUS_BADGE.draft}`}>
                              {STATUS_LABELS[inv.status] || inv.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <a
                                href={`/invoice/${inv.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-on-surface-variant hover:text-primary transition-colors"
                                title="View"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </a>
                              {can('billing.edit') && (
                                <button
                                  type="button"
                                  disabled={inv.status === 'paid'}
                                  className={`text-on-surface-variant transition-colors ${inv.status === 'paid' ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary'}`}
                                  title={inv.status === 'paid' ? 'Paid invoices cannot be edited' : 'Edit'}
                                  onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="text-on-surface-variant hover:text-primary transition-colors"
                                title="Download PDF"
                                onClick={() => downloadPdf(inv)}
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                              {can('billing.edit') && (
                                <WhatsAppSendAction
                                  title={
                                    inv.client_phone
                                      ? `Send ${inv.invoice_number} to ${inv.client_name} on WhatsApp`
                                      : `No phone number on record for ${inv.client_name}`
                                  }
                                  disabled={!inv.client_phone || ['paid', 'cancelled'].includes(inv.status)}
                                  confirmText={`Send ${inv.invoice_number} to ${inv.client_name} via WhatsApp?`}
                                  onSend={() => sendInvoiceNotice(inv.id)}
                                  onDone={(msg) => setNotice(msg)}
                                />
                              )}
                              <button
                                type="button"
                                disabled={!inv.client_email || ['paid', 'cancelled'].includes(inv.status)}
                                className={`text-on-surface-variant transition-colors ${!inv.client_email || ['paid', 'cancelled'].includes(inv.status) ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary'}`}
                                title={
                                  ['paid', 'cancelled'].includes(inv.status)
                                    ? 'Paid or cancelled invoices do not need reminders'
                                    : inv.client_email
                                      ? `Send a reminder email for ${inv.invoice_number}`
                                      : `No email address on record for ${inv.client_name}`
                                }
                                onClick={() => sendReminder(inv)}
                              >
                                <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                              </button>
                              {can('billing.delete') && (
                                <button
                                  type="button"
                                  disabled={inv.status === 'paid'}
                                  className={`text-on-surface-variant transition-colors ${inv.status === 'paid' ? 'opacity-40 cursor-not-allowed' : 'hover:text-error'}`}
                                  title={inv.status === 'paid' ? 'Paid invoices cannot be deleted' : 'Delete'}
                                  onClick={() => setDeleteTarget(inv)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
                label="invoices"
              />
            </div>
          </div>
        </div>

      {/* Hidden PDF templates for each visible invoice */}
      {!loading && rows.map((inv) => (
        <div key={inv.id} style={{ height: 0, overflow: 'hidden' }}>
          <div id={`invoice-pdf-${inv.id}`}>
            <InvoiceDocument invoice={inv} />
          </div>
        </div>
      ))}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-sm p-container-padding" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Delete Invoice?</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
              This will permanently delete <strong className="text-on-surface">{deleteTarget.invoice_number}</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" disabled={deleting} className="px-4 py-2 bg-error text-on-error rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50" onClick={confirmDelete}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
