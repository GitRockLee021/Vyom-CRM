import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const ALLOWED_FIELDS = ['code', 'name', 'description', 'category', 'default_fee', 'is_recurring'];

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validate(data, { partial = false } = {}) {
  if (!partial && !data.name?.trim()) {
    throw httpError(400, 'name is required');
  }
}

// GET /api/services?category=
router.get('/', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const { category } = req.query;
    const params = [req.user.tenant_id];
    let where = 'WHERE tenant_id = $1';
    if (category) {
      params.push(category);
      where += ` AND category = $2`;
    }
    const { rows } = await query(
      `SELECT * FROM services ${where} ORDER BY name`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:id
router.get('/:id', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM services WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rows[0]) throw httpError(404, 'Service not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/services
router.post('/', requirePerm('engagements.create'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);
    data.tenant_id = req.user.tenant_id;

    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const { rows } = await query(
      `INSERT INTO services (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') err.status = 409;
    next(err);
  }
});

// PUT /api/services/:id
router.put('/:id', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data, { partial: true });

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id, req.user.tenant_id];

    const { rows } = await query(
      `UPDATE services SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) throw httpError(404, 'Service not found');
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') err.status = 409;
    next(err);
  }
});

// DELETE /api/services/:id
router.delete('/:id', requirePerm('engagements.delete'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM services WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Service not found');
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') {
      err.status = 409;
      err.message = 'Service is in use by existing engagements';
    }
    next(err);
  }
});

export default router;
