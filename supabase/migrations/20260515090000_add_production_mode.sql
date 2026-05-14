-- Production workflow preference.
-- NULL is intentional for existing/new orgs until onboarding captures an explicit
-- choice. Application helpers treat missing values as market_run for safe defaults.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS production_mode TEXT
    CHECK (production_mode IN ('market_run', 'order_based', 'both'));

COMMENT ON COLUMN organizations.production_mode IS
    'Controls visible/default workflows: market_run, order_based, or both. NULL defaults to market_run in application logic.';
