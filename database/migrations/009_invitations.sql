-- =============================================================
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
  WHERE used_at IS NULL;