import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';

const router = Router();

const ALLOWED_FIELDS = [
  'client_type', 'name', 'contact_person', 'email', 'phone',
  'gstin', 'pan', 'tan',
  'address_line1', 'address_line2', 'city', 'state', 'pincode',
  'status', 'notes', 'assigned_to',
];

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

const CLIENT_TYPES = ['individual', 'proprietor', 'partnership', 'private_limited', 'llp', 'others', 'business'];

function validate(data, { partial = false } = {}) {
  if (!partial && !data.name?.trim()) {
    throw httpError(400, 'name is required');
  }
  if (data.client_type && !CLIENT_TYPES.includes(data.client_type)) {
    throw httpError(400, `client_type must be one of: ${CLIENT_TYPES.join(', ')}`);
  }
  if (data.status && !['prospect', 'active', 'inactive'].includes(data.status)) {
    throw httpError(400, 'status must be prospect, active or inactive');
  }
  if (data.email === '') data.email = null;
  if (data.gstin === '') data.gstin = null;
}

// GET /api/clients?status=&type=&search=&tenant_id=
router.get('/', async (req, res, next) => {
  try {
    const { status, type, search, tenant_id } = req.query;
    const conditions = [];
    const params = [];

    if (tenant_id) {
      params.push(tenant_id);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`client_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      conditions.push(`(name ILIKE ${p} OR email ILIKE ${p} OR phone ILIKE ${p} OR gstin ILIKE ${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM clients ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw httpError(404, 'Client not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/clients
router.post('/', async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const { rows } = await query(
      `INSERT INTO clients (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data, { partial: true });

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id];

    const { rows } = await query(
      `UPDATE clients SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) throw httpError(404, 'Client not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    if (!rowCount) throw httpError(404, 'Client not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
