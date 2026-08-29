import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { sendResetEmail, isMailDevMode } from '../utils/mailer.js';
import { defaultRoleId, loadPermissions } from '../utils/roles.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'vyom-crm-dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Default catalogue copied into every new tenant's workspace.
const DEFAULT_SERVICES = [
  { code: 'GST-FILING', name: 'GST Filing', description: 'GST return filing', category: 'taxation', default_fee: null, is_recurring: true },
  { code: 'ITR', name: 'Income Tax Return', description: 'Income tax return filing', category: 'taxation', default_fee: null, is_recurring: true },
  { code: 'TDS-RETURN', name: 'TDS Return', description: 'TDS/TCS return filing', category: 'compliance', default_fee: null, is_recurring: true },
  { code: 'AUDIT-STAT', name: 'Statutory Audit', description: 'Statutory audit of financial statements', category: 'audit', default_fee: null, is_recurring: false },
  { code: 'TAX-AUDIT', name: 'Tax Audit', description: 'Tax audit u/s 44AB', category: 'audit', default_fee: null, is_recurring: true },
  { code: 'ADVISORY', name: 'Advisory Consultation', description: 'Tax and compliance advisory', category: 'advisory', default_fee: null, is_recurring: false },
  { code: 'INCORP', name: 'Company Incorporation', description: 'Company / LLP / firm registration', category: 'registration', default_fee: null, is_recurring: false },
];

// Mirrors database/migrations/006_create_roles.sql seed per tenant.
const DEFAULT_ROLES = [
  { name: 'Administrator', description: 'Full Access', is_default: true, permissions: { clients: { view: true, create: true, edit: true, delete: true }, billing: { view: true, create: true, edit: true, delete: true, record_payment: true }, engagements: { view: true, create: true, edit: true, delete: true }, settings: { view: true, edit: true, manage_roles: true } } },
  { name: 'Senior Consultant', description: 'Edit/View', is_default: false, permissions: { clients: { view: true, create: true, edit: true, delete: false }, billing: { view: true, create: true, edit: false, delete: false, record_payment: true }, engagements: { view: true, create: true, edit: true, delete: false }, settings: { view: true, edit: false, manage_roles: false } } },
  { name: 'Accountant', description: 'Billing Only', is_default: false, permissions: { clients: { view: true, create: false, edit: false, delete: false }, billing: { view: true, create: true, edit: true, delete: false, record_payment: true }, engagements: { view: true, create: false, edit: false, delete: false }, settings: { view: true, edit: false, manage_roles: false } } },
  { name: 'Intern', description: 'Read-only', is_default: false, permissions: { clients: { view: true, create: false, edit: false, delete: false }, billing: { view: true, create: false, edit: false, delete: false, record_payment: false }, engagements: { view: true, create: false, edit: false, delete: false }, settings: { view: true, edit: false, manage_roles: false } } },
];

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id, role_id: user.role_id || null },
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
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    role_id: row.role_id,
    permissions: row.permissions,
    created_at: row.created_at,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(base) {
  const root = slugify(base) || 'firm';
  let slug = root;
  let n = 2;
  for (;;) {
    const { rows } = await query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
    if (!rows.length) return slug;
    slug = `${root}-${n}`;
    n += 1;
  }
}

