import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { assertUserInTenant } from '../utils/member-check.js';
import { requirePerm } from '../middleware/auth.middleware.js';
import { syncTasksForClient } from '../utils/task-gen.js';

const router = Router();

const ALLOWED_FIELDS = [
  'client_type', 'name', 'contact_person', 'email', 'phone',
  'gstin', 'pan', 'tan',
  'address_line1', 'address_line2', 'city', 'state', 'pincode',
  'status', 'notes', 'assigned_to',
];

// Object with the client's selected services ({ id, name }[]).
// Correlated to the outer `clients c` alias via c.id.
const SERVICE_SELECT = `
  SELECT COALESCE(
    json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name),
    '[]'::json
  ) AS services
  FROM client_services cs
  JOIN services s ON s.id = cs.service_id
  WHERE cs.client_id = c.id
`;

function pickFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

// Replace the client's selected service set. Verifies every service
// belongs to the caller's tenant before inserting.
async function syncServices(client, clientId, serviceIds, tenantId) {
  const ids = Array.isArray(serviceIds)
    ? [...new Set(serviceIds.map((s) => String(s).trim()).filter(Boolean))]
    : [];
  if (!ids.length) {
    throw httpError(400, 'At least one service must be selected');
  }
  if (ids.length) {
    const { rows } = await client.query(
      'SELECT id FROM services WHERE id = ANY($1::uuid[]) AND tenant_id = $2',
      [ids, tenantId]
    );
    const valid = rows.map((r) => r.id);
    const invalid = ids.filter((id) => !valid.includes(id));
    if (invalid.length) throw httpError(400, 'One or more selected services do not exist');
  }
  await client.query('DELETE FROM client_services WHERE client_id = $1', [clientId]);
  for (const serviceId of ids) {
    await client.query(
      'INSERT INTO client_services (client_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [clientId, serviceId]
    );
  }
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

// GET /api/clients?status=&type=&search=
// Always scoped to the authenticated user's tenant.
router.get('/', requirePerm('clients.view'), async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const conditions = [];
    const params = [req.user.tenant_id];

    conditions.push('tenant_id = $1');
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
      `SELECT c.*, (${SERVICE_SELECT}) AS services
       FROM clients c ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id
router.get('/:id', requirePerm('clients.view'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, (${SERVICE_SELECT}) AS services
       FROM clients c WHERE c.id = $1 AND c.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) throw httpError(404, 'Client not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/clients
router.post('/', requirePerm('clients.create'), async (req, res, next) => {
  const pg = await pool.connect();
  try {
    await pg.query('BEGIN');
    const data = pickFields(req.body || {});
    validate(data);
    data.tenant_id = req.user.tenant_id;
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    const keys = Object.keys(data);
    if (!keys.length) throw httpError(400, 'No valid fields provided');

    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const inserted = await pg.query(
      `INSERT INTO clients (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      Object.values(data)
    );
    const client = inserted.rows[0];
    await syncServices(pg, client.id, req.body?.service_ids, req.user.tenant_id);

    const { rows } = await pg.query(
      `SELECT c.*, (${SERVICE_SELECT}) AS services FROM clients c WHERE c.id = $1`,
      [client.id]
    );
    await pg.query('COMMIT');

    try {
      await syncTasksForClient(client.id, req.user.tenant_id, req.user.id);
    } catch (taskErr) {
      console.error('[clients] task sync warning:', taskErr.message);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    pg.release();
  }
});

// PUT /api/clients/:id
router.put('/:id', requirePerm('clients.edit'), async (req, res, next) => {
  const pg = await pool.connect();
  try {
    await pg.query('BEGIN');
    const data = pickFields(req.body || {});
    validate(data, { partial: true });
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    const keys = Object.keys(data);
    if (!keys.length && req.body?.service_ids === undefined) throw httpError(400, 'No valid fields provided');

    const onlyServices = keys.length === 0 && req.body?.service_ids !== undefined;
    if (!onlyServices) {
      const sets = keys.map((key, i) => `${key} = $${i + 1}`);
      const values = [...Object.values(data), req.params.id, req.user.tenant_id];

      const updated = await pg.query(
        `UPDATE clients SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`,
        values
      );
      if (!updated.rows[0]) throw httpError(404, 'Client not found');
    }

    if (req.body?.service_ids !== undefined) {
      await syncServices(pg, req.params.id, req.body.service_ids, req.user.tenant_id);
    }

    const { rows } = await pg.query(
      `SELECT c.*, (${SERVICE_SELECT}) AS services FROM clients c WHERE c.id = $1`,
      [req.params.id]
    );
    await pg.query('COMMIT');

    // After the client/services update is committed, generate tasks for newly
    // opted-in services and flag tasks for any service that was removed.
    if (req.body?.service_ids !== undefined) {
      try {
        await syncTasksForClient(req.params.id, req.user.tenant_id, req.user.id);
      } catch (taskErr) {
        console.error('[clients] task sync warning:', taskErr.message);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    pg.release();
  }
});

// DELETE /api/clients/:id
router.delete('/:id', requirePerm('clients.delete'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM clients WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (!rowCount) throw httpError(404, 'Client not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
