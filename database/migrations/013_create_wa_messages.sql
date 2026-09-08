-- =============================================================
-- Migration 013: WhatsApp message log
-- Outbound messages sent through the Meta WhatsApp Cloud API.
-- One row per message so we keep an audit trail and a clean base
-- to build the full inbox feature on later. Applies idempotently.
-- =============================================================

CREATE TABLE IF NOT EXISTS wa_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id),
  direction     VARCHAR(10) NOT NULL DEFAULT 'outbound'
                CHECK (direction IN ('outbound', 'inbound')),
  wa_message_id VARCHAR(64),
  phone_number  VARCHAR(20) NOT NULL,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  template_name VARCHAR(64),
  body          TEXT,
  status        VARCHAR(30) NOT NULL DEFAULT 'pending',
  error         TEXT,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant ON wa_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages (phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_messages_client ON wa_messages (client_id);