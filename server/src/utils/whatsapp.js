const GRAPH_URL = 'https://graph.facebook.com';

// Build a config object from a settings row (per-tenant), falling back to
// environment variables for backwards compatibility.
export function resolveConfig(row) {
  const stored = row || {};
  const accessToken = stored.wa_access_token || process.env.META_ACCESS_TOKEN || '';
  const phoneNumberId = stored.wa_phone_number_id || process.env.META_PHONE_NUMBER_ID || '';
  const graphVersion = stored.wa_graph_version || process.env.META_GRAPH_VERSION || 'v21.0';
  return { accessToken, phoneNumberId, graphVersion };
}

export function isWhatsAppConfigured(config) {
  return Boolean(config && config.accessToken && config.phoneNumberId);
}

export function isWhatsAppDevMode(config) {
  return !isWhatsAppConfigured(config);
}

export function configSource(row) {
  return row?.wa_access_token || row?.wa_phone_number_id ? 'db' : 'env';
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

export function maskSecret(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 8) return '••••••';
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
}

function graphErrorHint(templateName, message) {
  const msg = String(message || '');
  if (/131030/i.test(msg) || /not opted in|has not.*whatsapp|invalid.*phone/i.test(msg)) {
    return 'This number is not active on WhatsApp or has not opted in yet.';
  }
  if (/template/i.test(msg)) {
    return `Meta rejected template "${templateName}" (${msg}). Check that it exists and is approved and that placeholders match.`;
  }
  if (/token|auth|authorization/i.test(msg)) {
    return 'WhatsApp API authentication failed. Verify your Access Token.';
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

async function callGraph({ config, path, qs = '', method = 'GET', body, templateName }) {
  const url = `${GRAPH_URL}/${config.graphVersion}/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      graphErrorHint(templateName || '', json?.error?.message || `WhatsApp API error (${res.status})`)
    );
  }
  return json;
}

export async function sendTemplate({ config, to, templateName, language = 'en', components = [] }) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Invalid recipient phone number');

  if (isWhatsAppDevMode(config)) {
    console.log(`[whatsapp] dev mode (credentials not set) — would send template "${templateName}" to ${phone}`);
    console.log(`[whatsapp] body parameters: ${JSON.stringify(components)}`);
    return { dev: true, messages: [{ id: `dev-${Date.now()}` }] };
  }

  return callGraph({
    config,
    path: `${config.phoneNumberId}/messages`,
    method: 'POST',
    templateName,
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: { name: templateName, language: { code: language }, components },
    },
  });
}

export async function sendText({ config, to, text }) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Invalid recipient phone number');

  if (isWhatsAppDevMode(config)) {
    console.log(`[whatsapp] dev mode — would send text to ${phone}: ${text}`);
    return { dev: true, messages: [{ id: `dev-${Date.now()}` }] };
  }

  return callGraph({
    config,
    path: `${config.phoneNumberId}/messages`,
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: text },
    },
  });
}

// Verify the token + phone number id by reading the number's profile.
export async function testConnection(config) {
  if (isWhatsAppDevMode(config)) {
    return { ok: false, dev: true, message: 'Add your WhatsApp credentials first.' };
  }
  return callGraph({
    config,
    path: config.phoneNumberId,
    qs: 'fields=id,verified_name,display_phone_number,messaging_product_tier,quality_rating',
  });
}

// List the store's approved/other message templates so the UI can flag the
// four templates the CRM needs.
export async function listTemplates(config) {
  if (isWhatsAppDevMode(config)) {
    return { dev: true, templates: [] };
  }
  const phone = await callGraph({
    config,
    path: config.phoneNumberId,
    qs: 'fields=whatsapp_business_account',
  });
  const wabaId = phone?.whatsapp_business_account?.id;
  if (!wabaId) {
    throw new Error('Could not resolve the WhatsApp Business Account for this phone number.');
  }
  const data = await callGraph({
    config,
    path: `${wabaId}/message_templates`,
    qs: 'fields=id,name,status,language,category&limit=200',
  });
  return { templates: data?.data || [] };
}