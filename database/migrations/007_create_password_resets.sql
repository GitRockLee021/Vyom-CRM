-- =============================================================
-- Migration 007: Password reset tokens
-- Run: psql -d <database> -f database/migrations/007_create_password_resets.sql
-- Only the SHA-256 hash of the token is stored; tokens expire after 1 hour.
-- =============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expiry ON password_reset_tokens (expires_at);