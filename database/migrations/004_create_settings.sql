-- Migration 004: create settings table for company configuration
-- Run: psql -d <database> -f database/migrations/004_create_settings.sql

DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL DEFAULT 1,
  company_name    VARCHAR(255) DEFAULT '',
  logo_url        TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  state           VARCHAR(80) DEFAULT '',
  phone           VARCHAR(50) DEFAULT '',
  email           VARCHAR(255) DEFAULT '',
  pan             VARCHAR(20) DEFAULT '',
  gst             VARCHAR(20) DEFAULT '',
  invoice_prefix  VARCHAR(50) DEFAULT 'INV-',
  bank_name       VARCHAR(100) DEFAULT '',
  account_name    VARCHAR(200) DEFAULT '',
  account_number  VARCHAR(30) DEFAULT '',
  ifsc            VARCHAR(20) DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);

INSERT INTO settings (tenant_id, company_name, invoice_prefix)
VALUES (1, 'Vyom CRM', 'VY-');
