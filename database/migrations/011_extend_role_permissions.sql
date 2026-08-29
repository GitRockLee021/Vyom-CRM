-- =============================================================
-- Migration 011: Extend default role permissions with the
-- `engagements` section and `billing.delete` (adds only the new
-- keys; existing custom grants are left untouched).
-- Run from repo root: node <temp>/run-migration.cjs <root> 011_extend_role_permissions.sql
-- =============================================================

UPDATE roles
SET permissions = JSONB_SET(
  JSONB_SET(permissions, '{engagements}', jsonb_build_object(
    'view', TRUE,
    'create', (name NOT IN ('Accountant', 'Intern')),
    'edit',   (name NOT IN ('Accountant', 'Intern')),
    'delete', (name = 'Administrator')
  )),
  '{billing}',
  COALESCE(permissions->'billing', '{}'::jsonb) ||
    jsonb_build_object('delete', (name = 'Administrator'))
)
WHERE is_default = TRUE;