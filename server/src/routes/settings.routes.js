import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';

const router = Router();

const TENANT_ID = 1;

const FIELDS = [
  'company_name', 'logo_url', 'address', 'state', 'phone', 'email', 'pan', 'gst', 'invoice_prefix',
  'bank_name', 'account_name', 'account_number', 'ifsc',
];

const TEXT_FIELDS = ['company_name', 'address', 'phone', 'email', 'tax_id', 'invoice_prefix', 'logo_url'];

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${FIELDS.join(', ')} FROM settings WHERE tenant_id = $1 LIMIT 1`,
      [TENANT_ID],
    );
    if (!rows.length) {
      return res.json({
        company_name: '', logo_url: '', address: '', state: '', phone: '',
        email: '', pan: '', gst: '', invoice_prefix: 'INV-',
        bank_name: '', account_name: '', account_number: '', ifsc: '',
      });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const data = {};
    for (const field of FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (!Object.keys(data).length) {
      throw httpError(400, 'No settings fields provided');
    }

    const existing = await query(
      'SELECT id FROM settings WHERE tenant_id = $1 LIMIT 1',
      [TENANT_ID],
    );

    if (existing.rows.length) {
      const setClauses = [];
      const values = [];
      let i = 1;
      for (const [key, val] of Object.entries(data)) {
        setClauses.push(`${key} = $${i}`);
        values.push(val);
        i += 1;
      }
      setClauses.push(`updated_at = NOW()`);
      values.push(TENANT_ID);
      await query(
        `UPDATE settings SET ${setClauses.join(', ')} WHERE tenant_id = $${i}`,
        values,
      );
    } else {
      const cols = ['tenant_id', ...Object.keys(data)];
      const vals = [TENANT_ID, ...Object.values(data)];
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
      await query(
        `INSERT INTO settings (${cols.join(', ')}) VALUES (${placeholders})`,
        vals,
      );
    }

    const { rows } = await query(
      `SELECT ${FIELDS.join(', ')} FROM settings WHERE tenant_id = $1 LIMIT 1`,
      [TENANT_ID],
    );
    res.json(rows[0] || {});
  } catch (err) {
    next(err);
  }
});

export default router;
