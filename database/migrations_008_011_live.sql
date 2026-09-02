-- =============================================================
-- Migration 008: Multi-tenancy core
-- Creates the tenants table and adds tenant_id to every business
-- table. Existing rows stay on their current tenant (tenant_id = 1,
-- the original Vyom workspace).
-- Applies idempotently.
-- =============================================================

-- ---------- tenants ----------
CREATE TABLE IF NOT EXISTS tenants (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  plan       VARCHAR(30) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (id, name, slug)
VALUES (1, 'Vyom', 'vyom')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('tenants', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM tenants), 1)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenants_updated_at') THEN
    CREATE TRIGGER trg_tenants_updated_at
      BEFORE UPDATE ON tenants
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ---------- users ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);

-- ---------- services ----------
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE services ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE services SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE services ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE services ADD CONSTRAINT fk_services_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services (tenant_id);

-- Service code uniqueness becomes per-tenant.
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_services_tenant_code ON services (tenant_id, code);

-- ---------- clients (column already exists) ----------
ALTER TABLE clients ADD CONSTRAINT fk_clients_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);

-- ---------- engagements ----------
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE engagements ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE engagements SET tenant_id = clients.tenant_id FROM clients WHERE clients.id = engagements.client_id;
UPDATE engagements SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE engagements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE engagements ADD CONSTRAINT fk_engagements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_engagements_tenant ON engagements (tenant_id);

-- ---------- documents ----------
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE documents ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE documents SET tenant_id = clients.tenant_id FROM clients WHERE clients.id = documents.client_id;
UPDATE documents SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE documents ADD CONSTRAINT fk_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents (tenant_id);

-- ---------- invoices ----------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE invoices ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE invoices SET tenant_id = clients.tenant_id FROM clients WHERE clients.id = invoices.client_id;
UPDATE invoices SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE invoices ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (tenant_id);

-- Invoice number uniqueness becomes per-tenant.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_tenant_number ON invoices (tenant_id, invoice_number);

-- ---------- payments ----------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE payments ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE payments SET tenant_id = invoices.tenant_id FROM invoices WHERE invoices.id = payments.invoice_id;
UPDATE payments SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments (tenant_id);

-- ---------- tasks ----------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE tasks ALTER COLUMN tenant_id SET DEFAULT 1;
UPDATE tasks SET tenant_id = engagements.tenant_id FROM engagements WHERE engagements.id = tasks.engagement_id;
UPDATE tasks SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks (tenant_id);

-- ---------- settings & roles (columns already exist) ----------
ALTER TABLE settings ADD CONSTRAINT fk_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);
ALTER TABLE roles ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);-- 
-- ==================== next migration ==================== 
---- =============================================================
-- Migration 009: Team invitations
-- Store one-time invite tokens (SHA-256 hashed) so admins can
-- invite team members to their workspace.
-- Applies idempotently.
-- =============================================================

CREATE TABLE IF NOT EXISTS invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      VARCHAR(180) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'consultant'
             CHECK (role IN ('admin', 'accountant', 'consultant')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (email);

-- One pending invite per (tenant, email).
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_tenant_email_pending
  ON invitations (tenant_id, lower(email))
  WHERE used_at IS NULL;-- 
-- ==================== next migration ==================== 
---- =============================================================
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
  );-- 
-- ==================== next migration ==================== 
---- =============================================================
-- Migration 011: Extend default role permissions with the
-- `engagements` section and `billing.delete` (adds only the new
-- keys; existing custom grants are left untouched).
-- Run from repo root: node <temp>/run-migration.cjs <root> 011_extend_role_permissions.sql
-- =============================================================

UPDATE roles
SET permissions = JSONB_SET(
  JSONB_SET(permissions, '{engagements}', jsonb_build_object(
    'view', TRUE,
    'create', (name NOT IN ('Accountant', 'Intern')),
    'edit',   (name NOT IN ('Accountant', 'Intern')),
    'delete', (name = 'Administrator')
  )),
  '{billing}',
  COALESCE(permissions->'billing', '{}'::jsonb) ||
    jsonb_build_object('delete', (name = 'Administrator'))
)
WHERE is_default = TRUE;