import { Router } from 'express';
import { query } from '../config/db.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

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
              c.name AS client_name, c.id AS client_id
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

export default router;
