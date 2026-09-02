-- =============================================================
-- Migration 012: Client services (many-to-many)
-- Records which services each client has opted into.
-- Links clients <-> services. Tenant scoping is enforced in the
-- API by verifying both client and service belong to the caller's
-- tenant before inserting rows.
-- Applies idempotently.
-- =============================================================

CREATE TABLE IF NOT EXISTS client_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_client_services_client ON client_services (client_id);
CREATE INDEX IF NOT EXISTS idx_client_services_service ON client_services (service_id);
