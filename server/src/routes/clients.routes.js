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
  if (ids.length) {
    await client.query(
      `INSERT INTO client_services (client_id, service_id)
       SELECT $1::uuid, u.service_id
       FROM unnest($2::uuid[]) AS u(service_id)
       ON CONFLICT DO NOTHING`,
      [clientId, ids]
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

    // Generate compliance tasks in the background so the response isn't blocked
    // on the (idempotent) task work. Any task that is missed here is created the
    // next time this client is saved.
    setImmediate(() => {
      syncTasksForClient(client.id, req.user.tenant_id, req.user.id).catch((err) =>
        console.error('[clients] task sync warning:', err.message)
      );
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    pg.release();
  }
});

// Update a client and (optionally) replace its service set in a SINGLE SQL
// statement. Runs inside the caller's transaction so a validation failure
// rolls the whole update back atomically. Returns { client, services }.
// Replacing the old ~7-query sequence cuts a save down to one DB round trip,
// which dominates perceived latency on a remote (Supabase) database.
async function updateClientAndServices(pg, id, tenantId, data, serviceIds) {
  const keys = Object.keys(data);
  const hasServices = serviceIds !== undefined;
  if (!keys.length && !hasServices) throw httpError(400, 'No valid fields provided');
  if (hasServices && (!Array.isArray(serviceIds) || serviceIds.filter((s) => String(s).trim()).length === 0)) {
    throw httpError(400, 'At least one service must be selected');
  }

  const sets = keys.map((k, i) => `${k} = $${i + 3}`);
  const svcParamIndex = keys.length + 3;
  const svc = hasServices
    ? [...new Set(serviceIds.map((s) => String(s).trim()).filter(Boolean))]
    : null;

  const { rows } = await pg.query(
    `WITH updated AS (
       UPDATE clients SET ${sets.length ? sets.join(', ') : 'name = name'}
       WHERE id = $1 AND tenant_id = $2
       RETURNING *
     ),
     requested AS (
       SELECT DISTINCT unnest($${svcParamIndex}::uuid[])::uuid AS id
     ),
     valid AS (
       SELECT r.id, s.name FROM requested r
       JOIN services s ON s.id = r.id AND s.tenant_id = $2
     ),
     deleted AS (
       DELETE FROM client_services WHERE client_id = $1
         AND $${svcParamIndex} IS NOT NULL
         AND service_id NOT IN (SELECT id FROM valid)
     ),
     linked AS (
       INSERT INTO client_services (client_id, service_id)
       SELECT $1, v.id FROM valid v
       WHERE $${svcParamIndex} IS NOT NULL
       ON CONFLICT DO NOTHING
     )
     SELECT
       (SELECT to_jsonb(u) FROM updated u) AS client,
       CASE WHEN $${svcParamIndex} IS NOT NULL
         THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) ORDER BY v.name), '[]'::jsonb) FROM valid v)
         ELSE (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.name), '[]'::jsonb)
               FROM client_services cs JOIN services s ON s.id = cs.service_id WHERE cs.client_id = $1)
       END AS services,
       (SELECT count(*) FROM requested) AS requested_count,
       (SELECT count(*) FROM valid) AS valid_count`,
    [id, tenantId, ...Object.values(data), svc]
  );

  const row = rows[0];
  if (!row?.client) throw httpError(404, 'Client not found');
  if (hasServices && Number(row.requested_count || 0) !== Number(row.valid_count || 0)) {
    throw httpError(400, 'One or more selected services do not exist');
  }
  return { client: row.client, services: Array.isArray(row.services) ? row.services : [] };
}

// PUT /api/clients/:id
router.put('/:id', requirePerm('clients.edit'), async (req, res, next) => {
  const pg = await pool.connect();
  try {
    await pg.query('BEGIN');
    const data = pickFields(req.body || {});
    validate(data, { partial: true });
    if (data.assigned_to) await assertUserInTenant(data.assigned_to, req.user.tenant_id);

    const { client, services } = await updateClientAndServices(
      pg,
      req.params.id,
      req.user.tenant_id,
      data,
      req.body?.service_ids
    );
    await pg.query('COMMIT');

    // Reconcile compliance tasks off the response path (idempotent; any missed
    // work is created on this client's next save).
    if (req.body?.service_ids !== undefined) {
      setImmediate(() => {
        syncTasksForClient(req.params.id, req.user.tenant_id, req.user.id).catch((err) =>
          console.error('[clients] task sync warning:', err.message)
        );
      });
    }

    res.json({ ...client, services });
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
