import { fmtDate, fmtCurrency, parseLineItems, amountInWords } from '../utils/invoice.js';

const C = {
  primaryContainer: '#1e3a8a',
  onPrimaryContainer: '#90a8ff',
  primary: '#00236f',
  primaryFixed: '#dce1ff',
  primaryFixedDim: '#b6c4ff',
  onSurface: '#191c1d',
  onSurfaceVariant: '#444651',
  white: '#ffffff',
  bright: '#f8f9fa',
  containerLow: '#f3f4f5',
  variant: '#e1e3e4',
  error: '#ba1a1a',
  green: '#166534',
};

const FONT = "Nunito, 'Segoe UI', sans-serif";

export default function InvoiceDocument({ invoice, company }) {
  const subtotal = Number(invoice.amount) || 0;
  const gstRate = Number(invoice.gst_rate) || 0;
  const gstEnabled = gstRate > 0;
  const gstAmount = subtotal * (gstRate / 100);
  const total = subtotal + gstAmount;
  const lineItems = parseLineItems(invoice.notes) || [
    { description: 'Professional Services', note: '', qty: 1, rate: subtotal, amount: subtotal },
  ];

  const status = (invoice.status || 'sent').toLowerCase();
  const watermark =
    status === 'paid' ? { text: 'PAID', color: 'rgba(22,163,74,0.06)' }
    : status === 'cancelled' ? { text: 'CANCELLED', color: 'rgba(0,0,0,0.06)' }
    : { text: 'PENDING', color: 'rgba(220,38,38,0.06)' };

  const from = company ? {
    name: company.company_name || 'Vyom CRM',
    address: company.address || '',
    state: company.state || '',
    gstin: company.gst || '',
    pan: company.pan || '',
    email: company.email || '',
    phone: company.phone || '',
    logo_url: company.logo_url || '',
    bank_name: company.bank_name || '',
    account_name: company.account_name || '',
    account_number: company.account_number || '',
    ifsc: company.ifsc || '',
  } : {
    name: 'Vyom CRM',
    address: '123 Financial District, Suite 400\nMumbai, MH 400001, India',
    state: 'Maharashtra',
    gstin: '27AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    email: 'billing@vyomcrm.in',
    phone: '',
    logo_url: '',
    bank_name: 'HDFC Bank Ltd',
    account_name: 'Vyom CRM',
    account_number: '000123456789',
    ifsc: 'HDFC0000001',
  };

  const clientState = (invoice.state || '').trim().toLowerCase();
  const companyState = from.state.trim().toLowerCase();
  const isSameState = !!(clientState && companyState && clientState === companyState);
  const halfGst = gstAmount / 2;

  const clientAddress = [
    invoice.address_line1,
    invoice.address_line2,
    [invoice.city, invoice.state, invoice.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);

  const label = { fontWeight: 700, color: C.onSurfaceVariant, fontSize: 11, letterSpacing: '0.04em' };
  const value = { color: C.onSurface, fontSize: 12, fontWeight: 600 };
  const body = { fontSize: 11.5, color: C.onSurfaceVariant, lineHeight: 1.6 };

  return (
    <div
      style={{
        width: 700,
        boxSizing: 'border-box',
        background: C.white,
        color: C.onSurface,
        fontFamily: FONT,
        padding: '36px 40px',
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${C.variant}`,
        borderRadius: 8,
      }}
    >
      {/* Watermark */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-45deg)',
          fontSize: 96, fontWeight: 800, textTransform: 'uppercase',
          color: watermark.color, letterSpacing: '0.1em',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}
      >
        {watermark.text}
      </div>

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 20, marginBottom: 22, borderBottom: `1px solid ${C.variant}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {from.logo_url ? (
            <div style={{ padding: 4, borderRadius: 6, border: `1px solid ${C.variant}` }}>
              <img src={from.logo_url} alt="Logo" style={{ height: 36, width: 36, objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ background: C.primaryContainer, padding: 8, borderRadius: 6 }}>
              <span className="material-symbols-outlined" style={{ color: C.onPrimaryContainer, fontSize: 24, fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            </div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.primaryContainer, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{from.name}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>Financial Consulting</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.primaryContainer, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Invoice</div>
          <table style={{ borderCollapse: 'collapse', marginLeft: 'auto', fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={{ ...label, textAlign: 'right', padding: '1px 6px 1px 0' }}>INV NO:</td>
                <td style={{ ...value, textAlign: 'left' }}>{invoice.invoice_number || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...label, textAlign: 'right', padding: '1px 6px 1px 0' }}>DATE:</td>
                <td style={{ ...value, textAlign: 'left' }}>{fmtDate(invoice.issued_date)}</td>
              </tr>
              <tr>
                <td style={{ ...label, textAlign: 'right', padding: '1px 6px 1px 0' }}>DUE DATE:</td>
                <td style={{ ...value, textAlign: 'left' }}>{fmtDate(invoice.due_date)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing details */}
      <div style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1, background: C.bright, border: `1px solid ${C.variant}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.primaryContainer, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primaryContainer, display: 'inline-block' }} /> From
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, marginBottom: 6 }}>{from.name}</div>
          <div style={body}>
            {from.address.split('\n').map((line, i) => line.trim() && <div key={i}>{line}</div>)}
            {(from.gstin || from.pan || from.email) && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.variant}` }}>
                {gstEnabled && from.gstin && <div><span style={{ fontWeight: 700, color: C.onSurface }}>GSTIN:</span> {from.gstin}</div>}
                {from.pan && <div><span style={{ fontWeight: 700, color: C.onSurface }}>PAN:</span> {from.pan}</div>}
                {from.email && <div><span style={{ fontWeight: 700, color: C.onSurface }}>Email:</span> {from.email}</div>}
                {from.phone && <div><span style={{ fontWeight: 700, color: C.onSurface }}>Phone:</span> {from.phone}</div>}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, background: 'rgba(220,225,255,0.35)', border: '1px solid rgba(182,196,255,0.5)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.primaryContainer, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primaryContainer, display: 'inline-block' }} /> Billed To
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, marginBottom: 6 }}>{invoice.client_name || '—'}</div>
          <div style={body}>
            {clientAddress.length ? clientAddress.map((line, i) => <div key={i}>{line}</div>) : <div>—</div>}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(182,196,255,0.5)' }}>
              {invoice.client_gstin && gstEnabled && <div><span style={{ fontWeight: 700, color: C.onSurface }}>GSTIN:</span> {invoice.client_gstin}</div>}
              {invoice.contact_person && <div><span style={{ fontWeight: 700, color: C.onSurface }}>Attn:</span> {invoice.contact_person}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ position: 'relative', marginBottom: 22, border: `1px solid ${C.variant}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.containerLow }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.variant}` }}>Description</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.variant}` }}>Qty</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.variant}` }}>Rate (₹)</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.variant}` }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < lineItems.length - 1 ? `1px solid ${C.variant}` : 'none' }}>
                <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.onSurface }}>{item.description}</div>
                  {item.service && item.description !== item.service && <div style={{ fontSize: 10, color: C.onSurfaceVariant, marginTop: 2 }}>{item.service}</div>}
                  {item.note && <div style={{ fontSize: 10, color: C.onSurfaceVariant, marginTop: 2 }}>{item.note}</div>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: C.onSurface }}>{item.qty}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: C.onSurface }}>{fmtCurrency(item.rate)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.onSurface }}>{fmtCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1, background: C.bright, borderRadius: 8, border: `1px solid ${C.variant}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.primaryContainer, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.variant}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>account_balance_wallet</span> Payment Details
          </div>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {from.bank_name && <tr><td style={{ padding: '2px 8px 2px 0', fontWeight: 700, color: C.onSurface }}>Bank Name:</td><td style={{ color: C.onSurfaceVariant }}>{from.bank_name}</td></tr>}
              {from.account_name && <tr><td style={{ padding: '2px 8px 2px 0', fontWeight: 700, color: C.onSurface }}>Account Name:</td><td style={{ color: C.onSurfaceVariant }}>{from.account_name}</td></tr>}
              {from.account_number && <tr><td style={{ padding: '2px 8px 2px 0', fontWeight: 700, color: C.onSurface }}>Account No:</td><td style={{ color: C.onSurfaceVariant }}>{from.account_number}</td></tr>}
              {from.ifsc && <tr><td style={{ padding: '2px 8px 2px 0', fontWeight: 700, color: C.onSurface }}>IFSC Code:</td><td style={{ color: C.onSurfaceVariant }}>{from.ifsc}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, background: 'rgba(220,225,255,0.25)', borderRadius: 8, border: '1px solid rgba(182,196,255,0.35)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11.5 }}>
            <span style={{ color: C.onSurfaceVariant }}>Subtotal</span>
            <span style={{ fontWeight: 600, color: C.onSurface }}>₹ {fmtCurrency(subtotal)}</span>
          </div>
          {gstEnabled && (isSameState ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11.5 }}>
                <span style={{ color: C.onSurfaceVariant }}>CGST ({gstRate / 2}%)</span>
                <span style={{ fontWeight: 600, color: C.onSurface }}>₹ {fmtCurrency(halfGst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 11.5 }}>
                <span style={{ color: C.onSurfaceVariant }}>SGST ({gstRate / 2}%)</span>
                <span style={{ fontWeight: 600, color: C.onSurface }}>₹ {fmtCurrency(halfGst)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 11.5 }}>
              <span style={{ color: C.onSurfaceVariant }}>IGST ({gstRate}%)</span>
              <span style={{ fontWeight: 600, color: C.onSurface }}>₹ {fmtCurrency(gstAmount)}</span>
            </div>
          ))}
          <div style={{ borderTop: `2px solid ${C.primaryContainer}33`, marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.primaryContainer, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Grand Total</div>
              <div style={{ fontSize: 9, color: C.onSurfaceVariant }}>Amount in INR</div>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.primaryContainer, letterSpacing: '-0.02em' }}>₹ {fmtCurrency(total)}</span>
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.primaryContainer}1a`, textAlign: 'right', fontSize: 9.5, fontStyle: 'italic', color: C.primaryContainer }}>
            Amount in words: {amountInWords(total)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', borderTop: `1px solid ${C.variant}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ fontSize: 11, color: C.onSurfaceVariant }}>
          <div style={{ fontWeight: 700, color: C.onSurface, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 6 }}>Terms &amp; Conditions</div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ color: C.primaryContainer }}>•</span><span>Please pay within 15 days from the date of invoice.</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 140, height: 44, borderBottom: `2px solid ${C.onSurfaceVariant}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, marginBottom: 6 }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: C.onSurface, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Authorized Signatory</div>
          <div style={{ fontSize: 8.5, color: C.onSurfaceVariant, marginTop: 2 }}>{from.name}</div>
        </div>
      </div>
    </div>
  );
}
