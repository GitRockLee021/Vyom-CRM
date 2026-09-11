import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { httpError } from '../utils/http-error.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { sendInviteEmail, isMailDevMode } from '../utils/mailer.js';
import { defaultRoleId } from '../utils/roles.js';

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ROLES = ['admin', 'accountant', 'consultant'];
const ROLE_LABELS = { admin: 'Administrator', accountant: 'Accountant', consultant: 'Consultant' };

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function publicMember(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

// GET /api/team — members and pending invites for the caller's tenant
router.get('/', async (req, res, next) => {
  try {
    await query(
      "DELETE FROM invitations WHERE tenant_id = $1 AND expires_at <= now()",
      [req.user.tenant_id],
    );

    const [members, invites] = await Promise.all([
      query(
        'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC',
        [req.user.tenant_id],
      ),
      query(
        `SELECT id, email, role, invited_by, expires_at, used_at, created_at
         FROM invitations WHERE tenant_id = $1 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
        [req.user.tenant_id],
      ),
    ]);
    res.json({
      members: members.rows.map(publicMember),
      invites: invites.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/team/invites — admin only
router.post('/invites', requireRole('admin'), async (req, res, next) => {
  try {
    const { email, role = 'consultant' } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw httpError(400, 'Please enter a valid email address');
    }
    if (!ROLES.includes(role)) {
      throw httpError(400, `role must be one of: ${ROLES.join(', ')}`);
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [normalized]);
    if (existing.rows.length) throw httpError(409, 'That email already belongs to an account');

    // Clear any stale (expired) invites for this email so they never block or collide.
    await query(
      'DELETE FROM invitations WHERE tenant_id = $1 AND lower(email) = $2 AND expires_at <= now()',
      [req.user.tenant_id, normalized],
    );

    const pending = await query(
      'SELECT id FROM invitations WHERE tenant_id = $1 AND lower(email) = $2 AND used_at IS NULL AND expires_at > now()',
      [req.user.tenant_id, normalized],
    );
    if (pending.rows.length) throw httpError(409, 'An invite for this email is already pending');

    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await query(
      `INSERT INTO invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '72 hours')
       RETURNING id, email, role, expires_at, created_at`,
      [req.user.tenant_id, normalized, role, sha256(token), req.user.id],
    );

    const tenantRes = await query('SELECT name FROM tenants WHERE id = $1', [req.user.tenant_id]);
    const tenantName = tenantRes.rows[0]?.name || 'Vyom CRM';

    const inviteUrl = `${CLIENT_URL}/invite?token=${token}`;
    console.log(`[team] Invite sent to ${normalized}`);

    await sendInviteEmail({
      email: normalized,
      tenantName,
      roleLabel: ROLE_LABELS[role] || role,
      inviteUrl,
    });

    // Echo the link back only in dev mode (mailer disabled).
    const response = { invite: rows[0] };
    if (isMailDevMode()) response.devInviteUrl = inviteUrl;

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/team/invites/:id — admin only
router.delete('/invites/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM invitations WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id],
    );
    if (!rowCount) throw httpError(404, 'Invite not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/team/members/:id — admin only (role and/or active toggle)
router.patch('/members/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { role, is_active } = req.body || {};
    const memberId = req.params.id;
    const tenantId = req.user.tenant_id;

    if (memberId === req.user.id) throw httpError(400, 'You cannot change your own membership');
    if (role !== undefined && !ROLES.includes(role)) {
      throw httpError(400, `role must be one of: ${ROLES.join(', ')}`);
    }

    const member = await query(
      'SELECT id, role, is_active FROM users WHERE id = $1 AND tenant_id = $2',
      [memberId, tenantId],
    );
    const target = member.rows[0];
    if (!target) throw httpError(404, 'Member not found');

    const newRole = role ?? target.role;
    const newActive = is_active !== undefined ? Boolean(is_active) : target.is_active;

    // Never remove or demote the last active admin.
    if (target.is_active && target.role === 'admin' && (newActive === false || newRole !== 'admin')) {
      const admins = await query(
        "SELECT COUNT(*)::int AS count FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE",
        [tenantId],
      );
      if (admins.rows[0].count <= 1) {
        throw httpError(400, 'You cannot remove or demote the last active admin');
      }
    }

    // Keep the linked role row in sync with the coarse role.
    const roleIdForUpdate = await defaultRoleId(tenantId, newRole);

    const { rows } = await query(
      `UPDATE users SET role = $1, is_active = $2, role_id = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, full_name, email, role, is_active, created_at`,
      [newRole, newActive, roleIdForUpdate, memberId, tenantId],
    );
    res.json(publicMember(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;