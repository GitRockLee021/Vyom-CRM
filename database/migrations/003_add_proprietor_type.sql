-- Migration 003: add 'proprietor' to client_type check constraint
-- Run: psql -d <database> -f database/migrations/003_add_proprietor_type.sql

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_client_type_check
  CHECK (client_type IN ('individual', 'proprietor', 'partnership', 'private_limited', 'llp', 'others', 'business'));
