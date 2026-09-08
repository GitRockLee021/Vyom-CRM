-- =============================================================
-- Vyom CRM - Starter schema
-- Accounting & finance consulting firm (India)
-- Refine/extend once page designs are finalized.
-- Run with: psql -U postgres -d vyom_crm -f database/schema.sql
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ---------- Users (staff) ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'consultant'
                CHECK (role IN ('admin', 'accountant', 'consultant')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Clients ----------
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type    VARCHAR(20) NOT NULL CHECK (client_type IN ('individual', 'partnership', 'private_limited', 'llp', 'others', 'business')),
  name           VARCHAR(200) NOT NULL,           -- person or company name
  contact_person VARCHAR(120),
  email          VARCHAR(180),
  phone          VARCHAR(20),
  gstin          VARCHAR(15),                     -- business only
  pan            VARCHAR(10),
  tan            VARCHAR(10),
  address_line1  VARCHAR(200),
  address_line2  VARCHAR(200),
  city           VARCHAR(80),
  state          VARCHAR(80),
  pincode        VARCHAR(6),
  status         VARCHAR(10) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('prospect', 'active', 'inactive')),
  notes          TEXT,
  assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_name ON clients (name);
CREATE INDEX idx_clients_gstin ON clients (gstin) WHERE gstin IS NOT NULL;

-- ---------- Services offered ----------
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(30),                       -- optional shorthand (not used in the flat UI)
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  category     VARCHAR(30) DEFAULT 'other',       -- optional grouping (not used in the flat UI)
  default_fee  NUMERIC(12, 2),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Client services (many-to-many: services opted into) ----------
CREATE TABLE client_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);
CREATE INDEX idx_client_services_client ON client_services (client_id);
CREATE INDEX idx_client_services_service ON client_services (service_id);

-- ---------- Engagements (service jobs per client) ----------
CREATE TABLE engagements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  title        VARCHAR(200) NOT NULL,
  period       VARCHAR(50),                       -- e.g. 'FY 2025-26', 'Q1 FY25-26', 'AY 2026-27'
  status       VARCHAR(25) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'awaiting_documents', 'in_progress',
                                 'under_review', 'completed', 'cancelled')),
  priority     VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date     DATE,
  fee          NUMERIC(12, 2),
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engagements_client ON engagements (client_id);
CREATE INDEX idx_engagements_status ON engagements (status);

-- ---------- Documents ----------
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_type     VARCHAR(100),
  file_size     BIGINT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Invoices ----------
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  engagement_id  UUID REFERENCES engagements(id) ON DELETE SET NULL,
  amount         NUMERIC(12, 2) NOT NULL,
  gst_rate       NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  status         VARCHAR(12) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issued_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_client ON invoices (client_id);

-- ---------- Payments ----------
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount       NUMERIC(12, 2) NOT NULL,
  method       VARCHAR(15) NOT NULL DEFAULT 'bank_transfer'
               CHECK (method IN ('cash', 'bank_transfer', 'upi', 'cheque', 'card')),
  reference_no VARCHAR(100),
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Tasks ----------
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Activity log ----------
CREATE TABLE activity_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(40) NOT NULL,              -- e.g. 'client', 'engagement'
  entity_id   UUID,
  action      VARCHAR(40) NOT NULL,              -- e.g. 'created', 'updated', 'deleted'
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at    BEFORE UPDATE ON clients     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_engagements_updated_at BEFORE UPDATE ON engagements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at   BEFORE UPDATE ON invoices    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at      BEFORE UPDATE ON tasks       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
