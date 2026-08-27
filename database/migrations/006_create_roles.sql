-- =============================================================
-- Migration 006: Roles & Permissions
-- Run: psql -d <database> -f database/migrations/006_create_roles.sql
-- =============================================================

DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(200) NOT NULL DEFAULT '',
  permissions  JSONB NOT NULL DEFAULT '{}',
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  tenant_id    INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles (tenant_id);

INSERT INTO roles (name, description, is_default, permissions) VALUES
  ('Administrator', 'Full Access', TRUE,
   '{"clients": {"view": true, "create": true, "edit": true, "delete": true}, "billing": {"view": true, "create": true, "edit": true, "record_payment": true}, "settings": {"view": true, "edit": true, "manage_roles": true}}'),
  ('Senior Consultant', 'Edit/View', FALSE,
   '{"clients": {"view": true, "create": true, "edit": true, "delete": false}, "billing": {"view": true, "create": true, "edit": false, "record_payment": true}, "settings": {"view": true, "edit": false, "manage_roles": false}}'),
  ('Accountant', 'Billing Only', FALSE,
   '{"clients": {"view": true, "create": false, "edit": false, "delete": false}, "billing": {"view": true, "create": true, "edit": true, "record_payment": true}, "settings": {"view": true, "edit": false, "manage_roles": false}}'),
  ('Intern', 'Read-only', FALSE,
   '{"clients": {"view": true, "create": false, "edit": false, "delete": false}, "billing": {"view": true, "create": false, "edit": false, "record_payment": false}, "settings": {"view": true, "edit": false, "manage_roles": false}}');