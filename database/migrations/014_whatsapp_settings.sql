-- =============================================================
-- Migration 014: WhatsApp Business credentials (per-tenant)
-- Stored on the settings row so each firm can connect its own
-- Meta WhatsApp Cloud API account from the CRM UI.
-- Applies idempotently.
-- =============================================================

ALTER TABLE settings ADD COLUMN IF NOT EXISTS wa_access_token TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS wa_phone_number_id VARCHAR(40) DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS wa_graph_version VARCHAR(10) DEFAULT 'v21.0';