ALTER TABLE worker_advances
  ADD COLUMN IF NOT EXISTS writeoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS writeoff_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS writeoff_reason text;

COMMENT ON COLUMN worker_advances.writeoff_at IS
  'If set, this advance balance was written off at this timestamp. The advance is excluded from outstanding balance calculations.';
