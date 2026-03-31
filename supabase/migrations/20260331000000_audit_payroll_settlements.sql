-- ============================================================
-- MIGRATION: Audit Payroll Settlements
-- ============================================================

-- Add payroll_settlements to the audit log mechanism
CREATE TRIGGER audit_payroll_settlements
  AFTER INSERT OR UPDATE OR DELETE ON payroll_settlements
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
