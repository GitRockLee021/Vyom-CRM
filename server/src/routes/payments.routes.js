import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card'];

async function syncInvoiceStatus(invoiceId, tenantId) {
  const invRes = await query('SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2', [
    invoiceId,
    tenantId,
  ]);
  const invoice = invRes.rows[0];
  if (!invoice) return null;

  const totals = await query(
    'SELECT COALESCE(SUM(amount), 0)::numeric AS paid FROM payments WHERE invoice_id = $1 AND tenant_id = $2',
    [invoice.id, tenantId]
  );
  const totalDue = Number(invoice.amount) * (1 + Number(invoice.gst_rate) / 100);
  const newPaid = Number(totals.rows[0].paid);

  let status = invoice.status;
  if (newPaid >= totalDue) {
    if (invoice.status !== 'paid') {
      await query(
        "UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2",
        [invoice.id, tenantId]
      );
      status = 'paid';
    }
  } else if (invoice.status === 'paid') {
    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
    const backTo = isOverdue ? 'overdue' : 'sent';
    await query(
      'UPDATE invoices SET status = $1, paid_at = NULL, updated_at = now() WHERE id = $2 AND tenant_id = $3',
      [backTo, invoice.id, tenantId]
    );
    status = backTo;
  }
  return status;
}

// GET /api/payments — list all payments for the tenant, with invoice + client info
router.get('/', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const { search, method } = req.query;
    const conditions = ['p.tenant_id = $1'];
    const params = [req.user.tenant_id];

    if (method) {
      params.push(method);
      conditions.push(`p.method = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      conditions.push(`(c.name ILIKE ${p} OR i.invoice_number ILIKE ${p} OR p.reference_no ILIKE ${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.*, i.invoice_number, i.amount AS invoice_amount, i.gst_rate,
              c.name AS client_name, c.id AS client_id, c.phone AS client_phone
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN clients c ON c.id = i.client_id
       ${where}
       ORDER BY p.paid_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id — single payment with invoice + client context
router.get('/:id', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, i.invoice_number, i.amount AS invoice_amount, i.gst_rate,
              i.due_date, i.status AS invoice_status, c.name AS client_name, c.id AS client_id,
              (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2 WHERE p2.invoice_id = p.invoice_id) AS invoice_paid
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN clients c ON c.id = i.client_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) throw httpError(404, 'Payment not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/payments/:id — edit a payment (optionally move it to another invoice)
// and re-sync the status of the affected invoices
router.put('/:id', requirePerm('billing.record_payment'), async (req, res, next) => {
  try {
    const { amount, method, reference_no, paid_at, invoice_id } = req.body || {};

    const current = await query('SELECT * FROM payments WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    const payment = current.rows[0];
    if (!payment) throw httpError(404, 'Payment not found');

    const nextAmount = amount !== undefined ? Number(amount) : Number(payment.amount);
    if (!nextAmount || nextAmount <= 0) throw httpError(400, 'amount must be a positive number');
    if (method !== undefined && !METHODS.includes(method)) {
      throw httpError(400, `method must be one of: ${METHODS.join(', ')}`);
    }

    let nextInvoiceId = payment.invoice_id;
    if (invoice_id && invoice_id !== payment.invoice_id) {
      const invCheck = await query('SELECT id FROM invoices WHERE id = $1 AND tenant_id = $2', [
        invoice_id,
        req.user.tenant_id,
      ]);
      if (!invCheck.rows[0]) throw httpError(400, 'Invoice not found for this workspace');
      nextInvoiceId = invCheck.rows[0].id;
    }

    const updated = await query(
      `UPDATE payments
         SET amount = $1,
             method = $2,
             reference_no = $3,
             paid_at = COALESCE($4::timestamptz, paid_at),
             invoice_id = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        nextAmount,
        method !== undefined ? method : payment.method,
        reference_no !== undefined ? reference_no : payment.reference_no,
        paid_at !== undefined ? paid_at : null,
        nextInvoiceId,
        req.params.id,
        req.user.tenant_id,
      ]
    );

    let invoiceStatus = null;
    if (nextInvoiceId !== payment.invoice_id) {
      await syncInvoiceStatus(payment.invoice_id, req.user.tenant_id);
    }
    invoiceStatus = await syncInvoiceStatus(nextInvoiceId, req.user.tenant_id);

    res.json({ payment: updated.rows[0], invoice_status: invoiceStatus });
  } catch (err) {
    next(err);
  }
});

export default router;
