-- Add configurable payroll pay date and reminder window.
-- Existing payroll_configs already has RLS and org_id tenant isolation.

ALTER TABLE payroll_configs
    ADD COLUMN IF NOT EXISTS pay_date_day INT DEFAULT 10 CHECK (pay_date_day >= 1 AND pay_date_day <= 28),
    ADD COLUMN IF NOT EXISTS pay_reminder_days INT DEFAULT 3 CHECK (pay_reminder_days >= 0 AND pay_reminder_days <= 14);

UPDATE payroll_configs
SET
    pay_date_day = COALESCE(pay_date_day, 10),
    pay_reminder_days = COALESCE(pay_reminder_days, 3);

ALTER TABLE payroll_configs
    ALTER COLUMN pay_date_day SET DEFAULT 10,
    ALTER COLUMN pay_reminder_days SET DEFAULT 3;

COMMENT ON COLUMN payroll_configs.pay_date_day IS
    'Day of month when payroll should be paid after the cycle closes. The first matching date after cycle_end is used.';

COMMENT ON COLUMN payroll_configs.pay_reminder_days IS
    'Number of days before pay_date_day that payroll should be nudged as approaching.';
