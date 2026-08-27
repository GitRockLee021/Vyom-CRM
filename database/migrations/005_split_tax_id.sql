-- Migration 005: split tax_id into pan and gst columns in settings
-- Run: psql -d <database> -f database/migrations/005_split_tax_id.sql

ALTER TABLE settings ADD COLUMN IF NOT EXISTS pan VARCHAR(20) DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gst VARCHAR(20) DEFAULT '';

-- Migrate existing data
UPDATE settings SET pan = COALESCE(tax_id, '') WHERE pan = '' AND COALESCE(tax_id, '') != '';

ALTER TABLE settings DROP COLUMN IF EXISTS tax_id;
