import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { assertUserInTenant } from '../utils/member-check.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const STATUSES = ['todo', 'in_progress', 'done'];

const ALLOWED_FIELDS = [
  'title', 'description', 'engagement_id', 'assigned_to',
  'status', 'due_date', 'client_id', 'period', 'completion_note',
];

// Column to join-useful enrichment: client + service names, assignee name,
// removed-by name. Produces rows usable by the board/list/calendar views.
const BASE_SELECT = `
  SELECT
    t.*,
    cl.name AS client_name,
    svc.name AS service_name,
    e.title AS engagement_title,
    e.period AS engagement_period,
    au.full_name AS assigned_to_name,
    ru.full_name AS removed_by_name,
    cb.full_name AS completed_by_name,
    (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id = t.id)::int AS checklist_total,
    (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id = t.id AND ci.is_done)::int AS checklist_done,
    (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id)::int AS comments_count
  FROM tasks t
  LEFT JOIN clients cl ON cl.id = t.client_id
  LEFT JOIN engagements e ON e.id = t.engagement_id
  LEFT JOIN services svc ON svc.id = e.service_id
  LEFT JOIN users au ON au.id = t.assigned_to
  LEFT JOIN users ru ON ru.id = t.removed_by
  LEFT JOIN users cb ON cb.id = t.completed_by
`;

const BASE_WHERE = 't.tenant_id = $1';

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      data[field] = field === 'title' && body[field] === '' ? body[field] : body[field];
    }
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

async function logActivity(taskId, userId, action, details = null) {
  await query(
    `INSERT INTO task_activity (task_id, user_id, action, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [taskId, userId, action, details ? JSON.stringify(details) : null]
  );
}

async function fetchOne(id, tenantId) {
  const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1 AND t.tenant_id = $2`, [id, tenantId]);
  return rows[0];
}

