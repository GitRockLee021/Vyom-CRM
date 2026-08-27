-- Migration 001: expand client_type to the CRM's assessee categories.
-- Run on any database created before this change:
--   psql -d <database> -f database/migrations/001_client_type_expansion.sql

ALTER TABLE clients ALTER COLUMN client_type TYPE VARCHAR(20);
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_client_type_check
  CHECK (client_type IN ('individual', 'partnership', 'private_limited', 'llp', 'others', 'business'));
