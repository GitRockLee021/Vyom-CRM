import { Router } from 'express';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

const ROUTE_BY_LABEL = {
  administrator: 'admin',
  'senior consultant': 'consultant',
  accountant: 'accountant',
};

async function serialize(role, tenantId) {
  const roleKey = ROUTE_BY_LABEL[role.name.toLowerCase()] || '';
  const { rows } = await query(
    'SELECT COUNT(*)::int AS user_count FROM users WHERE role = $1 AND tenant_id = $2',
    [roleKey, tenantId],
  );
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions || {},
    is_default: role.is_default,
    user_count: rows[0]?.user_count || 0,
    created_at: role.created_at,
  };
}

// GET /api/roles
router.get('/', requirePerm('settings.view'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM roles WHERE tenant_id = $1 ORDER BY is_default DESC, created_at ASC',
      [req.user.tenant_id],
    );
    res.json(await Promise.all(rows.map((role) => serialize(role, req.user.tenant_id))));
  } catch (err) {
    next(err);
  }
});

// POST /api/roles
router.post('/', requirePerm('settings.manage_roles'), async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!name) throw httpError(400, 'Role name is required');

    const { rows } = await query(
      `INSERT INTO roles (name, description, permissions, tenant_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, req.body?.permissions || {}, req.user.tenant_id],
    );
    res.status(201).json(await serialize(rows[0], req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// PUT /api/roles/:id
router.put('/:id', requirePerm('settings.manage_roles'), async (req, res, next) => {
  try {
    const data = {};
    if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) data.description = String(req.body.description).trim();
    if (req.body?.permissions !== undefined) data.permissions = req.body.permissions;
    if (!Object.keys(data).length) throw httpError(400, 'No fields provided');

    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, val] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      values.push(val);
      i += 1;
    }
    values.push(req.params.id, req.user.tenant_id);
    const { rows } = await query(
      `UPDATE roles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values,
    );
    if (!rows[0]) throw httpError(404, 'Role not found');
    res.json(await serialize(rows[0], req.user.tenant_id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roles/:id
router.delete('/:id', requirePerm('settings.manage_roles'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT is_default FROM roles WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id],
    );
    if (!rows[0]) throw httpError(404, 'Role not found');
    if (rows[0].is_default) throw httpError(400, 'Default roles cannot be deleted');
    await query('DELETE FROM roles WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;