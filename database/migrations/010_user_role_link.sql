-- =============================================================
-- Migration 010: Link users to their tenant role
-- users.role_id points at a row in `roles`, whose `permissions`
-- JSON becomes authoritative for that user. Existing users are
-- backfilled to their tenant's matching default role. Applies
-- idempotently.
-- =============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND r.tenant_id = u.tenant_id
  AND (
    (u.role = 'admin'      AND r.name = 'Administrator')
    OR (u.role = 'accountant'    AND r.name = 'Accountant')
    OR (u.role = 'consultant'    AND r.name = 'Senior Consultant')
  );