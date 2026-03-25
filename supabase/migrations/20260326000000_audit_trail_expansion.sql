-- ============================================================
-- MIGRATION: Expand Audit Trail
-- Adds audit triggers to attendance, workers, fixed_workers, machines,
-- orders, yarn_batches, and yarn_qualities. Also adds an FK constraint
-- to audit_log.changed_by to easily fetch the actor's profile.
-- ============================================================

-- Add FK constraint if the column exists but doesn't have an FK
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_changed_by_fkey
  FOREIGN KEY (changed_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 1. Attendance
CREATE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 2. Workers
CREATE TRIGGER audit_workers
  AFTER INSERT OR UPDATE OR DELETE ON workers
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 3. Fixed Workers
CREATE TRIGGER audit_fixed_workers
  AFTER INSERT OR UPDATE OR DELETE ON fixed_workers
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 4. Machines
CREATE TRIGGER audit_machines
  AFTER INSERT OR UPDATE OR DELETE ON machines
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 5. Orders
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 6. Yarn Batches
CREATE TRIGGER audit_yarn_batches
  AFTER INSERT OR UPDATE OR DELETE ON yarn_batches
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 7. Qualities
CREATE TRIGGER audit_qualities
  AFTER INSERT OR UPDATE OR DELETE ON qualities
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
