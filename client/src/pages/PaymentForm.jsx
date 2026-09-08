import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export default function PaymentForm() {
  const navigate = useNavigate();
  const can = usePerm();
  const { id } = useParams();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payments/${id}`, { headers: authHeaders() });
        const p = await res.json().catch(() => null);
        if (!res.ok) throw new Error(p?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setPayment(p);
        setInvoiceId(p.invoice_id);
        setAmount(String(p.amount));
        setMethod(p.method || 'bank_transfer');
        setReference(p.reference_no || '');
        setDate((p.paid_at || new Date().toISOString()).slice(0, 10));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!payment) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices?client_id=${payment.client_id}`, { headers: authHeaders() });
        const list = await res.json().catch(() => null);
        if (!res.ok) throw new Error(list?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setInvoices(Array.isArray(list) ? list : []);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [payment]);

  const originalAmount = payment ? Number(payment.amount) : 0;
  const origInvoiceId = payment ? payment.invoice_id : null;
  const activeInvoiceId = invoiceId || origInvoiceId;
  const activeInvoice = invoices.find((i) => i.id === activeInvoiceId) || null;

  const totalDue = activeInvoice
    ? Number(activeInvoice.amount) * (1 + Number(activeInvoice.gst_rate || 0) / 100)
    : 0;
  const paidToDate = activeInvoice ? Number(activeInvoice.paid_amount) || 0 : 0;
  const otherPaid = activeInvoiceId === origInvoiceId ? paidToDate - originalAmount : paidToDate;
  const newPaid = otherPaid + (Number(amount) || 0);
  const remaining = totalDue - newPaid;

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          invoice_id: invoiceId || origInvoiceId,
          amount: amt,
          method,
          reference_no: reference || null,
          paid_at: date || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      navigate('/payments');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all';
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-unit';

  if (!can('billing.record_payment')) {
    return <AccessDenied message="You don't have permission to edit payments." />;
  }

  return (
    <div className="space-y-stack-lg">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md mb-2">
            <a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate('/payments'); }}>Payments</a>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">Edit</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">Edit Payment</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {payment ? `Update the details for payment on ${payment.invoice_number} from ${payment.client_name}.` : 'Update payment details.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/payments')}
            className="px-4 py-2 border border-outline-variant text-primary bg-surface-container-lowest hover:bg-surface-container transition-colors rounded-lg font-label-md text-label-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={saving || loading}
            className="px-4 py-2 bg-primary text-white hover:bg-primary-container transition-colors rounded-lg font-label-md text-label-md disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-stack-md px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">Loading payment…</div>
      ) : (
        <form id="payment-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* Main Form Column */}
          <div className="lg:col-span-8">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-6">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                Payment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Client <span className="text-xs font-normal text-on-surface-variant">· locked</span></label>
                  <input
                    className={`${inputCls} bg-surface-container-high cursor-not-allowed opacity-70`}
                    type="text"
                    value={payment.client_name || ''}
                    disabled
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="invoice">Invoice</label>
                  <select
                    className={`${inputCls} cursor-pointer bg-surface-container-lowest`}
                    id="invoice"
                    value={activeInvoiceId || ''}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  >
                    {invoices.length === 0 && (
                      <option value={origInvoiceId}>{payment.invoice_number}</option>
                    )}
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.invoice_number} · {inv.status}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="amount">Amount Received (INR) <span className="text-error">*</span></label>
                  <input
                    className={`${inputCls} font-data-mono text-data-mono font-bold text-right`}
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="method">Payment Method</label>
                  <select className={`${inputCls} cursor-pointer bg-surface-container-lowest`} id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className={labelCls} htmlFor="reference">Reference / Transaction ID</label>
                  <input
                    className={inputCls}
                    id="reference"
                    placeholder="e.g. UTR Number, Cheque Number"
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="date">Date of Payment</label>
                  <input className={`${inputCls} bg-surface-container-lowest`} id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Column */}
          <div className="lg:col-span-4 space-y-stack-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-card">
              <div className="px-stack-md py-4 border-b border-outline-variant bg-surface-container-low">
                <h3 className="font-headline-md text-headline-md text-on-surface">Balance Tracking</h3>
              </div>
              <div className="p-stack-md flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Invoice</span>
                  <a
                    className="font-data-mono text-data-mono text-primary font-medium hover:underline cursor-pointer"
                    href={`/invoice/${activeInvoiceId || origInvoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {activeInvoice ? activeInvoice.invoice_number : payment.invoice_number}
                  </a>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Client</span>
                  <span className="font-body-md text-body-md font-medium text-on-surface">{payment.client_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Original Amount</span>
                  <span className="font-data-mono text-data-mono text-on-surface">₹ {fmtCurrency(totalDue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Paid to Date</span>
                  <span className="font-data-mono text-data-mono text-on-surface">₹ {fmtCurrency(paidToDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">This Payment</span>
                  <span className="font-data-mono text-data-mono text-primary font-medium">₹ {fmtCurrency(newPaid - otherPaid)}</span>
                </div>
                <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Balance After Update</span>
                  <span className={`font-data-mono text-data-mono font-bold ${remaining < 0 ? 'text-error' : 'text-on-surface'}`}>
                    ₹ {fmtCurrency(remaining)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}