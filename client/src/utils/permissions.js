// Mirrors server/src/utils/roles.js fallback sets, used only when the stored
// user object hasn't been refreshed with live `permissions` yet.
export const ROLE_PERMISSIONS = {
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

// Check a "section.action" permission (e.g. 'billing.edit') for a user.
export function can(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const [section, action] = String(key || '').split('.');
  if (user.permissions) {
    return Boolean(user.permissions?.[section]?.[action]);
  }
  return Boolean(ROLE_PERMISSIONS[user.role]?.[section]?.[action]);
}