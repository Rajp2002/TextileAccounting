ALTER TABLE production_logs
  ADD COLUMN IF NOT EXISTS closing_meter_reading numeric,
  ADD COLUMN IF NOT EXISTS opening_meter_reading numeric;

COMMENT ON COLUMN production_logs.closing_meter_reading IS
  'The cumulative loom counter value at the END of this shift. Displayed to supervisor as the input field.';

COMMENT ON COLUMN production_logs.opening_meter_reading IS
  'The cumulative loom counter value at the START of this shift. Auto-populated from previous shift closing reading.';
