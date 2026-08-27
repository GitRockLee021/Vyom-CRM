import jwt from 'jsonwebtoken';
import { httpError } from '../utils/http-error.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vyom-crm-dev-secret-change-me';

// Express middleware that requires a valid Bearer token and attaches req.user.
export function requireAuth(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next(httpError(401, 'Not authenticated'));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
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
