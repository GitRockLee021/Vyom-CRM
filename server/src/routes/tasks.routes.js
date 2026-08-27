import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';

const router = Router();

const STATUSES = ['todo', 'in_progress', 'done'];

const ALLOWED_FIELDS = ['title', 'description', 'engagement_id', 'assigned_to', 'status', 'due_date'];

const BASE_SELECT = `
  SELECT t.*, e.title AS engagement_title
  FROM tasks t
  LEFT JOIN engagements e ON e.id = t.engagement_id
`;

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validate(data, { partial = false } = {}) {
  if (!partial && !data.title?.trim()) {
    throw httpError(400, 'title is required');
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw httpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }
}

// GET /api/tasks?engagement_id=&assigned_to=&status=
router.get('/', async (req, res, next) => {
  try {
    const { engagement_id, assigned_to, status } = req.query;
    const conditions = [];
    const params = [];

    for (const [field, value] of [['engagement_id', engagement_id], ['assigned_to', assigned_to], ['status', status]]) {
      if (value) {
        params.push(value);
        conditions.push(`t.${field} = $${params.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `${BASE_SELECT} ${where} ORDER BY t.due_date NULLS LAST, t.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1`, [req.params.id]);
    if (!rows[0]) throw httpError(404, 'Task not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);

    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const inserted = await query(
      `INSERT INTO tasks (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );

    const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1`, [inserted.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') err.status = 400;
    next(err);
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data, { partial: true });

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id];

    const updated = await query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
      values
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');

    const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1`, [updated.rows[0].id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (!rowCount) throw httpError(404, 'Task not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
