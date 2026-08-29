import jwt from 'jsonwebtoken';
import { httpError } from '../utils/http-error.js';
import { loadPermissions, hasPermission } from '../utils/roles.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vyom-crm-dev-secret-change-me';

// Express middleware that requires a valid Bearer token and attaches req.user.
export function requireAuth(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next(httpError(401, 'Not authenticated'));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Legacy tokens (issued before tenancy) fall back to tenant 1.
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id ?? 1,
      role_id: payload.role_id ?? null,
    };
    return next();
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
}

// Factory that only allows the listed roles through.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

// Factory that checks a "section.action" permission (e.g. 'billing.edit') for
// the authenticated user. Workspace admins always pass (also protects the
// owner from locking themselves out via the Roles editor).
export function requirePerm(key) {
  return async (req, _res, next) => {
    try {
      if (!req.user) return next(httpError(401, 'Not authenticated'));
      if (req.user.role === 'admin') return next();
      const permissions = await loadPermissions(req.user);
      if (!hasPermission(permissions, key)) {
        return next(httpError(403, 'You do not have permission to perform this action'));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
