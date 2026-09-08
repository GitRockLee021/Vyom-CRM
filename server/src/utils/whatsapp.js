const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

const isDev = !ACCESS_TOKEN || !PHONE_NUMBER_ID;

export function isWhatsAppConfigured() {
  return !isDev;
}

export function isWhatsAppDevMode() {
  return isDev;
}

export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 13 && digits.startsWith('91') && digits[2] === '0') {
    return digits.slice(0, 2) + digits.slice(3);
  }
  return digits;
}

function graphErrorHint(templateName, message) {
  const msg = String(message || '');
  if (/131030/i.test(msg) || /not opted in|has not.*whatsapp|invalid.*phone/i.test(msg)) {
    return 'This number is not active on WhatsApp or has not opted in yet.';
  }
  if (/template/i.test(msg)) {
    return `Meta rejected template "${templateName}" (${msg}). Check that it exists and is approved and that placeholders match.`;
  }
  if (/token|auth/i.test(msg)) {
    return 'WhatsApp API authentication failed. Verify META_ACCESS_TOKEN and META_PHONE_NUMBER_ID.';
  }
  return msg;
}

export function templateComponents(values) {
  return [
    {
      type: 'body',
      parameters: values.map((text) => ({ type: 'text', text: String(text) })),
    },
  ];
}

async function callGraph(body) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      graphErrorHint(body?.template?.name || '', json?.error?.message || `WhatsApp API error (${res.status})`)
    );
  }
  return json;
}

export async function sendTemplate({ to, templateName, language = 'en', components = [] }) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Invalid recipient phone number');

  if (isDev) {
    console.log(`[whatsapp] dev mode (credentials not set) — would send template "${templateName}" to ${phone}`);
    console.log(`[whatsapp] body parameters: ${JSON.stringify(components)}`);
    return { dev: true, messages: [{ id: `dev-${Date.now()}` }] };
  }

  return callGraph({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: { name: templateName, language: { code: language }, components },
  });
}

export async function sendText({ to, text }) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Invalid recipient phone number');

  if (isDev) {
    console.log(`[whatsapp] dev mode — would send text to ${phone}: ${text}`);
    return { dev: true, messages: [{ id: `dev-${Date.now()}` }] };
  }

  return callGraph({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}