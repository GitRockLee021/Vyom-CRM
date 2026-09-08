import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
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
  const can = usePerm();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { data } = useFetch('/clients');
  const { data: serviceData } = useFetch('/services');
  const services = Array.isArray(serviceData) ? serviceData : [];

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const clientSearchRef = useRef(null);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [paidInvoice, setPaidInvoice] = useState(false);

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
        if (inv.status === 'paid') {
          setPaidInvoice(true);
          return;
        }
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

  useEffect(() => {
    if (isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/invoices/next-number', { headers: authHeaders() });
        const json = await res.json().catch(() => null);
        if (!res.ok || cancelled) return;
        setInvoiceNumber(json?.invoice_number || '');
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isEdit]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return showClientDropdown ? clients.slice(0, 10) : [];
    return clients.filter((c) => (c.name || '').toLowerCase().includes(q)).slice(0, 6);
  }, [clients, clientSearch, showClientDropdown]);

  useEffect(() => { setHighlightedIdx(-1); }, [filteredClients]);

  function handleClientKeyDown(e) {
    if (!showClientDropdown || filteredClients.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((i) => (i < filteredClients.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((i) => (i > 0 ? i - 1 : filteredClients.length - 1));
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      selectClient(filteredClients[highlightedIdx]);
    } else if (e.key === 'Escape') {
      setShowClientDropdown(false);
    }
  }

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
    setShowClientDropdown(false);
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
      if (field === 'service') {
        const match = services.find((s) => s.name.trim().toLowerCase() === (value || '').trim().toLowerCase());
        if (match && (next[idx].rate === '' || next[idx].rate === null || Number(next[idx].rate) === 0)) {
          next[idx].rate = match.default_fee != null ? String(match.default_fee) : next[idx].rate;
        }
      }
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

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api('DELETE', `/invoices/${id}`);
      setShowDeleteConfirm(false);
      setNotice('Invoice deleted successfully.');
      setTimeout(() => navigate('/invoices'), 800);
    } catch (err) {
      setShowDeleteConfirm(false);
      setNotice(err.message || 'Something went wrong.');
      setDeleting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
  const monoCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono text-on-surface outline-none';
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-1';

  if (!(isEdit ? can('billing.edit') : can('billing.create'))) {
    return <AccessDenied message={isEdit ? "You don't have permission to edit invoices." : "You don't have permission to create invoices."} />;
  }

  if (isEdit && paidInvoice) {
    return (
      <div className="bg-surface font-body-md text-on-surface h-screen flex items-center justify-center p-container-padding">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-md p-stack-lg text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-error-container/40 flex items-center justify-center mb-stack-md">
            <span className="material-symbols-outlined text-error">lock</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Paid Invoices Cannot Be Edited</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
            This invoice has already been paid. Paid invoices are locked and cannot be edited or deleted.
          </p>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-5 py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
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
                {isEdit && can('billing.delete') && invoiceStatus !== 'paid' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg border border-error/40 text-error font-label-md text-label-md hover:bg-error-container transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Delete
                  </button>
                )}
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

            {notice && (
              <div className="mb-stack-md px-3 py-2 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface">{notice}</div>
            )}

            <div className="space-y-stack-lg">
              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {/* Billed To */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-card">
                  <div className="flex justify-between items-center mb-stack-md">
                    <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Billed To</label>
                    {!isEdit && (
                      <button type="button" className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:text-primary transition-colors" onClick={() => navigate('/clients/new', { state: { fromInvoice: true } })}>
                        <span className="material-symbols-outlined text-[16px]">person_add</span>
                        New Client
                      </button>
                    )}
                  </div>

                  {!selectedClient ? (
                    <div ref={clientSearchRef}>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
                        <input
                          className="w-full pl-10 pr-10 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md text-on-surface"
                          placeholder="Search client name..."
                          type="text"
                          value={clientSearch}
                          onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                          onFocus={() => setShowClientDropdown(true)}
                          onKeyDown={handleClientKeyDown}
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline-variant hover:text-on-surface transition-colors" onClick={() => { setShowClientDropdown((v) => !v); }}>
                          <span className="material-symbols-outlined text-[20px]">arrow_drop_down</span>
                        </button>
                      </div>
                      {filteredClients.length > 0 && (
                        <ul className="mt-2 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant max-h-56 overflow-y-auto" role="listbox">
                          {filteredClients.map((c, idx) => (
                            <li key={c.id} role="option" aria-selected={idx === highlightedIdx}>
                              <button
                                type="button"
                                ref={(el) => { if (el && idx === highlightedIdx) el.scrollIntoView({ block: 'nearest' }); }}
                                className={`w-full text-left px-3 py-2 transition-colors ${idx === highlightedIdx ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-container-low text-on-surface'}`}
                                onMouseEnter={() => setHighlightedIdx(idx)}
                                onClick={() => selectClient(c)}
                              >
                                <span className="block font-body-md text-body-md text-on-surface">{c.name}</span>
                                {c.city && <span className="block text-xs text-on-surface-variant">{c.city}{c.state ? `, ${c.state}` : ''}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-card flex flex-col gap-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Invoice Details</h3>
                  <div>
                    <label className={labelCls}>Invoice Number</label>
                    <input className={`${monoCls} text-on-surface-variant`} readOnly type="text" value={invoiceNumber} />
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
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-card">
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
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-card">
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-stack-sm uppercase tracking-wide">Notes to Client</label>
                    <textarea className="w-full p-3 border border-outline-variant rounded-lg bg-surface-container-lowest focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-body-md text-body-md h-24 resize-none text-on-surface" placeholder="Any additional notes or payment instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-card">
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

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl w-full max-w-sm p-container-padding" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Delete Invoice?</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
              This will permanently delete <strong className="text-on-surface">{invoiceNumber || 'this invoice'}</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
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
