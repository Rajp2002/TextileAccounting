-- ============================================================
-- MIGRATION: Comprehensive Audit Trail Expansion
-- Adds triggers to all remaining crucial operational tables
-- ============================================================

-- 1. Machine Assignments (Shifts)
-- Modifying this retroactively manipulates wages.
CREATE TRIGGER audit_machine_assignments
  AFTER INSERT OR UPDATE OR DELETE ON machine_assignments
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 2. Safety & HR Incidents
-- Deleting or modifying incident reports must be tracked.
CREATE TRIGGER audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 3. Profiles (User Roles & Access)
-- Changes from standard user to 'supervisor' or profile updates.
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 4. Payroll Configs
-- Global payroll start days and configurations.
CREATE TRIGGER audit_payroll_configs
  AFTER INSERT OR UPDATE OR DELETE ON payroll_configs
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 5. Estimator Details
-- Key quotation settings & tech specs used for deals.
CREATE TRIGGER audit_estimator_settings
  AFTER INSERT OR UPDATE OR DELETE ON estimator_settings
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_estimator_templates
  AFTER INSERT OR UPDATE OR DELETE ON estimator_templates
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_estimator_quotes
  AFTER INSERT OR UPDATE OR DELETE ON estimator_quotes
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
