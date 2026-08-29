import { query } from '../config/db.js';
import { httpError } from './http-error.js';

// Cross-tenant guard: an `assigned_to` value (or any user reference) must point
// to a user inside the same workspace, otherwise a tenant could reference
// another tenant's member.
export async function assertUserInTenant(userId, tenantId) {
  const { rows } = await query(
    'SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2',
    [userId, tenantId],
  );
  if (!rows.length) {
    throw httpError(400, 'The assigned user does not belong to your workspace');
  }
}