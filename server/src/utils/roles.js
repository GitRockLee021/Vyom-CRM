import { query } from '../config/db.js';

// Maps the coarse text role on a user (used for team management) to the
// tenant's default role name seeded in the `roles` table.
export const ROLE_NAME_BY_TEXT = {
  admin: 'Administrator',
  accountant: 'Accountant',
  consultant: 'Senior Consultant',
};

// Fallback permission sets when a user has no linked role row (legacy data).
export const TEXT_ROLE_PERMISSIONS = {
  admin: {
    clients: { view: true, create: true, edit: true, delete: true },
    billing: { view: true, create: true, edit: true, delete: true, record_payment: true },
    engagements: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, edit: true, manage_roles: true },
  },
  accountant: {
    clients: { view: true, create: false, edit: false, delete: false },
    billing: { view: true, create: true, edit: true, delete: false, record_payment: true },
    engagements: { view: true, create: false, edit: false, delete: false },
    settings: { view: true, edit: false, manage_roles: false },
  },
  consultant: {
    clients: { view: true, create: true, edit: true, delete: false },
    billing: { view: true, create: true, edit: false, delete: false, record_payment: true },
    engagements: { view: true, create: true, edit: true, delete: false },
    settings: { view: true, edit: false, manage_roles: false },
  },
};

// Look up the tenant's default role for a coarse text role ('admin' etc.).
export async function defaultRoleId(tenantId, roleText) {
  const name = ROLE_NAME_BY_TEXT[roleText];
  if (!name) return null;
  const { rows } = await query(
    'SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1',
    [tenantId, name],
  );
  return rows[0]?.id ?? null;
}

// Resolve the effective permission set for a user: linked role row first,
// then the coarse-text-role fallback. Admins always get full access.
export async function loadPermissions(user) {
  if (user?.role === 'admin') return TEXT_ROLE_PERMISSIONS.admin;
  if (user?.role_id) {
    const { rows } = await query('SELECT permissions FROM roles WHERE id = $1', [user.role_id]);
    if (rows[0]?.permissions) return rows[0].permissions;
  }
  return (
    TEXT_ROLE_PERMISSIONS[user?.role] || {
      clients: { view: true },
      billing: { view: true },
      engagements: { view: true },
      settings: { view: true },
    }
  );
}

// Check a "section.action" key against a permission object, e.g. 'billing.record_payment'.
export function hasPermission(permissions, key) {
  const [section, action] = String(key || '').split('.');
  return Boolean(permissions?.[section]?.[action]);
}