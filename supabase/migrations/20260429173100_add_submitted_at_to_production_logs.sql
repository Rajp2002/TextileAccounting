ALTER TABLE production_logs
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_production_logs_submitted_at
  ON production_logs(submitted_at);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check
  CHECK (
    action IN (
      'INSERT',
      'UPDATE',
      'DELETE',
      'EXPORT',
      'payroll.settle',
      'payroll.unsettle',
      'shift_self_correction'
    )
  );
