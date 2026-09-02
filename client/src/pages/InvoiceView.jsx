import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InvoiceDocument from '../components/InvoiceDocument.jsx';
import { authHeaders } from '../utils/authHeader.js';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [invRes, settRes] = await Promise.all([
          fetch(`/api/invoices/${id}`, { headers: authHeaders() }),
          fetch('/api/settings', { headers: authHeaders() }),
        ]);
        const json = await invRes.json().catch(() => null);
        if (!invRes.ok) throw new Error(json?.error || `Request failed (${invRes.status})`);
        const settings = await settRes.json().catch(() => null);
        if (!cancelled) {
          setInvoice(json);
          setCompany(settings);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  function downloadPdf() {
    const el = document.getElementById('invoice-printable');
    if (!el || typeof html2pdf === 'undefined') return;
    setDownloading(true);
    html2pdf().set({
      margin: 10,
      filename: `${invoice?.invoice_number || 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save().finally(() => setDownloading(false));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-body-md text-body-md text-on-surface-variant">Loading invoice…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="font-body-md text-body-md text-error">{error}</p>
        <button onClick={() => navigate('/invoices')} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90">
          Back to Billing
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-stack-md">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span className="font-label-md text-label-md">Back to Billing</span>
        </button>
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      <div className="flex justify-center">
        <div id="invoice-printable" style={{ width: 700, maxWidth: '100%' }}>
          <InvoiceDocument invoice={invoice} company={company} />
        </div>
      </div>
    </div>
  );
}
