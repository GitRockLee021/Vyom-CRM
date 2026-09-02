import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card'];

const ALLOWED_FIELDS = [
  'client_id', 'engagement_id', 'amount', 'gst_rate',
  'status', 'issued_date', 'due_date', 'notes',
];

const BASE_SELECT = `
  SELECT i.*, c.name AS client_name,
         c.contact_person, c.email AS client_email, c.phone AS client_phone,
         c.gstin AS client_gstin, c.pan AS client_pan,
         c.address_line1, c.address_line2, c.city, c.state, c.pincode,
         COALESCE(p.paid_amount, 0) AS paid_amount
  FROM invoices i
  JOIN clients c ON c.id = i.client_id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) AS paid_amount
    FROM payments GROUP BY invoice_id
  ) p ON p.invoice_id = i.id
`;

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validate(data, { partial = false } = {}) {
  if (!partial && (!data.client_id || data.amount === undefined)) {
    throw httpError(400, 'client_id and amount are required');
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw httpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }
}

async function nextInvoiceNumber(tenantId) {
  const year = new Date().getFullYear();

  const prefixRes = await query(
    'SELECT invoice_prefix FROM settings WHERE tenant_id = $1 LIMIT 1',
    [tenantId],
  );
  const rawPrefix = (prefixRes.rows[0]?.invoice_prefix || 'VY-').trim();
  const prefix = `${rawPrefix}${rawPrefix.endsWith('-') ? '' : '-'}`;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM invoices
     WHERE tenant_id = $1 AND invoice_number LIKE $2`,
    [tenantId, `${prefix}${year}-%`],
  );
  const seq = String(rows[0].count + 1).padStart(4, '0');
  return `${prefix}${year}-${seq}`;
}

// GET /api/invoices/next-number
router.get('/next-number', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const num = await nextInvoiceNumber(req.user.tenant_id);
    res.json({ invoice_number: num });
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices?client_id=&status=&search=
// Always scoped to the authenticated user's tenant.
router.get('/', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const { client_id, status, search } = req.query;
    const conditions = [];
    const params = [req.user.tenant_id];

    conditions.push('i.tenant_id = $1');
    if (client_id) {
      params.push(client_id);
      conditions.push(`i.client_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      conditions.push(`(c.name ILIKE ${p} OR i.invoice_number ILIKE ${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `${BASE_SELECT} ${where} ORDER BY i.issued_date DESC, i.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id (includes payment history)
router.get('/:id', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const { rows } = await query(`${BASE_SELECT} WHERE i.id = $1 AND i.tenant_id = $2`, [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rows[0]) throw httpError(404, 'Invoice not found');

    const payments = await query(
      'SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY paid_at DESC',
      [req.params.id, req.user.tenant_id]
    );
    rows[0].payments = payments.rows;
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', requirePerm('billing.create'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);

    const client = await query('SELECT id FROM clients WHERE id = $1 AND tenant_id = $2', [
      data.client_id,
      req.user.tenant_id,
    ]);
    if (!client.rows[0]) throw httpError(400, 'client_id does not exist');

    const invoiceNumber = await nextInvoiceNumber(req.user.tenant_id);

    data.tenant_id = req.user.tenant_id;
    const keys = Object.keys(data);
    const placeholders = ['$1', ...keys.map((_, i) => `$${i + 2}`)];
    const values = [invoiceNumber, ...Object.values(data)];

    const inserted = await query(
      `INSERT INTO invoices (invoice_number${keys.length ? ', ' : ''}${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );

    const { rows } = await query(
      `${BASE_SELECT} WHERE i.id = $1 AND i.tenant_id = $2`,
      [inserted.rows[0].id, req.user.tenant_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/invoices/:id
router.put('/:id', requirePerm('billing.edit'), async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT status FROM invoices WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id]
    );
    if (!existing.rows[0]) throw httpError(404, 'Invoice not found');
    if (existing.rows[0].status === 'paid') {
      throw httpError(409, 'Paid invoices cannot be edited');
    }

    const data = pickFields(req.body || {});
    validate(data, { partial: true });

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id, req.user.tenant_id];

    const updated = await query(
      `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING id`,
      values
    );
    if (!updated.rows[0]) throw httpError(404, 'Invoice not found');

    const { rows } = await query(
      `${BASE_SELECT} WHERE i.id = $1 AND i.tenant_id = $2`,
      [updated.rows[0].id, req.user.tenant_id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', requirePerm('billing.delete'), async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT status FROM invoices WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id]
    );
    if (!existing.rows[0]) throw httpError(404, 'Invoice not found');
    if (existing.rows[0].status === 'paid') {
      throw httpError(409, 'Paid invoices cannot be deleted');
    }

    const { rowCount } = await query('DELETE FROM invoices WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Invoice not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/payments — record a payment, auto-set status to paid when settled
router.post('/:id/payments', requirePerm('billing.record_payment'), async (req, res, next) => {
  try {
    const { amount, method = 'bank_transfer', reference_no = null, paid_at = null } = req.body || {};
    if (!amount || Number(amount) <= 0) throw httpError(400, 'amount must be a positive number');
    if (!PAYMENT_METHODS.includes(method)) {
      throw httpError(400, `method must be one of: ${PAYMENT_METHODS.join(', ')}`);
    }

    const invoices = await query('SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    const invoice = invoices.rows[0];
    if (!invoice) throw httpError(404, 'Invoice not found');

    const totals = await query(
      'SELECT COALESCE(SUM(amount), 0)::numeric AS paid FROM payments WHERE invoice_id = $1 AND tenant_id = $2',
      [invoice.id, req.user.tenant_id]
    );
    const totalDue = Number(invoice.amount) * (1 + Number(invoice.gst_rate) / 100);
    const newPaid = Number(totals.rows[0].paid) + Number(amount);

    const inserted = await query(
      `INSERT INTO payments (invoice_id, tenant_id, amount, method, reference_no, paid_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
       RETURNING *`,
      [invoice.id, req.user.tenant_id, amount, method, reference_no, paid_at]
    );

    let updatedStatus = null;
    if (newPaid >= totalDue && invoice.status !== 'paid') {
      await query(
        "UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND tenant_id = $2",
        [invoice.id, req.user.tenant_id]
      );
      updatedStatus = 'paid';
    }

    res.status(201).json({ payment: inserted.rows[0], invoice_status: updatedStatus });
  } catch (err) {
    next(err);
  }
});

export default router;
