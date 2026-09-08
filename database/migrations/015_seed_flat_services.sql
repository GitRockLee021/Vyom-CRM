-- =============================================================
-- Migration 015: Seed the flat services catalogue for existing tenants
-- Ensures every tenant has the full 17-service catalogue, inserting
-- only services that do not already exist by name (per tenant) so
-- previously created services are preserved.
-- Applies idempotently.
-- =============================================================

WITH new_services(name, description, default_fee, is_recurring) AS (
  VALUES
    ('Bookkeeping',                      'Ongoing books of account maintenance',                        NULL::NUMERIC, TRUE),
    ('Financial Statement Preparation',  'Preparation of financial statements',                         NULL::NUMERIC, TRUE),
    ('Payroll Processing',               'Payroll computation and statutory compliance',                NULL::NUMERIC, TRUE),
    ('Statutory Audit',                  'Statutory audit under the Companies Act',                     NULL::NUMERIC, FALSE),
    ('Tax Audit',                        'Tax audit u/s 44AB',                                           NULL::NUMERIC, TRUE),
    ('Internal Audit',                   'Internal audit and controls review',                           NULL::NUMERIC, FALSE),
    ('GST Registration & Filing',        'GST registration and return filing',                           NULL::NUMERIC, TRUE),
    ('Income Tax Return Filing (ITR)',   'Income tax return preparation and filing',                     NULL::NUMERIC, TRUE),
    ('TDS / TCS Compliance',             'TDS/TCS deduction, payment and return compliance',             NULL::NUMERIC, TRUE),
    ('Company Incorporation (Pvt Ltd, LLP, OPC)', 'Incorporation of company or LLP',                    NULL::NUMERIC, FALSE),
    ('ROC Compliance',                   'Annual and event-based ROC filings',                           NULL::NUMERIC, TRUE),
    ('FEMA / FCGPR Compliance',          'FEMA and FCGPR filing and compliance',                         NULL::NUMERIC, FALSE),
    ('Secretarial Services',             'Company secretary compliance services',                        NULL::NUMERIC, TRUE),
    ('Corporate Tax Planning',           'Corporate tax structuring and planning',                       NULL::NUMERIC, FALSE),
    ('International Tax / Transfer Pricing', 'International tax and transfer pricing advisory',          NULL::NUMERIC, FALSE),
    ('GST Advisory',                     'GST advisory and opinion',                                     NULL::NUMERIC, FALSE),
    ('Tax Representation & Assessment',  'Representation before tax authorities and assessments',        NULL::NUMERIC, FALSE)
)
INSERT INTO services (name, description, default_fee, is_recurring, tenant_id)
SELECT ns.name, ns.description, ns.default_fee, ns.is_recurring, t.id
FROM tenants t
CROSS JOIN new_services ns
WHERE NOT EXISTS (
  SELECT 1 FROM services s
  WHERE s.tenant_id = t.id AND s.name = ns.name
);