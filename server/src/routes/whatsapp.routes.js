import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requirePerm } from '../middleware/auth.middleware.js';
import {
  isWhatsAppConfigured,
  resolveConfig,
  configSource,
  normalizePhone,
  sendTemplate,
  templateComponents,
  testConnection,
  listTemplates,
  maskSecret,
} from '../utils/whatsapp.js';

const router = Router();

const FORMATTER = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatInr(n) {
  return `\u20B9${FORMATTER.format(Number(n) || 0)}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function companyName(row) {
  return (row?.company_name || '').trim() || 'Vyom CRM';
}

async function settingsRow(tenantId) {
  const { rows } = await query('SELECT company_name FROM settings WHERE tenant_id = $1 LIMIT 1', [tenantId]);
  return rows[0] || {};
}

async function waSettingsRow(tenantId) {
  const { rows } = await query(
    'SELECT wa_access_token, wa_phone_number_id, wa_graph_version FROM settings WHERE tenant_id = $1 LIMIT 1',
    [tenantId],
  );
  return rows[0] || {};
}

async function logMessage({ tenantId, waMessageId, phone, clientId, templateName, body, status, error }) {
  const { rows } = await query(
    `INSERT INTO wa_messages (tenant_id, direction, wa_message_id, phone_number, client_id, template_name, body, status, error)
     VALUES ($1, 'outbound', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [tenantId, waMessageId, phone, clientId, templateName, body, status, error]
  );
  return rows[0].id;
}

function assertPhone(clientName, phone) {
  if (!phone) {
    throw httpError(400, `No phone number on record for client "${clientName}". Add one to send WhatsApp messages.`);
  }
}

function assertText(text) {
  const value = String(text || '').trim();
  if (!value) throw httpError(400, 'Message text is required');
  if (value.length > 500) throw httpError(400, 'Message text is too long (max 500 characters)');
  return value;
}

