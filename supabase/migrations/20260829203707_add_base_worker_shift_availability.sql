-- Base worker pay is derived from the costing currently attached to each
-- assigned machine. Workers therefore only need an availability preference;
-- the retained rate column remains for schema compatibility and legacy data.
-- New Base workers are created with zero; historical production keeps its
-- immutable rate snapshots.
ALTER TABLE public.base_production_workers
  ALTER COLUMN rate_per_meter SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_availability text NOT NULL DEFAULT 'both';

ALTER TABLE public.base_production_workers
  DROP CONSTRAINT IF EXISTS base_production_workers_shift_availability_check;

ALTER TABLE public.base_production_workers
  ADD CONSTRAINT base_production_workers_shift_availability_check
  CHECK (shift_availability IN ('day', 'night', 'both'));

COMMENT ON COLUMN public.base_production_workers.shift_availability IS
  'Editable worker availability used by Base setup: day, night, or both shifts.';
