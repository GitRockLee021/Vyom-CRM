import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useMockNav } from '../hooks/useMockNav.js';
import { useSettings } from '../hooks/useSettings.js';
import InvoiceDocument from '../components/InvoiceDocument.jsx';

const PAGE_SIZE = 10;
const TENANT_ID = 1;

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
  const handleNav = useMockNav();
  const settings = useSettings();
  const { data, error, loading } = useFetch(`/invoices?tenant_id=${TENANT_ID}`);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');

  const invoices = Array.isArray(data) ? data : [];

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalInvoices = invoices.length;
    let paid = 0;
    let unpaid = 0;
    for (const inv of invoices) {
      const gst = Number(inv.gst_rate) || 18;
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

  function pageList(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const wanted = new Set([1, 2, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...wanted].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
      if (i && p - sorted[i - 1] > 1) out.push('…');
      out.push(p);
    });
    return out;
  }

  function downloadPdf(invoice) {
    const el = document.getElementById(`invoice-pdf-${invoice.id}`);
    if (!el || typeof html2pdf === 'undefined') {
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

  return (
    <>
    <div
      className="bg-surface font-body-md text-on-surface h-screen flex overflow-hidden"
      onClick={handleNav}
    >
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-all duration-200 ease-in-out hidden md:flex">
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>assured_workload</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">{settings?.company_name || 'FinConsult CRM'}</h2>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-grow">
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>dashboard</span>
            Dashboard
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>group</span>
            Clients
          </a>
          <a className="text-secondary dark:text-secondary-fixed-dim font-bold bg-secondary-fixed dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            Billing
          </a>
          <div className="flex flex-col">
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>settings</span>
              Settings
              <span className="material-symbols-outlined text-sm ml-auto">expand_more</span>
            </a>
            <ul className="ml-6 mt-1 space-y-1 mb-1 border-l border-outline-variant dark:border-outline pl-3">
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Company Information
                </a>
              </li>
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Roles &amp; Permissions
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <ul className="flex flex-col gap-1 mt-auto pt-stack-md border-t border-outline-variant dark:border-outline">
          <li>
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>contact_support</span>
              Support
            </a>
          </li>
          <li>
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
              Logout
            </a>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:ml-64 w-full relative h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-outline-variant dark:border-outline w-full h-16 sticky top-0 z-30 font-body-md text-body-md text-primary dark:text-primary-fixed flex items-center justify-between px-container-padding">
          <button type="button" className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full mr-2">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="md:hidden font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed mr-auto">
            {settings?.company_name || 'FinConsult CRM'}
          </div>
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search invoices, clients..." type="text" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" className="relative p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">5</span>
            </button>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">help</span>
            </button>
            <div className="h-6 w-[1px] bg-outline-variant mx-2"></div>
            <button type="button" className="flex items-center gap-2 p-1 pl-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="font-label-md text-label-md text-on-surface font-semibold hidden lg:block">Profile</span>
              <img alt="User profile avatar" className="w-8 h-8 rounded-full object-cover border border-outline-variant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6JU0IdWSZ7-CjN638O-WcW2BmfgiG5tdXzTH__XGaKHzEXizpDaWTlYRWlw-vnPLhfyL1Nds2rOLQkuW-oKi5AsDSAjNw9A23JdslOl6ok5RVpBEJktRqYBkG-FuXSpUEK76KwXXg5_O8BGT9cVBvExeB8sRQIt-RGZhGmgcsTKlVpymeWgiLfkQv6lXQ0UDXvKrv0nL3C1AchdCMgzX6nUky5Y2y5FnjyOJ0nfstXBJag2MNwEs" />
            </button>
          </div>
        </header>

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
                <button
                  type="button"
                  onClick={() => navigate('/payments/new')}
                  className="border border-outline-variant text-on-surface font-label-md text-label-md py-2.5 px-5 rounded flex items-center gap-2 hover:bg-surface-container-low transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/invoices/new')}
                  className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Create Invoice
                </button>
              </div>
            </div>

            {notice && (
              <div className="px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
                <span>{notice}</span>
                <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col justify-between hover:shadow-[0px_2px_4px_rgba(0,0,0,0.05)] transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Revenue</span>
                  <div className="w-8 h-8 rounded bg-primary-container/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-sm">currency_rupee</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">₹{fmtCurrency(metrics.totalRevenue)}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col justify-between hover:shadow-[0px_2px_4px_rgba(0,0,0,0.05)] transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Total Invoices</span>
                  <div className="w-8 h-8 rounded bg-secondary-container/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-sm">receipt</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.totalInvoices}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col justify-between hover:shadow-[0px_2px_4px_rgba(0,0,0,0.05)] transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase">Paid</span>
                  <div className="w-8 h-8 rounded bg-tertiary-container/10 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                  </div>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface">{metrics.paid}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col justify-between hover:shadow-[0px_2px_4px_rgba(0,0,0,0.05)] transition-shadow">
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
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
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
                      const gst = Number(inv.gst_rate) || 18;
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
                            <button
                              type="button"
                              className="cursor-pointer hover:text-secondary transition-colors"
                              onClick={() => navigate(`/clients/${inv.client_id}/edit`)}
                            >
                              {inv.client_name}
                            </button>
                          </td>
                          <td className="p-4 font-data-mono text-data-mono text-right">{fmtCurrency(total)}</td>
                          <td className="p-4 text-on-surface-variant">{fmtDate(inv.issued_date)}</td>
                          <td className={`p-4 ${isOverdue ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{fmtDate(inv.due_date)}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded font-label-md text-label-md ${STATUS_BADGE[inv.status] || STATUS_BADGE.draft}`}>
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
                              <button
                                type="button"
                                disabled={inv.status === 'paid'}
                                className={`text-on-surface-variant transition-colors ${inv.status === 'paid' ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary'}`}
                                title={inv.status === 'paid' ? 'Paid invoices cannot be edited' : 'Edit'}
                                onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                type="button"
                                className="text-on-surface-variant hover:text-primary transition-colors"
                                title="Download PDF"
                                onClick={() => downloadPdf(inv)}
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-outline-variant bg-surface-bright flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface-variant">
                  {filtered.length
                    ? `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} invoices`
                    : 'No entries'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    className="px-2 py-1 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage(safePage - 1)}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  {pageList(totalPages, safePage).map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-2 text-on-surface-variant">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`px-3 py-1 border rounded font-label-md text-label-md transition-colors ${
                          p === safePage
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    className="px-2 py-1 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage(safePage + 1)}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

      {/* Hidden PDF templates for each visible invoice */}
      {!loading && rows.map((inv) => (
        <div key={inv.id} style={{ height: 0, overflow: 'hidden' }}>
          <div id={`invoice-pdf-${inv.id}`}>
            <InvoiceDocument invoice={inv} />
          </div>
        </div>
      ))}
    </>
  );
}
