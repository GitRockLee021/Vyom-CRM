-- =============================================================
-- Migration 014: Flat services catalogue
-- The services catalogue is presented as a flat list of names with
-- an editable fee. Category and code are no longer part of the UX.
-- Drop the constraints that force code/category to be present so
-- services can be created by name alone.
-- Applies idempotently.
-- =============================================================

-- Drop the unique constraint(s) on code so NULL codes are allowed.
ALTER TABLE services DROP CONSTRAINT IF EXISTS uq_services_tenant_code;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_code_key;

-- Drop the category CHECK so category can be free-form / omitted.
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_check;

-- Make code and category optional.
ALTER TABLE services ALTER COLUMN code DROP NOT NULL;
ALTER TABLE services ALTER COLUMN category DROP NOT NULL;

-- Backfill any existing rows without a category.
UPDATE services SET category = 'other' WHERE category IS NULL;
