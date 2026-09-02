import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
import AccessDenied from '../components/AccessDenied.jsx';
import { authHeaders } from '../utils/authHeader.js';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
];

function fmtCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function invoiceTotal(inv) {
  const gst = Number(inv.gst_rate) || 18;
  return Number(inv.amount) * (1 + gst / 100);
}

function invoiceBalance(inv) {
  return invoiceTotal(inv) - (Number(inv.paid_amount) || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function RecordPayment() {
  const navigate = useNavigate();
  const can = usePerm();
  const { id } = useParams();
  const isSingle = Boolean(id);

  const { data: clientsData } = useFetch('/clients');
  const clients = Array.isArray(clientsData) ? clientsData : [];

  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(isSingle);

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientInvoices, setClientInvoices] = useState([]);
  const [loadingClientInvoices, setLoadingClientInvoices] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSingle) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`, { headers: authHeaders() });
        const inv = await res.json().catch(() => null);
        if (!res.ok) throw new Error(inv?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setInvoice(inv);
        setAmount(String(invoiceBalance(inv).toFixed(2)));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingInvoice(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isSingle]);

  useEffect(() => {
    if (isSingle || !selectedClient) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingClientInvoices(true);
      try {
        const res = await fetch(`/api/invoices?client_id=${selectedClient.id}`, { headers: authHeaders() });
        const list = await res.json().catch(() => null);
        if (!res.ok) throw new Error(list?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        const pending = (Array.isArray(list) ? list : []).filter(
          (inv) => !['paid', 'cancelled', 'draft'].includes(inv.status)
        );
        setClientInvoices(pending);
        setSelectedIds([]);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingClientInvoices(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSingle, selectedClient]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => (c.name || '').toLowerCase().includes(q)).slice(0, 6);
  }, [clients, clientSearch]);

  const selectedInvoices = isSingle ? [] : clientInvoices.filter((inv) => selectedIds.includes(inv.id));
  const selectedBalance = selectedInvoices.reduce((s, inv) => s + invoiceBalance(inv), 0);

  useEffect(() => {
    if (!isSingle && selectedBalance > 0) setAmount(selectedBalance.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const singleBalance = invoice ? invoiceBalance(invoice) : 0;
  const totalLabel = isSingle ? singleBalance : selectedBalance;
  const remaining = totalLabel - (Number(amount) || 0);

  function selectClient(c) {
    setSelectedClient(c);
    setClientSearch('');
  }

  function toggleInvoice(invId) {
    setSelectedIds((ids) => (ids.includes(invId) ? ids.filter((x) => x !== invId) : [...ids, invId]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      const paidAt = date || null;
      if (isSingle) {
        await api('POST', `/invoices/${id}/payments`, {
          amount: amt,
          method,
          reference_no: reference || null,
          paid_at: paidAt,
        });
        navigate(`/invoice/${id}`);
      } else {
        if (!selectedInvoices.length) { setError('Select at least one invoice to record payment.'); setSaving(false); return; }
        let remainingAmt = amt;
        for (const inv of selectedInvoices) {
          if (remainingAmt <= 0) break;
          const balance = invoiceBalance(inv);
          const pay = Math.min(remainingAmt, balance);
          if (pay <= 0) continue;
          await api('POST', `/invoices/${inv.id}/payments`, {
            amount: Number(pay.toFixed(2)),
            method,
            reference_no: reference || null,
            paid_at: paidAt,
          });
          remainingAmt -= pay;
        }
        navigate('/invoices');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-outline-variant rounded px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors';
  const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1';

  if (!can('billing.record_payment')) {
    return <AccessDenied message="You don't have permission to record payments." />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-container-padding bg-background">
      <div className="max-w-[1440px] mx-auto">
        {/* Page Header */}
            <div className="mb-stack-md">
              <nav aria-label="Breadcrumb" className="flex text-on-surface-variant font-label-md text-label-md mb-2">
                <ol className="flex items-center space-x-2">
                  <li><a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate('/invoices'); }}>Billing</a></li>
                  <li><span className="material-symbols-outlined text-sm">chevron_right</span></li>
                  <li aria-current="page" className="text-primary">Record Payment</li>
                </ol>
              </nav>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Record Payment</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">Log fee received against invoice</p>
            </div>

            {error && (
              <div className="mb-stack-md px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{error}</div>
            )}

            {isSingle && loadingInvoice ? (
              <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">Loading invoice…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
                {/* Left Column */}
                <div className="lg:col-span-8 flex flex-col gap-stack-md">
                  {isSingle && invoice ? (
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                      <div>
                        <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-1">Client</div>
                        <div className="font-body-lg text-body-lg font-semibold text-on-surface">{invoice.client_name}</div>
                      </div>
                      <div className="hidden md:block w-px h-10 bg-outline-variant"></div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-1">Invoice</div>
                        <div className="font-data-mono text-data-mono text-on-surface">{invoice.invoice_number}</div>
                      </div>
                      <div className="hidden md:block w-px h-10 bg-outline-variant"></div>
                      <div className="text-right">
                        <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-1">Balance Due</div>
                        <div className="font-headline-md text-headline-md text-primary">₹ {fmtCurrency(singleBalance)}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
                        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Search Client</label>
                        <div className="relative max-w-md">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded pl-10 pr-4 py-2 text-body-md font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            placeholder="Start typing client name..."
                            type="text"
                            value={selectedClient ? selectedClient.name : clientSearch}
                            onChange={(e) => { if (selectedClient) setSelectedClient(null); setClientSearch(e.target.value); }}
                          />
                          {selectedClient && (
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary">check_circle</span>
                          )}
                        </div>
                        {!selectedClient && filteredClients.length > 0 && (
                          <ul className="mt-2 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant max-h-56 overflow-y-auto max-w-md">
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
                      </div>

                      {selectedClient && (
                        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
                          <div className="px-stack-md py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                            <h3 className="font-headline-md text-headline-md text-on-surface">Pending Invoices for {selectedClient.name}</h3>
                            <span className="font-label-md text-label-md text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded">{clientInvoices.length} Found</span>
                          </div>
                          {loadingClientInvoices ? (
                            <div className="p-4 text-on-surface-variant font-body-md text-body-md">Loading invoices…</div>
                          ) : clientInvoices.length === 0 ? (
                            <div className="p-4 text-on-surface-variant font-body-md text-body-md">No pending invoices for this client.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
                                    <th className="p-4 font-normal w-12 text-center"></th>
                                    <th className="p-4 font-normal">Invoice #</th>
                                    <th className="p-4 font-normal">Due Date</th>
                                    <th className="p-4 font-normal text-right">Total Amount</th>
                                    <th className="p-4 font-normal text-right">Balance Due</th>
                                  </tr>
                                </thead>
                                <tbody className="font-data-mono text-data-mono">
                                  {clientInvoices.map((inv) => (
                                    <tr key={inv.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => toggleInvoice(inv.id)}>
                                      <td className="p-4 text-center">
                                        <input
                                          type="checkbox"
                                          className="rounded border-outline-variant text-primary focus:ring-primary"
                                          checked={selectedIds.includes(inv.id)}
                                          onChange={() => toggleInvoice(inv.id)}
                                        />
                                      </td>
                                      <td className="p-4 text-primary font-medium">{inv.invoice_number}</td>
                                      <td className="p-4 text-on-surface-variant">{fmtDate(inv.due_date)}</td>
                                      <td className="p-4 text-right">₹ {fmtCurrency(invoiceTotal(inv))}</td>
                                      <td className="p-4 text-right font-medium text-primary">₹ {fmtCurrency(invoiceBalance(inv))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Payment Details Form */}
                  <form id="payment-form" onSubmit={handleSubmit}>
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
                      <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md border-b border-outline-variant pb-2">Payment Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                        <div>
                          <label className={labelCls}>Date of Payment</label>
                          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Payment Method</label>
                          <select className={`${inputCls} bg-surface-container-lowest`} value={method} onChange={(e) => setMethod(e.target.value)}>
                            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Reference / Transaction ID</label>
                          <input className={inputCls} placeholder="e.g. UTR Number, Cheque Number" type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Internal Notes</label>
                          <textarea className={`${inputCls} resize-none`} placeholder="Optional notes about this transaction..." rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4">
                  <div className="sticky top-20 flex flex-col gap-stack-md">
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
                      <div className="px-stack-md py-4 border-b border-outline-variant bg-surface-container-low">
                        <h3 className="font-headline-md text-headline-md text-on-surface">Balance Tracking</h3>
                      </div>
                      <div className="p-stack-md flex flex-col gap-4">
                        {isSingle && invoice ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-on-surface-variant">Original Amount</span>
                              <span className="font-data-mono text-data-mono text-on-surface">₹ {fmtCurrency(invoiceTotal(invoice))}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-on-surface-variant">Paid to Date</span>
                              <span className="font-data-mono text-data-mono text-on-surface">₹ {fmtCurrency(invoice.paid_amount)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-on-surface-variant">Total Selected</span>
                            <span className="font-data-mono text-data-mono font-medium text-primary">₹ {fmtCurrency(selectedBalance)}</span>
                          </div>
                        )}
                        <div>
                          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Amount Received (INR)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-data-mono">₹</span>
                            <input
                              className="w-full bg-surface-container-lowest border-2 border-primary rounded pl-8 pr-4 py-2.5 font-data-mono text-data-mono font-bold text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors text-right"
                              type="number"
                              min="0"
                              step="0.01"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                          <span className="text-on-surface-variant font-medium">Remaining Balance</span>
                          <span className={`font-data-mono text-data-mono font-bold ${remaining < 0 ? 'text-error' : 'text-on-surface'}`}>
                            ₹ {fmtCurrency(remaining < 0 ? remaining : remaining)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        type="submit"
                        form="payment-form"
                        disabled={saving}
                        className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                        {saving ? 'Recording…' : 'Record Payment'}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(isSingle ? `/invoice/${id}` : '/invoices')}
                        className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-label-md text-label-md py-3 rounded flex items-center justify-center hover:bg-surface-container transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}
