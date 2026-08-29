import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useMockNav } from '../hooks/useMockNav.js';
import { usePerm } from '../hooks/usePerm.js';
import { useSettings } from '../hooks/useSettings.js';
import AccessDenied from '../components/AccessDenied.jsx';
import { authHeaders } from '../utils/authHeader.js';

const TAX_OPTIONS = [
  { value: 18, label: '18%' },
  { value: 12, label: '12%' },
  { value: 0, label: '0%' },
];

const EMPTY_LINE = { service: '', description: '', qty: 1, rate: '', tax: 18 };

function fmtCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

function clientAddress(c) {
  return [c.address_line1, c.city, c.state, c.pincode].filter(Boolean).join(', ');
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const handleNav = useMockNav();
  const settings = useSettings();
  const can = usePerm();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { data } = useFetch('/clients');

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [lineItems, setLineItems] = useState([{ ...EMPTY_LINE }]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const clients = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`, { headers: authHeaders() });
        const inv = await res.json().catch(() => null);
        if (!res.ok) throw new Error(inv?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setSelectedClient({
          id: inv.client_id,
          name: inv.client_name,
          gstin: inv.client_gstin,
          address_line1: inv.address_line1,
          city: inv.city,
          state: inv.state,
          pincode: inv.pincode,
        });
        setInvoiceNumber(inv.invoice_number || '');
        setInvoiceStatus(inv.status || '');
        setIssuedDate(inv.issued_date ? String(inv.issued_date).slice(0, 10) : '');
        setDueDate(inv.due_date ? String(inv.due_date).slice(0, 10) : '');
        let parsed = {};
        try { parsed = JSON.parse(inv.notes || '{}'); } catch { parsed = {}; }
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        setLineItems(
          items.length
            ? items.map((it) => ({
                service: it.service || '',
                description: it.description || '',
                qty: it.qty || 1,
                rate: it.rate ?? '',
                tax: it.tax ?? 18,
              }))
            : [{ ...EMPTY_LINE }]
        );
        setNotes(parsed.note || '');
        setTerms(parsed.terms || '');
        setGstEnabled(typeof parsed.gstEnabled === 'boolean' ? parsed.gstEnabled : Number(inv.gst_rate || 0) > 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => (c.name || '').toLowerCase().includes(q)).slice(0, 6);
  }, [clients, clientSearch]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const gst = gstEnabled
      ? lineItems.reduce((s, it) => {
          const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
          return s + amt * (Number(it.tax) || 0) / 100;
        }, 0)
      : 0;
    return { subtotal, gst, cgst: gst / 2, sgst: gst / 2, total: subtotal + gst };
  }, [lineItems, gstEnabled]);

  function selectClient(c) {
    setSelectedClient(c);
    setClientSearch('');
  }

  function addLineItem() {
    setLineItems((items) => [...items, { ...EMPTY_LINE }]);
  }

  function removeLineItem(idx) {
    setLineItems((items) => items.filter((_, i) => i !== idx));
  }

  function updateLineItem(idx, field, value) {
    setLineItems((items) => {
      const next = [...items];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function handleSave(status) {
    if (!selectedClient) { setError('Please select a client to bill.'); return; }
    if (!dueDate) { setError('Please set a due date.'); return; }
    const validItems = lineItems.filter((it) => (it.service || it.description || '').trim());
    if (!validItems.length) { setError('Add at least one line item.'); return; }

    setSaving(true);
    setError('');
    try {
      const subtotal = Number(totals.subtotal.toFixed(2));
      const gst = Number(totals.gst.toFixed(2));
      const gstRate = gstEnabled && subtotal > 0 ? Number(((gst / subtotal) * 100).toFixed(2)) : 0;
      const payload = {
        client_id: selectedClient.id,
        amount: subtotal,
        gst_rate: gstRate,
        status,
        issued_date: issuedDate || null,
        due_date: dueDate,
        notes: JSON.stringify({
          items: validItems.map((it) => ({
            service: it.service,
            description: it.description,
            qty: Number(it.qty) || 1,
            rate: Number(it.rate) || 0,
            tax: gstEnabled ? (Number(it.tax) || 0) : 0,
          })),
          gstEnabled,
          note: notes || undefined,
          terms: terms || undefined,
        }),
      };
      await api(isEdit ? 'PUT' : 'POST', isEdit ? `/invoices/${id}` : '/invoices', payload);
      navigate('/invoices');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
  const monoCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono text-on-surface outline-none';
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-1';

  if (!(isEdit ? can('billing.edit') : can('billing.create'))) {
    return <AccessDenied message={isEdit ? "You don't have permission to edit invoices." : "You don't have permission to create invoices."} />;
  }

  return (
    <div className="bg-surface font-body-md text-on-surface h-screen flex overflow-hidden" onClick={handleNav}>
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-all duration-200 ease-in-out hidden md:flex">
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>assured_workload</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">{settings?.company_name || 'Vyom CRM'}</h2>
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
                      Team Members
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
            {settings?.company_name || 'Vyom CRM'}
          </div>
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search clients, projects, or invoices..." type="text" />
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
          <div className="max-w-[1440px] mx-auto">
            {/* Sticky Action Bar */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-outline-variant py-stack-md mb-stack-lg flex flex-wrap items-center justify-between gap-stack-md">
              <div>
                <nav aria-label="Breadcrumb" className="flex text-on-surface-variant font-label-md text-label-md mb-2">
                  <ol className="flex items-center space-x-2">
                    <li><a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate('/invoices'); }}>Billing</a></li>
                    <li><span className="material-symbols-outlined text-sm">chevron_right</span></li>
                    <li aria-current="page" className="text-primary">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</li>
                  </ol>
                </nav>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">{isEdit ? 'Updating billing document' : 'Drafting new billing document'}</p>
              </div>
              <div className="flex items-center gap-stack-sm">
                {isEdit && invoiceStatus !== 'draft' && can('billing.record_payment') && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => navigate(`/invoices/${id}/pay`)}
                    className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    Record Payment
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('sent')}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
                </button>
                {isEdit && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => navigate('/invoices')}
                    className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-stack-md px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{error}</div>
            )}

            <div className="space-y-stack-lg">
              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {/* Billed To */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
                  <div className="flex justify-between items-center mb-stack-md">
                    <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Billed To</label>
                    {!isEdit && (
                      <button type="button" className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:text-primary transition-colors" onClick={() => navigate('/clients/new')}>
                        <span className="material-symbols-outlined text-[16px]">person_add</span>
                        New Client
                      </button>
                    )}
                  </div>

                  {!selectedClient ? (
                    <>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
                        <input
                          className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md text-on-surface"
                          placeholder="Search client name..."
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                        />
                      </div>
                      {filteredClients.length > 0 && (
                        <ul className="mt-2 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant max-h-56 overflow-y-auto">
                          {filteredClients.map((c) => (
                            <li key={c.id}>
                              <button type="button" className="w-full text-left px-3 py-2 hover:bg-surface-container-low transition-colors" onClick={() => selectClient(c)}>
                                <span className="block font-body-md text-body-md text-on-surface">{c.name}</span>
                                {c.city && <span className="block text-xs text-on-surface-variant">{c.city}{c.state ? `, ${c.state}` : ''}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 p-4 border border-outline-variant rounded-lg bg-surface-container-low">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-headline-md text-headline-md text-on-surface mb-1">{selectedClient.name}</h4>
                          <p className="text-body-md text-body-md text-on-surface-variant mb-3">{clientAddress(selectedClient)}</p>
                          {selectedClient.gstin && (
                            <span className="px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded text-label-md font-label-md border border-outline-variant">
                              GSTIN: {selectedClient.gstin}
                            </span>
                          )}
                        </div>
                        <button type="button" className="text-on-surface-variant hover:text-primary transition-colors" onClick={() => setSelectedClient(null)} title="Change client">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice Details */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm flex flex-col gap-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Invoice Details</h3>
                  <div>
                    <label className={labelCls}>Invoice Number</label>
                    <input className={`${monoCls} text-on-surface-variant`} readOnly type="text" value={invoiceNumber} placeholder="Auto-generated on save" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Date of Issue</label>
                      <input className={inputCls} type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Due Date</label>
                      <input className={inputCls} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                    <div>
                      <div className="font-label-md text-label-md text-on-surface font-medium">GST Invoice</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{gstEnabled ? 'CGST/SGST (or IGST) will apply' : 'No tax will be applied'}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={gstEnabled}
                      onClick={() => setGstEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${gstEnabled ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${gstEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
                <div className="p-stack-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Line Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-lowest border-b border-outline-variant font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
                        <th className="p-4 w-12 text-center"></th>
                        <th className="p-4 min-w-[250px]">Service / Description</th>
                        <th className="p-4 w-28 text-right">Qty</th>
                        <th className="p-4 w-36 text-right">Rate (₹)</th>
                        {gstEnabled && <th className="p-4 w-28 text-right">Tax %</th>}
                        <th className="p-4 w-36 text-right">Amount (₹)</th>
                        <th className="p-4 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => {
                        const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                        return (
                          <tr key={idx} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                            <td className="p-4 text-center text-outline-variant">
                              <span className="material-symbols-outlined text-sm">drag_indicator</span>
                            </td>
                            <td className="p-4">
                              <input
                                className="w-full mb-2 px-3 py-2 border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-lg bg-surface-container-lowest outline-none font-body-md text-body-md font-medium text-on-surface"
                                placeholder="Service Name"
                                type="text"
                                value={item.service}
                                onChange={(e) => updateLineItem(idx, 'service', e.target.value)}
                              />
                              <textarea
                                className="w-full px-3 py-2 border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-lg bg-surface-container-lowest outline-none font-body-md text-body-md text-on-surface-variant resize-none h-10"
                                placeholder="Detailed description..."
                                value={item.description}
                                onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                              />
                            </td>
                            <td className="p-4 align-top pt-4">
                              <input className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-data-mono text-data-mono text-right" type="number" min="1" value={item.qty} onChange={(e) => updateLineItem(idx, 'qty', e.target.value)} />
                            </td>
                            <td className="p-4 align-top pt-4">
                              <input className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-data-mono text-data-mono text-right" type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateLineItem(idx, 'rate', e.target.value)} />
                            </td>
                            {gstEnabled && (
                              <td className="p-4 align-top pt-4">
                                <select className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md text-right" value={item.tax} onChange={(e) => updateLineItem(idx, 'tax', Number(e.target.value))}>
                                  {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                            )}
                            <td className="p-4 align-top text-right font-data-mono text-data-mono pt-6">{fmtCurrency(amount)}</td>
                            <td className="p-4 align-top text-center pt-4">
                              {lineItems.length > 1 && (
                                <button type="button" className="text-outline hover:text-error transition-colors p-2 rounded-full hover:bg-error-container" onClick={() => removeLineItem(idx)}>
                                  <span className="material-symbols-outlined text-[20px]">delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-stack-md bg-surface-container-lowest">
                  <button type="button" className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:text-primary transition-colors font-semibold" onClick={addLineItem}>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    ADD LINE ITEM
                  </button>
                </div>
              </div>

              {/* Totals & Notes */}
              <div className="flex flex-col-reverse lg:flex-row gap-gutter items-start">
                <div className="flex-1 space-y-gutter w-full">
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-stack-sm uppercase tracking-wide">Notes to Client</label>
                    <textarea className="w-full p-3 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md h-24 resize-none text-on-surface" placeholder="Any additional notes or payment instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-stack-sm uppercase tracking-wide">Terms &amp; Conditions</label>
                    <textarea className="w-full p-3 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md h-24 resize-none text-on-surface-variant" placeholder="Standard T&Cs..." value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </div>
                </div>

                <div className="w-full lg:w-80 bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col gap-stack-md h-fit shadow-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="font-body-md text-body-md text-on-surface-variant">Subtotal</span>
                    <span className="font-data-mono text-data-mono text-on-surface">₹ {fmtCurrency(totals.subtotal)}</span>
                  </div>
                  {gstEnabled && (
                    <>
                      <div className="flex justify-between items-center py-1 text-on-surface-variant">
                        <span className="font-body-md text-body-md">CGST</span>
                        <span className="font-data-mono text-data-mono">₹ {fmtCurrency(totals.cgst)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 text-on-surface-variant border-b border-outline-variant pb-stack-md">
                        <span className="font-body-md text-body-md">SGST</span>
                        <span className="font-data-mono text-data-mono">₹ {fmtCurrency(totals.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center py-2 mt-2">
                    <span className="font-headline-md text-headline-md font-bold text-on-surface">Total</span>
                    <span className="font-headline-md text-headline-md font-bold text-primary">₹ {fmtCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
