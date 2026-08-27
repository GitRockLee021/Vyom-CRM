-- =============================================================
-- Migration 002: Add multi-tenancy support
-- Adds tenant_id to clients (and cascades to invoices via FK).
-- All existing rows default to tenant_id = 1.
-- Run with: psql -U postgres -d finconsul -f database/migrations/002_add_tenant_id.sql
-- =============================================================

-- Add tenant_id to clients
ALTER TABLE clients ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_clients_tenant ON clients (tenant_id);

-- Update existing clients to tenant_id = 1 (already default, but explicit)
UPDATE clients SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Note: invoices.client_id -> clients.id FK already exists.
-- Querying invoices with tenant_id is done via JOIN on clients.
