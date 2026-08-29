import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { assertUserInTenant } from '../utils/member-check.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const STATUSES = ['pending', 'awaiting_documents', 'in_progress', 'under_review', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high'];

const ALLOWED_FIELDS = [
  'client_id', 'service_id', 'title', 'period', 'status',
  'priority', 'due_date', 'fee', 'assigned_to', 'completed_at',
];

const BASE_SELECT = `
  SELECT e.*,
         c.name  AS client_name,
         s.name  AS service_name,
         s.code  AS service_code
  FROM engagements e
  JOIN clients  c ON c.id = e.client_id
  JOIN services s ON s.id = e.service_id
`;

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validate(data, { partial = false } = {}) {
  if (!partial && (!data.client_id || !data.service_id || !data.title?.trim())) {
    throw httpError(400, 'client_id, service_id and title are required');
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw httpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }
  if (data.priority && !PRIORITIES.includes(data.priority)) {
    throw httpError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }
}

// GET /api/engagements?client_id=&status=&assigned_to=
router.get('/', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const { client_id, status, assigned_to } = req.query;
    const conditions = [];
    const params = [req.user.tenant_id];

    conditions.push('e.tenant_id = $1');
    for (const [field, value] of [['client_id', client_id], ['status', status], ['assigned_to', assigned_to]]) {
      if (value) {
        params.push(value);
        conditions.push(`e.${field} = $${params.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `${BASE_SELECT} ${where} ORDER BY e.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/engagements/:id
router.get('/:id', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const { rows } = await query(`${BASE_SELECT} WHERE e.id = $1 AND e.tenant_id = $2`, [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rows[0]) throw httpError(404, 'Engagement not found');
    const engagement = rows[0];

    const tasks = await query(
      'SELECT * FROM tasks WHERE engagement_id = $1 AND tenant_id = $2 ORDER BY created_at',
      [engagement.id, req.user.tenant_id]
    );
    engagement.tasks = tasks.rows;
    res.json(engagement);
  } catch (err) {
    next(err);
  }
});

// POST /api/engagements
router.post('/', requirePerm('engagements.create'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);

    // Verify referenced rows exist AND belong to the caller's tenant.
    const client = await query('SELECT id FROM clients WHERE id = $1 AND tenant_id = $2', [
      data.client_id,
      req.user.tenant_id,
    ]);
    if (!client.rows[0]) throw httpError(400, 'client_id does not exist');
    const service = await query('SELECT id FROM services WHERE id = $1 AND tenant_id = $2', [
      data.service_id,
      req.user.tenant_id,
    ]);
    if (!service.rows[0]) throw httpError(400, 'service_id does not exist');
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    data.tenant_id = req.user.tenant_id;
    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const inserted = await query(
      `INSERT INTO engagements (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );

    const { rows } = await query(
      `${BASE_SELECT} WHERE e.id = $1 AND e.tenant_id = $2`,
      [inserted.rows[0].id, req.user.tenant_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/engagements/:id
router.put('/:id', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data, { partial: true });
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id, req.user.tenant_id];

    const updated = await query(
      `UPDATE engagements SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING id`,
      values
    );
    if (!updated.rows[0]) throw httpError(404, 'Engagement not found');

    const { rows } = await query(
      `${BASE_SELECT} WHERE e.id = $1 AND e.tenant_id = $2`,
      [updated.rows[0].id, req.user.tenant_id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/engagements/:id
router.delete('/:id', requirePerm('engagements.delete'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM engagements WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Engagement not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