// POST /api/auth/register
// Creates a new tenant (workspace) with the registrant as its first admin,
// then seeds default settings, roles and services for that tenant.
router.post('/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { full_name, email, password, company_name } = req.body || {};

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

    const tenantName = company_name?.trim() || 'My Firm';
    const slug = await uniqueSlug(tenantName);
    const password_hash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const tenantRes = await client.query('INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING *', [
      tenantName,
      slug,
    ]);
    const tenant = tenantRes.rows[0];

    await client.query(
      `INSERT INTO settings (tenant_id, company_name, invoice_prefix) VALUES ($1, $2, 'VY-')`,
      [tenant.id, tenantName],
    );

    for (const role of DEFAULT_ROLES) {
      await client.query(
        `INSERT INTO roles (name, description, permissions, is_default, tenant_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [role.name, role.description, role.permissions, role.is_default, tenant.id],
      );
    }

    for (const s of DEFAULT_SERVICES) {
      await client.query(
        `INSERT INTO services (code, name, description, category, default_fee, is_recurring, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [s.code, s.name, s.description, s.category, s.default_fee, s.is_recurring, tenant.id],
      );
    }

    const adminRole = await client.query(
      "SELECT id FROM roles WHERE tenant_id = $1 AND name = 'Administrator' LIMIT 1",
      [tenant.id],
    );
    const adminRoleId = adminRole.rows[0]?.id ?? null;

    const userRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active, tenant_id, role_id)
       VALUES ($1, $2, $3, 'admin', TRUE, $4, $5)
       RETURNING id, full_name, email, role, is_active, tenant_id, role_id, created_at`,
      [full_name.trim(), email.trim().toLowerCase(), password_hash, tenant.id, adminRoleId],
    );

    await client.query('COMMIT');

    const user = userRes.rows[0];
    user.tenant_name = tenantName;
    user.permissions = await loadPermissions(user);
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    next(err);
  } finally {
    client.release();
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

    const tenant = await query(
      'SELECT name FROM tenants WHERE id = $1 AND is_active = TRUE',
      [user.tenant_id],
    );
    if (!tenant.rows[0]) throw httpError(403, 'Your workspace has been deactivated');

    user.tenant_name = tenant.rows[0].name;
    user.permissions = await loadPermissions(user);
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

    await sendResetEmail({ email: email.trim().toLowerCase(), resetUrl });

    // Echo the link back only in dev mode (mailer disabled).
    const response = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };
    if (isMailDevMode()) response.devResetLink = resetUrl;

    return res.json(response);
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

// GET /api/auth/invite?token=... — validate a team invite link (public)
router.get('/invite', async (req, res, next) => {
  try {
    const token = req.query.token || '';
    const { rows } = await query(
      `SELECT i.email, i.role, t.name AS tenant_name
       FROM invitations i
       JOIN tenants t ON t.id = i.tenant_id
       WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
      [sha256(token)],
    );
    if (!rows[0]) throw httpError(400, 'This invite link is invalid or has expired.');
    res.json({ email: rows[0].email, role: rows[0].role, tenant_name: rows[0].tenant_name });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/accept-invite
// Accepts a team invite, creating a user in the inviting tenant.
router.post('/accept-invite', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { token, full_name, email, password } = req.body || {};

    if (!token || !full_name?.trim() || !email?.trim() || !password) {
      throw httpError(400, 'token, full_name, email and password are required');
    }
    if (password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw httpError(400, 'Please enter a valid email address');
    }

    const { rows } = await query(
      `SELECT id, tenant_id, email, role FROM invitations
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token)],
    );
    const invite = rows[0];
    if (!invite) throw httpError(400, 'This invite link is invalid or has expired.');

    const normalizedEmail = email.trim().toLowerCase();
    if (invite.email.toLowerCase() !== normalizedEmail) {
      throw httpError(400, 'The email you entered does not match the invitation.');
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) throw httpError(409, 'An account with this email already exists');

    const password_hash = await bcrypt.hash(password, 10);

    const memberRoleId = await defaultRoleId(invite.tenant_id, invite.role);

    await client.query('BEGIN');

    const tenantRes = await client.query(
      'SELECT name FROM tenants WHERE id = $1 AND is_active = TRUE',
      [invite.tenant_id],
    );
    if (!tenantRes.rows[0]) throw httpError(403, 'This workspace has been deactivated');

    const userRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active, tenant_id, role_id)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       RETURNING id, full_name, email, role, is_active, tenant_id, role_id, created_at`,
      [full_name.trim(), normalizedEmail, password_hash, invite.role, invite.tenant_id, memberRoleId],
    );

    await client.query('UPDATE invitations SET used_at = now() WHERE id = $1', [invite.id]);

    await client.query('COMMIT');

    const user = userRes.rows[0];
    user.tenant_name = tenantRes.rows[0].name;
    user.permissions = await loadPermissions(user);
    const userToken = signToken(user);
    res.status(201).json({ token: userToken, user: publicUser(user) });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    next(err);
  } finally {
    client.release();
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
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.tenant_id, u.role_id,
              t.name AS tenant_name, u.created_at
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [payload.sub],
    );
    if (!rows[0] || !rows[0].is_active) throw httpError(401, 'Account not found or disabled');
    const me = rows[0];
    me.permissions = await loadPermissions(me);
    res.json({ user: me });
  } catch (err) {
    next(err);
  }
});

export default router;
