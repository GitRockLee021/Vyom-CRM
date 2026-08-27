import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'finconsul-dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const TENANT_ID = 1;

const ROLES = ['admin', 'accountant', 'consultant'];

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

function publicUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { full_name, email, password } = req.body || {};

    if (!full_name?.trim() || !email?.trim() || !password) {
      throw httpError(400, 'full_name, email and password are required');
    }
    if (password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw httpError(400, 'Please enter a valid email address');
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length) throw httpError(409, 'An account with this email already exists');

    // First user for the tenant becomes admin, everyone else becomes consultant.
    const countRes = await query(
      "SELECT COUNT(*)::int AS count FROM users WHERE is_active = TRUE AND role IN ('admin', 'consultant')",
    );
    const role = countRes.rows[0].count === 0 ? 'admin' : 'consultant';

    const password_hash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [full_name.trim(), email.trim().toLowerCase(), password_hash, role],
    );

    const token = signToken(rows[0]);
    res.status(201).json({ token, user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      throw httpError(400, 'email and password are required');
    }

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !user.is_active) {
      throw httpError(401, 'Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw httpError(401, 'Invalid email or password');

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// POST /api/auth/forgot-password
// Dev-mode delivery: no mailer is configured yet, so the reset link is logged to
// the server console and echoed back as `devResetLink` (only for local testing).
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw httpError(400, 'Please enter a valid email address');
    }

    const { rows } = await query('SELECT id FROM users WHERE email = $1 AND is_active = TRUE', [
      email.trim().toLowerCase(),
    ]);

    // Always respond the same way so accounts cannot be enumerated.
    if (!rows[0]) {
      return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [rows[0].id]);
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [rows[0].id, tokenHash],
    );

    const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
    console.log(`[auth] Password reset requested for ${email.trim().toLowerCase()}`);
    console.log(`[auth] Reset link (dev only): ${resetUrl}`);

    return res.json({
      message: 'If an account exists for that email, a reset link has been sent.',
      devResetLink: resetUrl,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body || {};
    if (!token || !new_password) {
      throw httpError(400, 'token and new password are required');
    }
    if (new_password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters');
    }

    const tokenHash = sha256(token);
    const { rows } = await query(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    if (!rows[0]) throw httpError(400, 'This reset link is invalid or has expired.');

    const password_hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, rows[0].user_id]);
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1', [tokenHash]);

    return res.json({ message: 'Your password has been reset. Please sign in.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (requires Authorization: Bearer <token>)
router.get('/me', async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw httpError(401, 'Not authenticated');

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      throw httpError(401, 'Invalid or expired token');
    }

    const { rows } = await query(
      'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = $1',
      [payload.sub],
    );
    if (!rows[0] || !rows[0].is_active) throw httpError(401, 'Account not found or disabled');
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