// GET /api/tasks?status=&client_id=&service_id=&assigned_to=&scope=board|review&q=
// By default archived tasks are hidden. Pass include_archived=1 to include them.
router.get('/', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const { status, client_id, service_id, assigned_to, scope, q } = req.query;
    const conditions = [BASE_WHERE];
    const params = [req.user.tenant_id];

    for (const [field, value] of [
      ['t.status', status],
      ['t.client_id', client_id],
      ['t.assigned_to', assigned_to],
    ]) {
      if (value) {
        params.push(value);
        conditions.push(`${field} = $${params.length}`);
      }
    }
    if (service_id) {
      params.push(service_id);
      conditions.push(`e.service_id = $${params.length}`);
    }

    // scope=board  -> open (non-done) tasks grouped by status
    // scope=review -> tasks flagged for service removal
    if (scope === 'board') {
      conditions.push(`t.status <> 'done'`);
    } else if (scope === 'review') {
      conditions.push(`t.removed_at IS NOT NULL AND t.status <> 'done'`);
    }

    // Exclude archived by default.
    if (req.query.include_archived === '1') {
      // allow
    } else {
      conditions.push(`t.archived = FALSE`);
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR cl.name ILIKE $${params.length})`);
    }

    const { rows } = await query(
      `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.due_date NULLS LAST, t.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', requirePerm('engagements.view'), async (req, res, next) => {
  try {
    const task = await fetchOne(req.params.id, req.user.tenant_id);
    if (!task) throw httpError(404, 'Task not found');

    const [checklist, comments, activity] = await Promise.all([
      query(
        `SELECT * FROM task_checklist_items WHERE task_id = $1 ORDER BY position, created_at`,
        [req.params.id]
      ),
      query(
        `SELECT c.*, u.full_name AS user_name FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
        [req.params.id]
      ),
      query(
        `SELECT a.*, u.full_name AS user_name FROM task_activity a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.task_id = $1 ORDER BY a.created_at DESC`,
        [req.params.id]
      ),
    ]);

    res.json({
      ...task,
      checklist: checklist.rows,
      comments: comments.rows,
      activity: activity.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', requirePerm('engagements.create'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data);
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);
    if (data.client_id) {
      const { rowCount } = await query('SELECT 1 FROM clients WHERE id = $1 AND tenant_id = $2', [data.client_id, req.user.tenant_id]);
      if (!rowCount) throw httpError(400, 'Client not found');
    }
    data.tenant_id = req.user.tenant_id;

    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const inserted = await query(
      `INSERT INTO tasks (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );
    const task = inserted.rows[0];
    await logActivity(task.id, req.user.id, 'created', { source: 'manual' });

    if (Array.isArray(req.body?.checklist)) {
      for (let i = 0; i < req.body.checklist.length; i++) {
        if (typeof req.body.checklist[i] === 'string' && req.body.checklist[i].trim()) {
          await query(
            `INSERT INTO task_checklist_items (task_id, title, position) VALUES ($1, $2, $3)`,
            [task.id, req.body.checklist[i].trim(), i]
          );
        }
      }
    }

    const result = await fetchOne(task.id, req.user.tenant_id);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23503') err.status = 400;
    next(err);
  }
});

// PUT /api/tasks/:id
router.put('/:id', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const data = pickFields(req.body || {});
    validate(data, { partial: true });
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    // Moving to done via PUT is treated as explicit completion.
    const isCompleting = data.status === 'done';
    if (isCompleting) {
      data.completed_at = new Date().toISOString();
      data.completed_by = req.user.id;
    }

    const sets = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), req.params.id, req.user.tenant_id];

    const updated = await query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING id`,
      values
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');

    if (req.body?.title !== undefined) await logActivity(req.params.id, req.user.id, 'updated_title');
    if (isCompleting) await logActivity(req.params.id, req.user.id, 'completed');

    const result = await fetchOne(req.params.id, req.user.tenant_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/move  { status }
router.post('/:id/move', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    if (status === 'done') {
      // Removed-service tasks must be explicitly completed/archived, not dragged.
      const task = await fetchOne(req.params.id, req.user.tenant_id);
      if (!task) throw httpError(404, 'Task not found');
      if (task.removed_at) {
        throw httpError(400, 'This task has a removed service — complete it from the task detail instead');
      }
    }

    const completed_at = status === 'done' ? new Date().toISOString() : null;
    const completed_by = status === 'done' ? req.user.id : null;

    const updated = await query(
      `UPDATE tasks SET status = $1, updated_at = now(),
              completed_at = $2, completed_by = $3
       WHERE id = $4 AND tenant_id = $5 RETURNING id`,
      [status, completed_at, completed_by, req.params.id, req.user.tenant_id]
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');

    await logActivity(req.params.id, req.user.id, 'status', { to: status });
    res.json(await fetchOne(req.params.id, req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/complete  { completion_note? }
router.post('/:id/complete', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const updated = await query(
      `UPDATE tasks SET status = 'done', completed_at = now(), completed_by = $1,
              completion_note = COALESCE($2::text, completion_note), updated_at = now()
       WHERE id = $3 AND tenant_id = $4 RETURNING id`,
      [req.user.id, req.body?.completion_note || null, req.params.id, req.user.tenant_id]
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');
    await logActivity(req.params.id, req.user.id, 'completed', { note: req.body?.completion_note || null });
    res.json(await fetchOne(req.params.id, req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/archive
router.post('/:id/archive', requirePerm('engagements.delete'), async (req, res, next) => {
  try {
    const updated = await query(
      `UPDATE tasks SET archived = TRUE, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');
    await logActivity(req.params.id, req.user.id, 'archived');
    res.json(await fetchOne(req.params.id, req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/revert-service   -- clear the removal flag (service re-added)
router.post('/:id/revert-service', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const updated = await query(
      `UPDATE tasks SET removed_at = NULL, removed_by = NULL, removed_reason = NULL, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (!updated.rows[0]) throw httpError(404, 'Task not found');
    await logActivity(req.params.id, req.user.id, 'service_reverted');
    res.json(await fetchOne(req.params.id, req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requirePerm('engagements.delete'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Task not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- checklist ----------

// POST /api/tasks/:id/checklist  { title }
router.post('/:id/checklist', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const title = (req.body?.title || '').trim();
    if (!title) throw httpError(400, 'Checklist item title is required');
    const { rowCount } = await query(
      `SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rowCount) throw httpError(404, 'Task not found');

    const { rows } = await query(
      `INSERT INTO task_checklist_items (task_id, title, position)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM task_checklist_items WHERE task_id = $1))
       RETURNING *`,
      [req.params.id, title]
    );
    await logActivity(req.params.id, req.user.id, 'checklist_added', { title });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/checklist/:itemId  { is_done?, title? }
router.put('/checklist/:itemId', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const item = await query(
      `SELECT ci.*, t.tenant_id FROM task_checklist_items ci
       JOIN tasks t ON t.id = ci.task_id
       WHERE ci.id = $1`,
      [req.params.itemId]
    );
    if (!item.rows[0] || item.rows[0].tenant_id !== req.user.tenant_id) {
      throw httpError(404, 'Checklist item not found');
    }

    const updates = [];
    const values = [];
    if (req.body?.is_done !== undefined) {
      updates.push(`is_done = $${values.length + 1}`);
      values.push(Boolean(req.body.is_done));
    }
    if (req.body?.title !== undefined) {
      if (!String(req.body.title).trim()) throw httpError(400, 'Title cannot be empty');
      updates.push(`title = $${values.length + 1}`);
      values.push(String(req.body.title).trim());
    }
    if (!updates.length) throw httpError(400, 'No valid fields provided');
    values.push(req.params.itemId);

    const { rows } = await query(
      `UPDATE task_checklist_items SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (req.body?.is_done !== undefined) {
      await logActivity(item.rows[0].task_id, req.user.id, 'checklist_toggle', { done: Boolean(req.body.is_done) });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/checklist/:itemId
router.delete('/checklist/:itemId', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const item = await query(
      `SELECT ci.*, t.tenant_id FROM task_checklist_items ci
       JOIN tasks t ON t.id = ci.task_id
       WHERE ci.id = $1`,
      [req.params.itemId]
    );
    if (!item.rows[0] || item.rows[0].tenant_id !== req.user.tenant_id) {
      throw httpError(404, 'Checklist item not found');
    }
    await query(`DELETE FROM task_checklist_items WHERE id = $1`, [req.params.itemId]);
    await logActivity(item.rows[0].task_id, req.user.id, 'checklist_removed');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- comments ----------

// POST /api/tasks/:id/comments  { body }
router.post('/:id/comments', requirePerm('engagements.edit'), async (req, res, next) => {
  try {
    const body = (req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Comment cannot be empty');
    const { rowCount } = await query(`SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2`, [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Task not found');

    const { rows } = await query(
      `INSERT INTO task_comments (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, body]
    );
    await logActivity(req.params.id, req.user.id, 'comment_added');
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;