// GET /api/whatsapp/config — tells the UI whether live sending is wired up.
router.get('/config', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const row = await waSettingsRow(req.user.tenant_id);
    const config = resolveConfig(row);
    res.json({
      configured: isWhatsAppConfigured(config),
      mode: isWhatsAppConfigured(config) ? 'live' : 'dev',
      from: configSource(row),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/settings — WhatsApp connection settings for the tenant.
router.get('/settings', requirePerm('settings.view'), async (req, res, next) => {
  try {
    const row = await waSettingsRow(req.user.tenant_id);
    const config = resolveConfig(row);
    res.json({
      access_token_masked: maskSecret(row.wa_access_token),
      phone_number_id: row.wa_phone_number_id || config.phoneNumberId,
      graph_version: config.graphVersion,
      configured: isWhatsAppConfigured(config),
      mode: isWhatsAppConfigured(config) ? 'live' : 'dev',
      from: configSource(row),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/whatsapp/settings — save WhatsApp credentials.
// Leave access_token blank to keep the stored one; pass clear_token to wipe it.
router.put('/settings', requirePerm('settings.edit'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const body = req.body || {};
    const existing = await waSettingsRow(tenantId);

    const token = String(body.access_token || '').trim();
    const keepToken = token || (body.clear_token ? '' : existing.wa_access_token || '');
    const phoneNumberId = String(body.phone_number_id || '').trim();
    const graphVersion = String(body.graph_version || existing.wa_graph_version || 'v21.0').trim();

    const upsert = await query('SELECT id FROM settings WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (upsert.rows.length) {
      await query(
        `UPDATE settings
         SET wa_access_token = $2, wa_phone_number_id = $3, wa_graph_version = $4, updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId, keepToken, phoneNumberId, graphVersion],
      );
    } else {
      await query(
        `INSERT INTO settings (tenant_id, wa_access_token, wa_phone_number_id, wa_graph_version)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, keepToken, phoneNumberId, graphVersion],
      );
    }

    res.json({
      ok: true,
      configured: Boolean(keepToken && phoneNumberId),
      access_token_masked: maskSecret(keepToken),
      phone_number_id: phoneNumberId,
      graph_version: graphVersion,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/test — verify the connection and report on templates.
router.post('/test', requirePerm('settings.edit'), async (req, res, next) => {
  try {
    const row = await waSettingsRow(req.user.tenant_id);
    const config = resolveConfig(row);
    if (!isWhatsAppConfigured(config)) {
      return res.json({ ok: false, dev: true, message: 'Add your WhatsApp credentials to connect your Meta account.' });
    }
    try {
      const info = await testConnection(config);
      const templates = await listTemplates(config).catch(() => null);
      res.json({
        ok: true,
        business: info.verified_name || null,
        phone: info.display_phone_number || null,
        tier: info.messaging_product_tier || null,
        templates: templates?.templates || [],
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/messages — outbound WhatsApp message log.
router.get('/messages', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { rows: messages } = await query(
      `SELECT m.id, m.direction, m.wa_message_id, m.phone_number, m.client_id,
              COALESCE(c.name, '') AS client_name,
              m.template_name, m.body, m.status, m.error, m.created_at
       FROM wa_messages m
       LEFT JOIN clients c ON c.id = m.client_id
       WHERE m.tenant_id = $1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.tenant_id, limit, offset]
    );
    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS total FROM wa_messages WHERE tenant_id = $1',
      [req.user.tenant_id]
    );
    res.json({ messages, total: countRows[0]?.total || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/send-invoice — send invoice_notice template for an invoice.
router.post('/send-invoice', requirePerm('billing.edit'), async (req, res, next) => {
  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) throw httpError(400, 'invoice_id is required');

    const { rows } = await query(
      `SELECT i.invoice_number, i.amount, i.gst_rate, i.due_date, i.status AS invoice_status,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [invoice_id, req.user.tenant_id]
    );
    const inv = rows[0];
    if (!inv) throw httpError(404, 'Invoice not found');

    const phone = normalizePhone(inv.client_phone);
    assertPhone(inv.client_name, phone || inv.client_phone);

    const settings = await settingsRow(req.user.tenant_id);
    const total = formatInr(Number(inv.amount) * (1 + Number(inv.gst_rate || 0) / 100));
    const due = formatDate(inv.due_date);
    const company = companyName(settings);
    const body = `Invoice ${inv.invoice_number} for ${total}${due ? ` due on ${due}` : ''}.`;

    const config = resolveConfig(await waSettingsRow(req.user.tenant_id));

    let result;
    try {
      result = await sendTemplate({
        config,
        to: phone,
        templateName: 'invoice_notice',
        components: templateComponents([inv.client_name, inv.invoice_number, total, due, company]),
      });
    } catch (err) {
      await logMessage({
        tenantId: req.user.tenant_id,
        phone,
        clientId: inv.client_id,
        templateName: 'invoice_notice',
        body,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }

    if (inv.invoice_status === 'draft') {
      await query("UPDATE invoices SET status = 'sent' WHERE id = $1 AND tenant_id = $2", [
        invoice_id,
        req.user.tenant_id,
      ]);
    }

    const waMessageId = result?.messages?.[0]?.id || null;
    await logMessage({
      tenantId: req.user.tenant_id,
      waMessageId,
      phone,
      clientId: inv.client_id,
      templateName: 'invoice_notice',
      body,
      status: waMessageId ? 'sent' : 'pending',
    });

    res.json({
      ok: true,
      dev: Boolean(result?.dev),
      message: result?.dev
        ? 'Dev mode: invoice message logged, not actually sent.'
        : `Invoice ${inv.invoice_number} sent to ${inv.client_name} on WhatsApp.`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/send-reminder — send overdue_payment_reminder template for an invoice.
router.post('/send-reminder', requirePerm('billing.edit'), async (req, res, next) => {
  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) throw httpError(400, 'invoice_id is required');

    const { rows } = await query(
      `SELECT i.invoice_number, i.amount, i.gst_rate, i.due_date,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [invoice_id, req.user.tenant_id]
    );
    const inv = rows[0];
    if (!inv) throw httpError(404, 'Invoice not found');

    const phone = normalizePhone(inv.client_phone);
    assertPhone(inv.client_name, phone || inv.client_phone);

    const settings = await settingsRow(req.user.tenant_id);
    const total = formatInr(Number(inv.amount) * (1 + Number(inv.gst_rate || 0) / 100));
    const due = formatDate(inv.due_date);
    const company = companyName(settings);
    const body = `Overdue reminder for invoice ${inv.invoice_number} (${total})`;

    const config = resolveConfig(await waSettingsRow(req.user.tenant_id));

    let result;
    try {
      result = await sendTemplate({
        config,
        to: phone,
        templateName: 'overdue_payment_reminder',
        components: templateComponents([inv.client_name, inv.invoice_number, total, due, company]),
      });
    } catch (err) {
      await logMessage({
        tenantId: req.user.tenant_id,
        phone,
        clientId: inv.client_id,
        templateName: 'overdue_payment_reminder',
        body,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }

    const waMessageId = result?.messages?.[0]?.id || null;
    await logMessage({
      tenantId: req.user.tenant_id,
      waMessageId,
      phone,
      clientId: inv.client_id,
      templateName: 'overdue_payment_reminder',
      body,
      status: waMessageId ? 'sent' : 'pending',
    });

    res.json({
      ok: true,
      dev: Boolean(result?.dev),
      message: result?.dev
        ? 'Dev mode: reminder logged, not actually sent.'
        : `Overdue reminder for ${inv.invoice_number} sent to ${inv.client_name} on WhatsApp.`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/send-payment-confirmation — send payment_confirmation template.
router.post('/send-payment-confirmation', requirePerm('billing.record_payment'), async (req, res, next) => {
  try {
    const { payment_id } = req.body || {};
    if (!payment_id) throw httpError(400, 'payment_id is required');

    const { rows } = await query(
      `SELECT p.amount, i.invoice_number,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN clients c ON c.id = i.client_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [payment_id, req.user.tenant_id]
    );
    const pmt = rows[0];
    if (!pmt) throw httpError(404, 'Payment not found');

    const phone = normalizePhone(pmt.client_phone);
    assertPhone(pmt.client_name, phone || pmt.client_phone);

    const settings = await settingsRow(req.user.tenant_id);
    const amount = formatInr(pmt.amount);
    const company = companyName(settings);
    const body = `Payment confirmation of ${amount} for invoice ${pmt.invoice_number}`;

    const config = resolveConfig(await waSettingsRow(req.user.tenant_id));

    let result;
    try {
      result = await sendTemplate({
        config,
        to: phone,
        templateName: 'payment_confirmation',
        components: templateComponents([pmt.client_name, amount, pmt.invoice_number, company]),
      });
    } catch (err) {
      await logMessage({
        tenantId: req.user.tenant_id,
        phone,
        clientId: pmt.client_id,
        templateName: 'payment_confirmation',
        body,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }

    const waMessageId = result?.messages?.[0]?.id || null;
    await logMessage({
      tenantId: req.user.tenant_id,
      waMessageId,
      phone,
      clientId: pmt.client_id,
      templateName: 'payment_confirmation',
      body,
      status: waMessageId ? 'sent' : 'pending',
    });

    res.json({
      ok: true,
      dev: Boolean(result?.dev),
      message: result?.dev
        ? 'Dev mode: payment confirmation logged, not actually sent.'
        : `Payment confirmation sent to ${pmt.client_name} on WhatsApp.`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/send-message — send a custom client_message template.
router.post('/send-message', requirePerm('billing.edit'), async (req, res, next) => {
  try {
    const { client_id, text } = req.body || {};
    if (!client_id) throw httpError(400, 'client_id is required');
    const message = assertText(text);

    const { rows } = await query(
      'SELECT id AS client_id, name AS client_name, phone AS client_phone FROM clients WHERE id = $1 AND tenant_id = $2',
      [client_id, req.user.tenant_id]
    );
    const client = rows[0];
    if (!client) throw httpError(404, 'Client not found');

    const phone = normalizePhone(client.client_phone);
    assertPhone(client.client_name, phone || client.client_phone);

    const settings = await settingsRow(req.user.tenant_id);
    const company = companyName(settings);

    const config = resolveConfig(await waSettingsRow(req.user.tenant_id));

    let result;
    try {
      result = await sendTemplate({
        config,
        to: phone,
        templateName: 'client_message',
        components: templateComponents([client.client_name, message, company]),
      });
    } catch (err) {
      await logMessage({
        tenantId: req.user.tenant_id,
        phone,
        clientId: client.client_id,
        templateName: 'client_message',
        body: message,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }

    const waMessageId = result?.messages?.[0]?.id || null;
    await logMessage({
      tenantId: req.user.tenant_id,
      waMessageId,
      phone,
      clientId: client.client_id,
      templateName: 'client_message',
      body: message,
      status: waMessageId ? 'sent' : 'pending',
    });

    res.json({
      ok: true,
      dev: Boolean(result?.dev),
      message: result?.dev
        ? 'Dev mode: message logged, not actually sent.'
        : `Message sent to ${client.client_name} on WhatsApp.`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;