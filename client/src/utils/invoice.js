export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineItemFrom(raw) {
  const qty = Number(raw.qty) || 1;
  const rate = Number(raw.rate) || 0;
  return {
    service: raw.service || '',
    description: raw.description || raw.service || '',
    note: raw.note || '',
    qty,
    rate,
    amount: Number(raw.amount) || qty * rate,
  };
}

export function parseLineItems(notes, fallbackAmount) {
  if (!notes) return null;
  try {
    const p = JSON.parse(notes);
    if (p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.items) && p.items.length) {
      return p.items.map(lineItemFrom);
    }
    if (Array.isArray(p) && p.length && p[0].description !== undefined) {
      return p.map(lineItemFrom);
    }
  } catch {
    /* ignore */
  }
  return null;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (h) out += ONES[h] + ' Hundred';
  if (rest) out += (out ? ' ' : '') + twoDigits(rest);
  return out;
}

// Indian numbering system: ... Crore, Lakh, Thousand, Hundred
export function numberToWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function amountInWords(amount) {
  const total = Number(amount) || 0;
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  let out = `${numberToWords(rupees)} Rupees`;
  if (paise > 0) out += ` and ${numberToWords(paise)} Paise`;
  return out + ' Only';
}
