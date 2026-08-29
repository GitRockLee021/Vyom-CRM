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
ALTER TABLE roles ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id);